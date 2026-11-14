// The one place pictures leave the browser. The moving photo and the logo
// must live at a public address for inboxes to load them; a portal swaps
// savePicture() for its own storage (S3, R2, its own API) and nothing else
// changes. Keep it to these two functions.
import config from "./config.js";

let probe = null;

// Is there somewhere to save pictures? Resolves to { ok, keyRequired, iconBase }.
export function storageInfo() {
  if (probe) return probe;
  if (!config.storage) return (probe = Promise.resolve({ ok: false }));
  if (config.storage !== "auto") return (probe = Promise.resolve({ ok: true }));
  probe = fetch(new URL("api/config", location.href), { headers: { accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.upload ? { ok: true, keyRequired: !!j.keyRequired, iconBase: j.iconBase || "" } : { ok: false }))
    .catch(() => ({ ok: false }));
  return probe;
}

// Saves one picture and resolves to its public address.
export async function savePicture(blob, key = config.uploadKey) {
  const url = config.storage === "auto" ? new URL("api/images", location.href) : config.storage;
  const res = await fetch(url, {
    method: "POST", body: blob,
    headers: { "content-type": blob.type || "application/octet-stream", ...(key ? { "x-upload-key": key } : {}) },
  });
  if (res.status === 401) throw new Error("key");
  if (!res.ok) throw new Error("upload " + res.status);
  const j = await res.json();
  if (!j.url) throw new Error("upload: no url");
  return j.url;
}
