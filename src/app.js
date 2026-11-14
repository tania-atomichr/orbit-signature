// The maker page: the photo studio and the email signature. It
// reads the form, paints the photo, makes the moving picture, keeps the
// pictures where inboxes can load them (src/storage.js) and copies the
// signature as rich text for Gmail, Outlook and Apple Mail. The form is
// remembered in this browser so a reload keeps your work.
import config from "./config.js";
import { buildSignature, isDark } from "./signature.js";
import { makeOrbitGif } from "./orbit.js";
import { BACKDROPS, brandBackdrops, logoColours, cutOut, cover, adjust, paint, blurred } from "./studio.js";
import { storageInfo, savePicture } from "./storage.js";
import * as gifenc from "../vendor/gifenc.esm.js";

const $ = (s) => document.querySelector(s);
const form = $("#maker");
const KEY = "orbit-signature/3";
const TEXT = ["name", "title", "company", "logo", "booking", "linkedin", "email", "website", "phone",
  "teamName", "teamEmail", "teamBooking", "teamPhone", "teamWebsite", "teamLinkedin",
  "photoUrl", "iconBase", "badge1", "badge2", "badge3", "badgeLink", "accent", "second",
  "light", "warmth", "zoom", "uploadKey"];
const RADIOS = ["shape", "design", "contact", "halo"];
const SWATCHES = {
  accent: [["#9140b0", "Purple"], ["#1a1a1f", "Black"], ["#a92e64", "Pink"], ["#1f7a6d", "Teal"], ["#2f5bd3", "Blue"], ["#e2553f", "Coral"]],
  second: [["#f2c050", "Yellow"], ["#9140b0", "Purple"], ["#1a1a1f", "Black"], ["#7fd1c0", "Mint"], ["#f4a3b4", "Rose"], ["#a0a0aa", "Grey"]],
};
// what config.person / config.team / config.brand fill in
const PREFILL = {
  person: { name: "name", title: "title", email: "email", linkedin: "linkedin", booking: "booking", website: "website", phone: "phone" },
  team: { name: "teamName", email: "teamEmail", booking: "teamBooking", phone: "teamPhone", website: "teamWebsite", linkedin: "teamLinkedin" },
  brand: { company: "company", logo: "logo", accent: "accent", second: "second" },
};

const state = {
  original: null,  // the photo as uploaded, square
  bg: null,        // the same square as the cut-out, from the photo as taken (for Blur)
  cut: null,       // the person on transparent, head anchored
  backdrop: "",    // "" = the original photo
  photo: null,     // the finished square photo (canvas)
  gif: null, gifUrl: "", gifHosted: "", gifJob: null,
  logoUrl: "", logoName: "logo.png", logoHosted: "", logoJob: null,
  logoImg: null, markImg: null, // for the shape behind the photo
  storage: { ok: false },
};

const val = (f) => form.elements[f]?.value ?? "";
const status = (t) => { $("#status").textContent = t; };
const studioSay = (t) => { $("#studio-status").textContent = t; };

/* ---- remembering the form ---- */
function store() {
  try {
    const d = { backdrop: state.backdrop };
    for (const f of [...TEXT, ...RADIOS]) d[f] = val(f);
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch (_) { /* private window: nothing to remember */ }
}
function storePictures() {
  try {
    if (state.logoUrl) localStorage.setItem(KEY + "/logo", state.logoUrl);
    if (state.markImg && state.markImg.src.startsWith("data:")) localStorage.setItem(KEY + "/mark", state.markImg.src);
    if (state.cut) localStorage.setItem(KEY + "/cut", state.cut.toDataURL("image/png"));
    if (state.bg) localStorage.setItem(KEY + "/bg", state.bg.toDataURL("image/jpeg", 0.8));
    if (state.original) localStorage.setItem(KEY + "/original", state.original.toDataURL("image/jpeg", 0.88));
  } catch (_) { /* too big or private: the photo just isn't remembered */ }
}
function restore() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { /* ignore */ }
  if (!d) return;
  for (const f of TEXT) if (typeof d[f] === "string" && d[f] !== "" && !isLocked(f)) form.elements[f].value = d[f];
  for (const f of RADIOS) {
    const r = form.querySelector(`input[name=${f}][value="${CSS.escape(d[f] || "")}"]`);
    if (r) r.checked = true;
  }
  if (typeof d.backdrop === "string") state.backdrop = d.backdrop;
}
async function restorePictures() {
  try {
    const cut = localStorage.getItem(KEY + "/cut"), orig = localStorage.getItem(KEY + "/original");
    const lg = localStorage.getItem(KEY + "/logo"), mk = localStorage.getItem(KEY + "/mark");
    if (lg) { state.logoUrl = lg; state.logoImg = await loadImage(lg); }
    if (mk) state.markImg = await loadImage(mk);
    if (orig) state.original = cover(await loadImage(orig));
    if (cut) { const im = await loadImage(cut); state.cut = cover(im); }
    const bg = localStorage.getItem(KEY + "/bg");
    if (bg) state.bg = cover(await loadImage(bg));
  } catch (_) { /* start fresh */ }
  if (state.original) { $("#studio").hidden = false; tiles(); repaint(); }
  render();
}

