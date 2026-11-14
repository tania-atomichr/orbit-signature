// The optional server: serves the page and keeps the pictures (moving photo,
// logo) at a public address, so people copy the signature and paste it with
// nothing to download or host. Run it once for a team; everyone uses it.
// Node 18+, no dependencies. Settings come from the environment:
//   PORT          port to listen on (8080)
//   PUBLIC_URL    the address people reach this at, e.g. https://sig.example.com
//                 (pictures in emails point here, so it must be public)
//   DATA_DIR      where pictures are kept (./data)
//   UPLOAD_KEY    optional: a shared key people enter once before saving pictures
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(new URL(".", import.meta.url).pathname);
const PORT = Number(process.env.PORT || 8080);
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const DATA = resolve(process.env.DATA_DIR || join(ROOT, "data"));
const KEY = process.env.UPLOAD_KEY || "";
const MAX = 1024 * 1024; // a moving photo is ~50-90 KB; a logo far less
const PER_HOUR = 60;     // uploads per address per hour

// What may be served from the repository folder: the page and its own files,
// never the server, the data folder or dotfiles.
const PUBLIC = /^\/(index\.html|src\/[\w.-]+\.(js|css)|vendor\/[\w.-]+\.(js|onnx)|vendor\/ort\/[\w.-]+\.(js|mjs|wasm)|fonts\/[\w.-]+\.woff2|icons\/(favicon\.png|(light|dark)\/[\w-]+\.png))$/;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".woff2": "font/woff2",
  ".png": "image/png", ".gif": "image/gif", ".jpg": "image/jpeg", ".webp": "image/webp" };

// Pictures are checked by their first bytes, not by what the browser claims.
function kind(b) {
  if (b.subarray(0, 6).toString("latin1").match(/^GIF8[79]a$/)) return "gif";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return "";
}

const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now); hits.set(ip, list);
  return list.length > PER_HOUR;
}

function keyOk(given) {
  if (!KEY) return true;
  const a = Buffer.from(String(given || "")), b = Buffer.from(KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

function base(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return `${proto}://${req.headers.host}`;
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", ...headers });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { "content-type": "application/json", "cache-control": "no-store" });

async function readBody(req) {
  const chunks = []; let n = 0;
  // an oversized body is read to the end (up to a hard stop) before the 413,
  // because closing mid-upload makes the sender see a reset instead of the answer
  for await (const c of req) {
    n += c.length;
    if (n > 8 * MAX) break;
    if (n <= MAX) chunks.push(c);
  }
  if (n > MAX) throw Object.assign(new Error("too big"), { code: 413 });
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://x").pathname;
    if (req.method === "GET" && path === "/api/config") {
      return json(res, 200, { upload: true, keyRequired: !!KEY, iconBase: base(req) + "/icons/" });
    }
    if (req.method === "POST" && path === "/api/images") {
      if (!keyOk(req.headers["x-upload-key"])) return json(res, 401, { error: "key" });
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
      if (limited(ip)) return json(res, 429, { error: "too many" });
      const body = await readBody(req);
      const ext = kind(body);
      if (!ext) return json(res, 415, { error: "not a picture" });
      // named by their content: the same picture twice is one file, and an
      // address can't be guessed or overwritten
      const name = createHash("sha256").update(body).digest("hex").slice(0, 32) + "." + ext;
      await mkdir(DATA, { recursive: true });
      const file = join(DATA, name);
      try { await access(file); } catch { await writeFile(file, body); }
      return json(res, 200, { url: `${base(req)}/i/${name}` });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "");
    const pic = path.match(/^\/i\/([0-9a-f]{32}\.(gif|png|jpg|webp))$/);
    if (pic) {
      const body = await readFile(join(DATA, pic[1]));
      return send(res, 200, body, { "content-type": TYPES["." + pic[2]], "cache-control": "public, max-age=31536000, immutable",
        "access-control-allow-origin": "*" });
    }
    const p = path === "/" ? "/index.html" : path;
    if (!PUBLIC.test(p)) return send(res, 404, "Not found");
    const body = await readFile(join(ROOT, p));
    return send(res, 200, body, { "content-type": TYPES[extname(p)] || "application/octet-stream",
      "cache-control": /^\/(icons|fonts|vendor)\//.test(p) ? "public, max-age=86400" : "no-cache" });
  } catch (e) {
    if (e.code === 413) return json(res, 413, { error: "too big" });
    if (e.code === "ENOENT") return send(res, 404, "Not found");
    console.error(e);
    return send(res, 500, "");
  }
});

server.listen(PORT, () => {
  console.log(`Orbit signature on http://localhost:${PORT}` + (PUBLIC_URL ? ` (public address ${PUBLIC_URL})` : ""));
  if (!PUBLIC_URL) console.log("Set PUBLIC_URL to the address people reach this at, so pictures load in their inboxes.");
});
