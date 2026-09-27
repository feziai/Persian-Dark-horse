"""Build a small, text-only Prompt Studio collection from DiffusionDB (CC0-1.0).

Run from the workspace root. The source dataset is public, but this script is
not run by the web server; the reviewed JSON snapshot ships with the app.
Source and license: https://huggingface.co/datasets/poloclub/diffusiondb
"""

import hashlib
import json
import re
from pathlib import Path

import duckdb

SOURCE = "https://huggingface.co/datasets/poloclub/diffusiondb/resolve/main/metadata.parquet"
DESTINATION = Path("artifacts/api-server/src/data/prompt-library.json")
PER_CATEGORY = 50

UNSAFE = re.compile(
    r"\b(?:nsfw|nude|naked|lingerie|erotic|porn|sex(?:ual|y)?|fetish|"
    r"blood|gore|murder|violence|violent|weapon|gun|rifle|knife|"
    r"death|dead|sacrifice|horror|horrific|demon|evil|"
    r"seductive|topless|bikini|cleavage|breasts?|"
    r"child(?:ren)?|teen(?:age|ager)?|kid|baby|schoolgirl|loli|"
    r"hitler|nazi|suicide|self.harm|torture|rape|abuse|"
    r"deepfake|celebrity|watermark|signature)\b",
    re.IGNORECASE,
)
LINK_OR_HANDLE = re.compile(r"https?://|www\.|(?:^|\s)@\w+|<[^>]+>")
ARTIST_REFERENCE = re.compile(r"\b(?:by|inspired by)\s+[a-z]{3,}", re.I)
NAMED_CHARACTER = re.compile(r"\b[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,})?\b")
IDENTITY_OR_FRANCHISE = re.compile(
    r"\b(?:donald trump|joe biden|elon musk|greta thunberg|"
    r"rick and morty|darth vader|star wars|harry potter|"
    r"batman|spider.?man|superman|hulk|frodo|mickey mouse|"
    r"cinderella|elsa|louis vuitton|nissan|"
    r"star trek|willy wonka|oompa loompa|yoda|celeste|"
    r"in the style of|portrait of [a-z ]+ as)\b",
    re.I,
)
KEYWORDS = {
    "disney": re.compile(r"\b(?:disney|pixar)\s+(?:style|animation|art|inspired)\b", re.I),
    "games": re.compile(r"\b(?:video game|game art|game character|game environment|"
                        r"pixel art|isometric game)\b", re.I),
    "modeling": re.compile(r"\b(?:runway|editorial portrait|fashion model|"
                          r"fashion photography|couture|fashion editorial|photoshoot)\b", re.I),
    "cinematic": re.compile(r"\b(?:cinematic photograph|cinematic film|film still|"
                           r"movie scene|cinematography|35mm film)\b", re.I),
    "cartoon": re.compile(r"\b(?:cartoon|animation|animated|anime|comic book|storybook)\b", re.I),
    "realistic": re.compile(r"\b(?:photorealistic|hyperrealistic|photography|"
                           r"photograph|realistic photo|macro photo)\b", re.I),
}


def main() -> None:
    query = """
        SELECT prompt
        FROM read_parquet(?)
        WHERE prompt_nsfw < 0.01 AND image_nsfw < 0.08
          AND length(prompt) BETWEEN 80 AND 450
          AND part_id % 2 = 0
        ORDER BY md5(prompt)
        LIMIT 500000
    """
    rows = duckdb.connect().execute(query, [SOURCE]).fetchall()
    collections: dict[str, list[dict[str, str]]] = {key: [] for key in KEYWORDS}
    seen: set[str] = set()
    used_titles: set[str] = set()
    for (raw,) in rows:
        prompt = " ".join(raw.split()).strip()
        normalized = prompt.casefold().rstrip(" .,;")
        if (
            normalized in seen
            or len(prompt.split()) < 12
            or UNSAFE.search(prompt)
            or LINK_OR_HANDLE.search(prompt)
            or IDENTITY_OR_FRANCHISE.search(prompt)
            or ARTIST_REFERENCE.search(prompt)
            or NAMED_CHARACTER.search(prompt[16:])
            or sum(c.isalpha() for c in prompt) / len(prompt) < 0.65
        ):
            continue
        seen.add(normalized)
        category = next((key for key, pattern in KEYWORDS.items()
                         if pattern.search(prompt) and len(collections[key]) < PER_CATEGORY), None)
        if not category:
            continue
        title = re.split(r"[,.;:!?]", prompt, maxsplit=1)[0].strip(" -\"'“”")
        title = " ".join(title.split()[:10])[:78].strip()
        if len(title) < 15 or title.casefold() in used_titles:
            continue
        used_titles.add(title.casefold())
        collections[category].append({
            "id": "diffusiondb-" + hashlib.sha256(normalized.encode()).hexdigest()[:20],
            "title": title,
            "category": category,
            "promptText": prompt,
        })
        if all(len(items) == PER_CATEGORY for items in collections.values()):
            break

    counts = {name: len(items) for name, items in collections.items()}
    if min(counts.values()) < PER_CATEGORY:
        raise RuntimeError(f"Not enough safe prompts for each category: {counts}")
    prompts = [item for entries in collections.values() for item in entries]
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(json.dumps(prompts, ensure_ascii=False, indent=2) + "\n")
    print(f"Saved {len(prompts)} curated CC0 prompts: {counts}")


if __name__ == "__main__":
    main()