/* ---- what the portal set ---- */
const lockedFields = new Set();
function isLocked(f) { return lockedFields.has(f); }
function applyConfig() {
  for (const [group, map] of Object.entries(PREFILL)) {
    for (const [k, f] of Object.entries(map)) {
      const v = config[group]?.[k];
      if (typeof v === "string" && v) form.elements[f].value = v;
    }
  }
  if (config.brand?.backdrop) state.backdrop = config.brand.backdrop;
  // the portal's logo and symbol, for the shape behind the photo
  if (config.brand?.mark) loadImage(config.brand.mark).then((im) => { state.markImg = im; if (state.cut) tiles(); repaint(); }, () => {});
  if (config.brand?.logo) loadImage(config.brand.logo).then((im) => { state.logoImg = im; if (state.cut) tiles(); repaint(); }, () => {});
  for (const f of config.locked || []) {
    if (f === "team") Object.values(PREFILL.team).forEach((t) => lockedFields.add(t));
    else lockedFields.add(PREFILL.brand[f] || PREFILL.person[f] || f);
  }
  for (const f of lockedFields) {
    const el = form.elements[f];
    if (!el) continue;
    el.readOnly = true; el.disabled = el.type === "color";
    el.closest("label")?.classList.add("locked");
    el.closest(".colours")?.classList.add("locked");
  }
  if (lockedFields.has("logo")) {
    form.elements.logoFile.closest("label").hidden = true;
    form.elements.markFile.closest("label").hidden = true;
  }
}

/* ---- the photo studio ---- */
function loadImage(src) {
  return new Promise((ok, no) => {
    const im = new Image();
    // a portal's logo on its own CDN: asking for CORS keeps the canvas readable
    if (/^https?:/.test(src) && new URL(src).origin !== location.origin) im.crossOrigin = "anonymous";
    im.onload = () => ok(im); im.onerror = no; im.src = src;
  });
}
function readFile(file) {
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
}
function brandSet() { return brandBackdrops(val("accent"), val("second")); }
function backdrops() { return [...brandSet(), ...BACKDROPS]; }
// the symbol, else the logo: what goes behind the photo
function mark() { return state.markImg || state.logoImg; }
function backdrop(key) { return backdrops().find((b) => b.key === key); }
function touch() { return { light: +val("light"), warmth: +val("warmth"), zoom: +val("zoom") }; }

const BLUR = { key: "blur", label: "Blur" };
function finished(size) {
  if (state.backdrop === "blur" && state.cut && state.bg) return blurred(adjust(state.cut, touch()), adjust(state.bg, touch()), size);
  const b = state.cut && backdrop(state.backdrop);
  if (!b) {
    if (!state.original) return null;
    const c = document.createElement("canvas"); c.width = c.height = size;
    c.getContext("2d").drawImage(adjust(state.original, touch()), 0, 0, size, size);
    return c;
  }
  return paint(adjust(state.cut, touch()), b, size, val("halo"), mark());
}

