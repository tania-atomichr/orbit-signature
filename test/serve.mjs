// A tiny static server for the tests and the docs script, so they need
// nothing but Node and Playwright.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".png": "image/png", ".gif": "image/gif", ".wasm": "application/wasm", ".woff2": "font/woff2" };

export async function serve(root) {
  const server = http.createServer(async (req, res) => {
    const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      const f = p.endsWith("/") ? join(p, "index.html") : p;
      const body = await readFile(f);
      res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}
