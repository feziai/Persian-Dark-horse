import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

function isPublicAddress(address: string): boolean {
  const value = address.toLowerCase().split("%")[0];
  if (value.startsWith("::ffff:")) return isPublicAddress(value.slice(7));
  if (isIP(value) === 4) {
    const [a, b, c] = value.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31
      || a === 192 && b === 168 || a === 192 && b === 0 && c === 0
      || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19));
  }
  if (isIP(value) !== 6) return false;
  return !(value === "::" || value === "::1" || value.startsWith("fc")
    || value.startsWith("fd") || value.startsWith("fe8")
    || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb"));
}

function textFromHtml(html: string): { title: string; content: string } {
  const title = (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 180);
  const content = html
    .replace(/<(script|style|svg|noscript|footer|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, (entity) =>
      ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ").trim();
  return { title, content: content.slice(0, 8500) };
}

/** Fetch only public HTTPS HTML; pin the validated DNS answer for this request. */
export async function readPublicSiteBrief(input: string, redirectsLeft = 2): Promise<{ title: string; content: string }> {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443"
    || url.hash || url.href.length > 1000 || url.hostname.endsWith(".local")
    || url.hostname === "localhost" || isIP(url.hostname)) {
    throw new Error("Only public HTTPS websites are supported.");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || !addresses.every((entry) => isPublicAddress(entry.address))) {
    throw new Error("The website does not resolve to a public address.");
  }
  const result = await new Promise<{ body?: string; redirect?: string }>((resolve, reject) => {
    const req = request(url, {
      method: "GET",
      headers: { accept: "text/html", "user-agent": "FEZI-PromptStudio/1.0" },
      timeout: 7000,
      // Pin the checked address: otherwise a second DNS lookup could resolve to a private host.
      lookup: (_host, _options, callback) => callback(null, addresses[0].address, addresses[0].family),
    }, (response) => {
      if ([301, 302, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
        response.resume();
        if (redirectsLeft <= 0) reject(new Error("The website redirected too many times."));
        else resolve({ redirect: new URL(response.headers.location, url).href });
        return;
      }
      if (response.statusCode !== 200 || !/^text\/html\b/i.test(String(response.headers["content-type"] ?? ""))) {
        response.resume();
        reject(new Error("The website did not return a public HTML page."));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 160_000) { req.destroy(new Error("The website page is too large.")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Website request timed out.")));
    req.on("error", reject);
    req.end();
  });
  if (result.redirect) return readPublicSiteBrief(result.redirect, redirectsLeft - 1);
  const brief = textFromHtml(result.body ?? "");
  if (brief.content.length < 40) throw new Error("The website did not provide enough readable content.");
  return brief;
}