function tile(b, small) {
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "tile"; btn.dataset.key = b.key;
  btn.setAttribute("aria-pressed", b.key === state.backdrop ? "true" : "false");
  let c;
  if (b.key === "blur") c = blurred(small, adjust(state.bg, { zoom: +val("zoom") }), 112);
  else if (b.key) c = paint(small, b, 112, val("halo"), mark());
  else { c = document.createElement("canvas"); c.width = c.height = 112; c.getContext("2d").drawImage(state.original, 0, 0, 112, 112); }
  c.setAttribute("aria-hidden", "true");
  const t = document.createElement("span"); t.textContent = b.label;
  btn.append(c, t);
  return btn;
}
// your brand's backdrops up front, the ready-made ones a press away
function tiles() {
  const small = state.cut ? adjust(state.cut, { zoom: +val("zoom") }) : null;
  $("#tiles").replaceChildren(...[{ key: "", label: "Original" }, ...(state.cut && state.bg ? [BLUR] : []), ...(state.cut ? brandSet() : [])].map((b) => tile(b, small)));
  const more = $("#more-backdrops"), open = more.getAttribute("aria-expanded") === "true" || BACKDROPS.some((b) => b.key === state.backdrop);
  more.hidden = !state.cut;
  more.setAttribute("aria-expanded", open ? "true" : "false");
  more.textContent = open ? "Fewer backdrops" : "More backdrops";
  $("#tiles-more").hidden = !state.cut || !open;
  $("#tiles-more").replaceChildren(...(state.cut && open ? BACKDROPS.map((b) => tile(b, small)) : []));
}
$("#more-backdrops").addEventListener("click", (e) => {
  e.currentTarget.setAttribute("aria-expanded", e.currentTarget.getAttribute("aria-expanded") === "true" ? "false" : "true");
  tiles();
});
$("#studio").addEventListener("click", (e) => {
  const t = e.target.closest(".tile");
  if (!t) return;
  state.backdrop = t.dataset.key;
  for (const b of document.querySelectorAll(".tile")) b.setAttribute("aria-pressed", b === t ? "true" : "false");
  repaint();
});

let paintTimer = 0;
function repaint() {
  clearTimeout(paintTimer);
  paintTimer = setTimeout(() => {
    state.photo = finished(480);
    $("#download-photo").disabled = !state.photo;
    makeGif();
    store();
  }, 60);
}

form.elements.photo.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  let img;
  try { img = await loadImage(await readFile(f)); } catch (_) { studioSay("That file isn't a picture this browser can read. Try a JPG or PNG."); return; }
  state.original = cover(img); state.cut = null; state.bg = null;
  if (!backdrop(state.backdrop) && state.backdrop !== "blur") state.backdrop = "";
  $("#studio").hidden = false;
  tiles(); repaint();
  studioSay("Cutting you out of the photo… (the first time takes a few seconds)");
  try {
    const timeout = new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 60000));
    state.cut = await Promise.race([cutOut(img, config.vendor), timeout]);
    state.bg = state.cut.bg || null;
    if (!state.backdrop) state.backdrop = "brand-soft";
    studioSay("");
  } catch (_) {
    studioSay("Couldn't cut this photo out here, so it stays as uploaded.");
  }
  tiles(); repaint(); storePictures();
});

/* ---- the moving picture and where it lives ---- */
// state.gifReady settles when the newest moving photo is made and, with
// storage, saved, so a copy never points at an older one
let gifTimer = 0, gifRun = 0, gifDone = null;
function makeGif() {
  clearTimeout(gifTimer);
  if (!state.photo) return;
  state.gifHosted = "";
  if (!gifDone) state.gifReady = new Promise((r) => { gifDone = r; });
  const finish = () => { if (gifDone) { gifDone(); gifDone = null; } };
  gifTimer = setTimeout(async () => {
    const run = ++gifRun;
    status("Making your moving photo…");
    await new Promise((r) => setTimeout(r, 20)); // let the message paint first
    if (run !== gifRun) return;
    const blob = makeOrbitGif(gifenc, state.photo, {
      shape: val("shape"), design: val("design"), accent: val("accent"), second: val("second"), background: "#ffffff",
    });
    state.gif = blob; state.gifUrl = await readFile(blob); state.gifHosted = "";
    $("#download-gif").disabled = false;
    render();
    if (state.storage.ok) {
      status("Saving your moving photo…");
      state.gifJob = savePicture(blob, val("uploadKey") || config.uploadKey)
        .then((u) => { if (run !== gifRun) return u; state.gifHosted = u; status("Ready to copy."); render(); finish(); return u; })
        .catch((e) => { status(e.message === "key" ? "That team key didn't work. Check it under Pictures on the web." : "Couldn't save your moving photo. Try again in a moment."); finish(); throw e; });
      state.gifJob.catch(() => {});
    } else {
      status(`Moving photo ready (${Math.round(blob.size / 1024)} KB).`);
      finish();
    }
  }, 250);
}

