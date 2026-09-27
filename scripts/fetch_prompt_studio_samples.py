"""Fetch safe CC0 DiffusionDB examples for the curated Prompt Studio prompts.

Images are read from their original DiffusionDB ZIP shard using HTTP byte ranges,
then resized to WebP for the web gallery. Run from the workspace root.
"""

from __future__ import annotations

import concurrent.futures
import io
import json
import shutil
import subprocess
import time
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

import duckdb

SOURCE = "https://huggingface.co/datasets/poloclub/diffusiondb"
METADATA = f"{SOURCE}/resolve/main/metadata.parquet"
IMAGE_ARCHIVE = f"{SOURCE}/resolve/main/images/part-{{part_id:06}}.zip"
PROMPTS_PATH = Path("artifacts/api-server/src/data/prompt-library.json")
OUTPUT_DIR = Path("artifacts/fezi-ai/public/prompt-samples")
MANIFEST_PATH = Path("artifacts/fezi-ai/src/lib/prompt-studio-source-samples.json")
MAX_IMAGE_NSFW = 0.08
MAX_PROMPT_NSFW = 0.01
RANGE_BLOCK_BYTES = 256 * 1024


class HttpRangeFile(io.RawIOBase):
    """Minimal seekable file object backed by HTTP Range GETs."""

    def __init__(self, url: str, size: int):
        self.url = url
        self.size = size
        self.position = 0
        self.cache_start = -1
        self.cache = b""

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            position = offset
        elif whence == io.SEEK_CUR:
            position = self.position + offset
        elif whence == io.SEEK_END:
            position = self.size + offset
        else:
            raise ValueError(f"Unsupported seek origin: {whence}")
        if position < 0:
            raise ValueError("Cannot seek before the beginning of the archive")
        self.position = min(position, self.size)
        return self.position

    def read(self, size: int = -1) -> bytes:
        if size == 0 or self.position >= self.size:
            return b""
        requested = self.size - self.position if size < 0 else min(size, self.size - self.position)
        cache_offset = self.position - self.cache_start
        if cache_offset < 0 or cache_offset + requested > len(self.cache):
            start = self.position
            end = min(self.size - 1, start + max(requested, RANGE_BLOCK_BYTES) - 1)
            request = urllib.request.Request(
                self.url,
                headers={
                    "Accept-Encoding": "identity",
                    "Range": f"bytes={start}-{end}",
                },
            )
            error: BaseException | None = None
            for attempt in range(4):
                try:
                    with urllib.request.urlopen(request, timeout=90) as response:
                        if response.status != 206:
                            raise RuntimeError(f"Expected a partial archive response, got HTTP {response.status}")
                        self.cache = response.read()
                        self.cache_start = start
                    error = None
                    break
                except (OSError, urllib.error.URLError, RuntimeError) as caught:
                    error = caught
                    time.sleep(0.5 * (attempt + 1))
            if error:
                raise RuntimeError(f"Could not read a DiffusionDB image range: {error}") from error
            cache_offset = self.position - self.cache_start
        result = self.cache[cache_offset : cache_offset + requested]
        self.position += len(result)
        return result


def select_source_images() -> list[dict[str, Any]]:
    prompts = json.loads(PROMPTS_PATH.read_text())
    connection = duckdb.connect()
    connection.execute("CREATE TEMP TABLE wanted (id VARCHAR, normalized_prompt VARCHAR)")
    connection.executemany(
        "INSERT INTO wanted VALUES (?, ?)",
        [(item["id"], " ".join(item["promptText"].split()).casefold().rstrip(" .,;")) for item in prompts],
    )
    rows = connection.execute(
        """
        SELECT wanted.id, metadata.image_name, metadata.part_id, metadata.image_nsfw
        FROM read_parquet(?) AS metadata
        JOIN wanted
          ON lower(rtrim(regexp_replace(trim(metadata.prompt), '\\s+', ' ', 'g'), ' .,;'))
             = wanted.normalized_prompt
        WHERE metadata.prompt_nsfw < ? AND metadata.image_nsfw < ?
        QUALIFY row_number() OVER (
          PARTITION BY wanted.id
          ORDER BY metadata.image_nsfw ASC, metadata.image_name ASC
        ) = 1
        """,
        [METADATA, MAX_PROMPT_NSFW, MAX_IMAGE_NSFW],
    ).fetchall()
    connection.close()
    selected = [
        {
            "promptId": prompt_id,
            "imageName": image_name,
            "partId": int(part_id),
            "imageNsfw": float(image_nsfw),
            "fileName": f"{prompt_id}.webp",
        }
        for prompt_id, image_name, part_id, image_nsfw in rows
    ]
    if len(selected) != len(prompts):
        found = {entry["promptId"] for entry in selected}
        missing = len(prompts) - len(found)
        raise RuntimeError(f"Found source examples for {len(found)} of {len(prompts)} prompts; {missing} are missing.")
    return selected


def fetch_archive(part_id: int) -> tuple[str, int]:
    request = urllib.request.Request(IMAGE_ARCHIVE.format(part_id=part_id), method="HEAD")
    error: BaseException | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                size = int(response.headers["Content-Length"])
                return response.url, size
        except (OSError, urllib.error.URLError) as caught:
            error = caught
            time.sleep(attempt + 1)
    raise RuntimeError(f"Could not open DiffusionDB image shard {part_id}: {error}") from error


def make_webp(source_png: bytes) -> bytes:
    executable = shutil.which("magick")
    if not executable:
        raise RuntimeError("ImageMagick (magick) is required to optimize sample images.")
    result = subprocess.run(
        [executable, "png:-", "-auto-orient", "-resize", "512x512>", "-strip", "-quality", "78", "webp:-"],
        input=source_png,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=90,
    )
    if result.returncode:
        raise RuntimeError(f"Image optimization failed: {result.stderr.decode(errors='replace')[-500:]}")
    return result.stdout


def download_shard(part_id: int, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    archive_url, archive_size = fetch_archive(part_id)
    results = []
    with zipfile.ZipFile(HttpRangeFile(archive_url, archive_size)) as archive:
        members = {Path(name).name: name for name in archive.namelist() if name.lower().endswith(".png")}
        for entry in entries:
            member = members.get(entry["imageName"])
            if not member:
                raise RuntimeError(f"Source image {entry['imageName']} is missing from DiffusionDB part {part_id}.")
            image = make_webp(archive.read(member))
            target = OUTPUT_DIR / entry["fileName"]
            target.write_bytes(image)
            results.append({**entry, "bytes": len(image)})
    return results


def main() -> None:
    if not shutil.which("magick"):
        raise RuntimeError("ImageMagick is not installed in this environment.")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    entries = select_source_images()
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        if not (OUTPUT_DIR / entry["fileName"]).is_file():
            grouped[entry["partId"]].append(entry)

    downloaded: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(download_shard, part, items) for part, items in grouped.items()]
        for future in concurrent.futures.as_completed(futures):
            downloaded.extend(future.result())

    manifest = {
        "source": SOURCE,
        "license": "CC0-1.0",
        "imageNsfwScoreMaxExclusive": MAX_IMAGE_NSFW,
        "promptNsfwScoreMaxExclusive": MAX_PROMPT_NSFW,
        "samples": [
            {key: entry[key] for key in ("promptId", "fileName", "imageName", "partId", "imageNsfw")}
            for entry in entries
        ],
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(
        f"Samples ready: {len(entries)} matched prompts, {len(grouped)} archive shards fetched, "
        f"{len(downloaded)} optimized images downloaded."
    )


if __name__ == "__main__":
    main()