async function setLogo(file) {
  const url = await readFile(file);
  const img = await loadImage(url);
  state.logoUrl = url; state.logoName = file.name || "logo.png"; state.logoHosted = ""; state.logoImg = img;
  takeColours(img);
  storePictures();
  if (state.cut) tiles();
  repaint();
  render();
  if (state.storage.ok) {
    state.logoJob = savePicture(file, val("uploadKey") || config.uploadKey).then((u) => { state.logoHosted = u; render(); return u; });
    state.logoJob.catch(() => status("Couldn't save your logo. Try again in a moment."));
  }
}
// the brand's colours from its logo, unless the portal fixed them
function takeColours(img) {
  const [a, b] = logoColours(img);
  const note = $("#brand-note");
  if (!a) { note.textContent = ""; return; }
  const set = (f, v) => { if (v && !isLocked(f)) form.elements[f].value = v; };
  set("accent", a);
  set("second", b || (isDark(a) ? "#f2c050" : "#1a1a1f"));
  note.textContent = "We picked these colours from your logo. Change them below if they're not quite right.";
}

form.elements.markFile.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try { state.markImg = await loadImage(await readFile(f)); } catch (_) { status("That symbol isn't a picture this browser can read. Try a PNG."); return; }
  storePictures();
  const r = form.querySelector("input[name=halo][value=logo]"); if (r) r.checked = true;
  if (state.cut) tiles();
  repaint();
});

form.elements.logoFile.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) setLogo(f).catch(() => status("That logo isn't a picture this browser can read. Try a PNG."));
});

/* ---- the signature ---- */
function defaultIconBase() {
  if (state.storage.iconBase) return state.storage.iconBase;
  const here = new URL("icons/", location.href);
  return here.protocol === "https:" && !/^(localhost|127\.|0\.0\.0\.0)/.test(here.hostname) ? here.href : "";
}
// the preview always shows the icons next to this page (the same files); the
// copy points at the public address
function iconBase(forCopy) {
  const b = forCopy ? val("iconBase").trim() || defaultIconBase() : new URL("icons/", location.href).href;
  return b && !b.endsWith("/") ? b + "/" : b;
}
function data(forCopy) {
  const pick = (web, local) => (forCopy ? web || local : local || web);
  return {
    name: val("name"), title: val("title"), company: val("company"),
    logo: pick(state.logoHosted || val("logo").trim(), state.logoUrl),
    photo: pick(state.gifHosted || val("photoUrl").trim(), state.gifUrl),
    me: { booking: val("booking"), linkedin: val("linkedin"), email: val("email"), website: val("website"), phone: val("phone") },
    team: { name: val("teamName"), email: val("teamEmail"), booking: val("teamBooking"), phone: val("teamPhone"),
      website: val("teamWebsite"), linkedin: val("teamLinkedin") },
    contact: val("contact"), accent: val("accent"),
    badges: [val("badge1"), val("badge2"), val("badge3")].map((src) => ({ src, href: val("badgeLink") })),
  };
}

const HINTS = {
  me: "Your own links. Each one you fill in becomes a round button; leave the rest empty.",
  team: "The buttons reach your team, not you: handy when you share an inbox, like support. Your name still signs the email.",
  both: "Your own buttons first, then your team's, each row labelled.",
};

function render() {
  $("#preview").innerHTML = buildSignature(data(false), iconBase(false)).html;
  const c = val("contact");
  $("#me-links").hidden = c === "team";
  $("#team-links").hidden = c === "me";
  $("#contact-hint").textContent = HINTS[c] || HINTS.me;
  for (const box of document.querySelectorAll(".colours")) {
    const f = box.dataset.for, v = val(f).toLowerCase();
    let preset = false;
    for (const b of box.querySelectorAll(".sw-b")) {
      const on = b.dataset.v === v; preset ||= on;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    form.elements[f].classList.toggle("own", !preset);
  }
  store();
  warnings();
}

function warnings() {
  const w = [];
  if (!state.storage.ok) {
    if (state.gifUrl && !val("photoUrl").trim()) w.push("Your moving photo isn't on the web yet, so Gmail won't keep it. Download it, put it online and paste its address under Pictures on the web.");
    if (state.logoUrl && !val("logo").trim()) w.push("Same for your logo: download it, put it online and paste its address.");
    if (!iconBase(true)) w.push("The buttons' icons need a web address. Put this page on GitHub Pages, or paste where the icons live under Pictures on the web.");
  } else if (/^http:\/\/(localhost|127\.)/.test(defaultIconBase())) {
    w.push("This server runs at a local address, so other people's inboxes can't load the pictures. Set PUBLIC_URL to its public address.");
  }
  $("#warn").hidden = !w.length;
  $("#warn-list").innerHTML = w.map((t) => `<li>${t.replace(/</g, "&lt;")}</li>`).join("");
}

/* ---- the form ---- */
// these change the photo itself, the moving picture, or only the signature around it
const PHOTO = new Set(["light", "warmth", "zoom", "halo"]);
const GIF = new Set(["shape", "design"]);
form.addEventListener("input", (e) => {
  const n = e.target.name;
  if (e.target.type === "file") return;
  render();
  if (n === "accent" || n === "second") { if (state.cut) tiles(); repaint(); }
  else if (PHOTO.has(n)) { if (n !== "light" && n !== "warmth") tiles(); repaint(); }
  else if (GIF.has(n)) makeGif();
});
form.addEventListener("submit", (e) => e.preventDefault());

for (const box of document.querySelectorAll(".colours")) {
  const f = box.dataset.for;
  box.querySelector(".sws").innerHTML = SWATCHES[f].map(([v, label]) =>
    `<button type="button" class="sw-b" data-v="${v}" style="background:${v}" title="${label}" aria-label="${label}" aria-pressed="false"></button>`).join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".sw-b");
    if (!b || isLocked(f)) return;
    form.elements[f].value = b.dataset.v;
    form.elements[f].dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/* ---- downloads and copying ---- */
function save(href, name) {
  const a = document.createElement("a");
  a.href = href; a.download = name;
  document.body.append(a); a.click(); a.remove();
}
const slug = () => (val("name") || "signature").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "signature";
$("#download-photo").addEventListener("click", () => { const c = finished(720); if (c) save(c.toDataURL("image/png"), slug() + "-photo.png"); });
$("#download-gif").addEventListener("click", () => { if (state.gifUrl) save(state.gifUrl, slug() + "-moving-photo.gif"); });

async function copyRich(html, text) {
  if (navigator.clipboard && window.ClipboardItem) {
    return navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" }) })]);
  }
  // older browsers: put the copy on the page, select it and copy
  const tmp = document.createElement("div");
  tmp.style.cssText = "position:fixed;left:-9999px;top:0";
  tmp.innerHTML = html; document.body.append(tmp);
  const r = document.createRange(); r.selectNodeContents(tmp);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  const ok = document.execCommand("copy"); sel.removeAllRanges(); tmp.remove();
  if (!ok) throw new Error("copy");
}

// waits for pictures still on their way to storage, so what is copied points at them
async function forCopy() {
  if (state.storage.ok) {
    if (state.photo && !state.gifHosted) {
      status("Saving your pictures first…");
      await state.gifReady;
      if (!state.gifHosted) throw new Error("upload");
    }
    if (state.logoJob) await state.logoJob;
  }
  return buildSignature(data(true), iconBase(true) || iconBase(false));
}
$("#copy").addEventListener("click", async () => {
  try {
    const sig = await forCopy();
    await copyRich(sig.html, sig.text);
    status("Copied. Now paste it into your email app, as below.");
  } catch (e) {
    if (!/upload|key/.test(e.message)) status("Couldn't copy. Select the signature above and copy it yourself.");
  }
});
$("#copy-html").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText((await forCopy()).html); status("HTML copied."); }
  catch (_) { status("Couldn't copy the HTML."); }
});

// the Gmail, Outlook and Apple Mail steps, one at a time
const tabs = [...document.querySelectorAll("[role=tab]")];
function pick(tab, focus) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  if (focus) tab.focus();
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => pick(t));
  t.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    pick(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
  });
});

/* ---- start ---- */
applyConfig();
restore();
render();
restorePictures();
storageInfo().then((s) => {
  state.storage = s;
  $("#manual").hidden = s.ok;
  $("#key-box").hidden = !(s.ok && s.keyRequired && !config.uploadKey);
  $("#hosting").hidden = s.ok && $("#key-box").hidden;
  form.elements.iconBase.placeholder = defaultIconBase() || "https://you.github.io/orbit-signature/icons/";
  if (s.ok && state.gif) makeGif();
  render();
});
