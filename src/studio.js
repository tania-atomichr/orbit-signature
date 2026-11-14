// The photo studio: cuts the person out of their photo in the browser with a
// small segmentation model (u2netp, 4.5 MB, run by onnxruntime-web, both in
// vendor/), then paints them onto a backdrop on a canvas. Nothing is uploaded.
//
// The look: the backdrop's glow behind the head, a halo shape behind it, a key
// light pooled behind the head with the corners falling into shade, and a
// soft shadow in the backdrop's own colour, as from one big window light.
// Positions are fractions of the square photo, anchored to the head, so every
// face sits in the same place.

export const SIDE = 720; // the cut-out, square

// Where the head sits in the square, and the halo behind it (fractions of the side)
const HEAD_TOP = 0.119, HEAD_CX = 0.539, SIDE_PER_HEAD = 4.65;
const HALO = { cx: 0.587, cy: 0.327, box: 0.783 };
const GLOW = { cx: 0.446, cy: 0.346, r: 0.972 };
const SHADOW = { dx: 0.06, dy: 0.03, blur: 0.07, k: 0.42, fadeTop: 0.12, fadeEnd: 0.75 };

// edge: the paper's colour at the corners; glow: behind the head; halo: the
// shape's colour and k its strength; ring: pale ones get a coloured ring on
// round photos so they don't melt into a white page
export const BACKDROPS = [
  { key: "purple", label: "Purple", edge: "#3e1450", glow: "#7d3a99", halo: "#a968c4", k: 0.22, ring: false },
  { key: "white", label: "White", edge: "#e9e6ee", glow: "#ffffff", halo: "#e6d3f0", k: 0.65, ring: true },
  { key: "lilac", label: "Lilac", edge: "#dcc6ea", glow: "#f6eefb", halo: "#ffffff", k: 0.70, ring: true },
  { key: "yellow", label: "Yellow", edge: "#e0a93a", glow: "#f8d27a", halo: "#fde7b0", k: 0.45, ring: false },
  { key: "green", label: "Green", edge: "#6fae4a", glow: "#a9d98a", halo: "#d6efc4", k: 0.40, ring: false },
  { key: "pink", label: "Pink", edge: "#c9568a", glow: "#f0a2c4", halo: "#f9d3e4", k: 0.40, ring: false },
  { key: "blue", label: "Blue", edge: "#3f93b8", glow: "#8ccbe4", halo: "#cfeaf5", k: 0.40, ring: false },
  { key: "orange", label: "Orange", edge: "#d9862a", glow: "#f0b464", halo: "#fbdcb0", k: 0.40, ring: false },
  { key: "softyellow", label: "Soft yellow", edge: "#f3dfa6", glow: "#fdf6e2", halo: "#ffffff", k: 0.70, ring: true },
  { key: "softgreen", label: "Soft green", edge: "#cfe6c0", glow: "#f2f9ec", halo: "#ffffff", k: 0.70, ring: true },
  { key: "softpink", label: "Soft pink", edge: "#f1cadb", glow: "#fcf0f5", halo: "#ffffff", k: 0.70, ring: true },
  { key: "softblue", label: "Soft blue", edge: "#c6e3f0", glow: "#eff8fc", halo: "#ffffff", k: 0.70, ring: true },
  { key: "softorange", label: "Soft orange", edge: "#f5d2a8", glow: "#fdf1e4", halo: "#ffffff", k: 0.70, ring: true },
];
export const HALOS = ["logo", "circle", "asterisk", "star", "none"];

const hexRgb = (h) => [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const rgb = (c) => `rgb(${c.map(Math.round).join(",")})`;
const rgba = (c, a) => `rgba(${c.map(Math.round).join(",")},${a})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function lum(h) {
  const c = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// A backdrop made from any colour, in the same recipe as the ready-made
// ones: "strong" is the colour itself, deepened at the corners; "soft" is a
// pale wash of it that keeps a ring, like White and Lilac.
export function colourBackdrop(color, key, label, soft) {
  const c = hexRgb(color);
  if (soft) {
    return { key, label, edge: toHex(mix(c, [255, 255, 255], 0.72)), glow: toHex(mix(c, [255, 255, 255], 0.93)),
      halo: "#ffffff", k: 0.7, ring: true };
  }
  const pale = lum(color) > 0.6;
  return { key, label,
    edge: toHex(mix(c, [0, 0, 0], pale ? 0.06 : 0.3)), glow: toHex(mix(c, [255, 255, 255], pale ? 0.6 : 0.35)),
    halo: toHex(mix(c, [255, 255, 255], 0.6)), k: pale ? 0.6 : 0.3, ring: pale };
}
export const brandBackdrop = (color) => colourBackdrop(color, "brand", "Your colour", false);

// The backdrops made from a brand: both colours strong and soft, and a white
// with the brand's tint, so every brand gets a set like the ready-made one.
export function brandBackdrops(accent, second) {
  const list = [colourBackdrop(accent, "brand", "Brand", false), colourBackdrop(accent, "brand-soft", "Brand soft", true)];
  if (second && second.toLowerCase() !== accent.toLowerCase()) {
    list.push(colourBackdrop(second, "second", "Second", false), colourBackdrop(second, "second-soft", "Second soft", true));
  }
  const c = hexRgb(accent);
  list.push({ key: "brand-white", label: "Brand white", edge: toHex(mix(c, [255, 255, 255], 0.88)), glow: "#ffffff",
    halo: toHex(mix(c, [255, 255, 255], 0.8)), k: 0.65, ring: true });
  return list;
}

// The brand's colours, read off its logo: the most used colourful shade,
// then the most used one of a clearly different hue. Greys, near-white and
// near-black are the logo's ink and paper, not its colours.
export function logoColours(img) {
  const size = 96, c = canvas(size, size), x = c.getContext("2d", { willReadFrequently: true });
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(size / w, size / h);
  x.drawImage(img, 0, 0, w * k, h * k);
  let d;
  try { d = x.getImageData(0, 0, size, size).data; } catch (_) { return []; } // a picture from another site without CORS
  const buckets = new Map();
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] < 200) continue;
    const r = d[p], g = d[p + 1], b = d[p + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 40 || mx < 40 || mn > 225) continue;
    const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b; buckets.set(key, e);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
  const hue = ([r, g, b]) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn || 1;
    const hh = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    return (hh * 60 + 360) % 360;
  };
  const out = [];
  for (const c2 of ranked) {
    if (!out.length) { out.push(c2); continue; }
    const dh = Math.abs(hue(c2) - hue(out[0]));
    if (Math.min(dh, 360 - dh) > 35) { out.push(c2); break; }
  }
  return out.map(toHex);
}

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

/* ---- the model ---- */
let ortReady = null;
export function loadModel(base) {
  if (ortReady) return ortReady;
  ortReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = base + "ort/ort.wasm.min.js";
    s.onload = () => {
      window.ort.env.wasm.wasmPaths = base + "ort/";
      window.ort.env.wasm.numThreads = 1; // threads need cross-origin isolation most pages don't have
      window.ort.InferenceSession.create(base + "u2netp.onnx", { executionProviders: ["wasm"] }).then(resolve, reject);
    };
    s.onerror = reject;
    document.head.append(s);
  });
  ortReady.catch(() => { ortReady = null; });
  return ortReady;
}

// separable box blur of a Float32Array (w*h, `ch` interleaved channels)
function boxBlur(src, w, h, ch, r) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length), n = 2 * r + 1;
  for (let c = 0; c < ch; c++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let i = -r; i <= r; i++) acc += src[(row + Math.min(w - 1, Math.max(0, i))) * ch + c];
      for (let x = 0; x < w; x++) {
        tmp[(row + x) * ch + c] = acc / n;
        acc += src[(row + Math.min(w - 1, x + r + 1)) * ch + c] - src[(row + Math.max(0, x - r)) * ch + c];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let j = -r; j <= r; j++) acc += tmp[(Math.min(h - 1, Math.max(0, j)) * w + x) * ch + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * ch + c] = acc / n;
        acc += tmp[(Math.min(h - 1, y + r + 1) * w + x) * ch + c] - tmp[(Math.max(0, y - r) * w + x) * ch + c];
      }
    }
  }
  return out;
}

// drops the bits the model kept that aren't the person (a chair, a lamp)
function keepLargest(m, w, h) {
  const lab = new Int32Array(w * h), stack = [];
  let best = 0, bestN = 0, id = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s]) continue;
    id++; let n = 0; stack.push(s); lab[s] = id;
    while (stack.length) {
      const p = stack.pop(); n++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && m[p - w] && !lab[p - w]) { lab[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && m[p + w] && !lab[p + w]) { lab[p + w] = id; stack.push(p + w); }
    }
    if (n > bestN) { bestN = n; best = id; }
  }
  for (let q = 0; q < w * h; q++) if (m[q] && lab[q] !== best) m[q] = 0;
}

// the model's rough mask -> a soft alpha with real hair edges, and the
// background's colour taken back out of those edge pixels
function refine(px, mask, w, h) {
  const N = w * h, I = new Float32Array(N * 3), bgw = new Float32Array(N), sure = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    I[p * 3] = px[p * 4] / 255; I[p * 3 + 1] = px[p * 4 + 1] / 255; I[p * 3 + 2] = px[p * 4 + 2] / 255;
    bgw[p] = mask[p] < 0.1 ? 1 : 0;
    sure[p] = mask[p] > 0.5 ? 1 : 0;
  }
  // the largest confident blob is the person; something touching them only
  // through soft pixels falls away with it
  const core = new Uint8Array(N);
  for (let p = 0; p < N; p++) core[p] = mask[p] > 0.9 ? 1 : 0;
  keepLargest(core, w, h);
  const cf = new Float32Array(N); for (let p = 0; p < N; p++) cf[p] = core[p];
  const reach = boxBlur(cf, w, h, 1, Math.max(2, Math.round(w / 120)));
  for (let p = 0; p < N; p++) if (sure[p] && reach[p] <= 0) { sure[p] = 0; bgw[p] = 1; }
  // the wall behind them, smoothed, filled in under the person
  const R = Math.max(8, Math.round(w / 27));
  const weighted = new Float32Array(N * 3);
  for (let p = 0; p < N; p++) for (let c = 0; c < 3; c++) weighted[p * 3 + c] = I[p * 3 + c] * bgw[p];
  const num = boxBlur(weighted, w, h, 3, R), den = boxBlur(bgw, w, h, 1, R);
  const plate = new Float32Array(N * 3), have = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    if (den[p] > 1e-3) { have[p] = 1; for (let c = 0; c < 3; c++) plate[p * 3 + c] = num[p * 3 + c] / den[p]; }
  }
  for (let pass = 0; pass < 3; pass++) {
    const pw = new Float32Array(N * 3);
    for (let p = 0; p < N; p++) for (let c = 0; c < 3; c++) pw[p * 3 + c] = plate[p * 3 + c] * have[p];
    const n2 = boxBlur(pw, w, h, 3, R), d2 = boxBlur(have, w, h, 1, R);
    for (let p = 0; p < N; p++) if (!have[p] && d2[p] > 1e-3) { have[p] = 1; for (let c = 0; c < 3; c++) plate[p * 3 + c] = n2[p * 3 + c] / d2[p]; }
  }
  const sf = new Float32Array(N); for (let p = 0; p < N; p++) sf[p] = sure[p];
  const near = boxBlur(sf, w, h, 1, Math.max(3, Math.round(w / 180)));
  const soft = boxBlur(mask, w, h, 1, 2);
  let a = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    if (near[p] > 0.02 && near[p] < 0.98) { // the edge band: how far the pixel is from the wall
      const dr = I[p * 3] - plate[p * 3], dg = I[p * 3 + 1] - plate[p * 3 + 1], db = I[p * 3 + 2] - plate[p * 3 + 2];
      const d = Math.sqrt(dr * dr + dg * dg + db * db);
      a[p] = Math.min(Math.min(1, Math.max(0, (d - 0.05) / 0.25)), Math.min(1, soft[p] * 2));
    } else a[p] = sure[p];
  }
  a = boxBlur(a, w, h, 1, 1);
  const out = new Uint8ClampedArray(N * 4);
  for (let p = 0; p < N; p++) {
    const al = a[p], aa = Math.max(al, 0.05);
    for (let c = 0; c < 3; c++) {
      const v = al > 0.98 ? I[p * 3 + c] : (I[p * 3 + c] - (1 - aa) * plate[p * 3 + c]) / aa;
      out[p * 4 + c] = Math.round(Math.min(1, Math.max(0, v)) * 255);
    }
    out[p * 4 + 3] = Math.round(al * 255);
  }
  return out;
}

// the photo as uploaded: centred, cropped to a square
export function cover(img, size = SIDE) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, s = Math.min(w, h);
  const c = canvas(size, size);
  c.getContext("2d").drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  return c;
}

// the square around the head, so every face sits in the same place
function frame(person, rgbaPx, w, h) {
  let top = 0;
  for (top = 0; top < h; top++) {
    let row = 0;
    for (let x = 0; x < w; x++) if (rgbaPx[(top * w + x) * 4 + 3] > 128) row++;
    if (row > w * 0.01) break;
  }
  const band = Math.max(4, Math.round(h * 0.1));
  let ls = 0, rs = 0, n = 0;
  for (let y = top; y < Math.min(h, top + band); y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (rgbaPx[(y * w + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
    if (l >= 0) { ls += l; rs += r; n++; }
  }
  const headW = n ? (rs - ls) / n : w / 4, cx = n ? (ls + rs) / 2 / n : w / 2;
  let side = Math.max(Math.min(w, h) * 0.6, headW * SIDE_PER_HEAD);
  let x0 = cx - HEAD_CX * side, y0 = top - HEAD_TOP * side;
  side = Math.min(side, w, h);
  y0 = Math.max(0, Math.min(y0, h - side)); // never a gap under the shoulders
  x0 = Math.max(0, Math.min(x0, w - side));
  const c = canvas(SIDE, SIDE);
  c.getContext("2d").drawImage(person, x0, y0, side, side, 0, 0, SIDE, SIDE);
  return c;
}

export async function cutOut(img, base) {
  const session = await loadModel(base);
  const ort = window.ort;
  const scale = Math.min(1, 1080 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const full = canvas(w, h), fx = full.getContext("2d", { willReadFrequently: true });
  fx.drawImage(img, 0, 0, w, h);
  const small = canvas(320, 320), sx = small.getContext("2d", { willReadFrequently: true });
  sx.drawImage(img, 0, 0, 320, 320);
  const d = sx.getImageData(0, 0, 320, 320).data, input = new Float32Array(3 * 320 * 320);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for (let i = 0; i < 320 * 320; i++) for (let c = 0; c < 3; c++) input[c * 320 * 320 + i] = (d[i * 4 + c] / 255 - mean[c]) / std[c];
  const res = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, 320, 320]) });
  const m = res[session.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < m.length; k++) { lo = Math.min(lo, m[k]); hi = Math.max(hi, m[k]); }
  const mc = canvas(320, 320), mx = mc.getContext("2d"), md = mx.createImageData(320, 320);
  for (let k = 0; k < m.length; k++) {
    const v = Math.round((m[k] - lo) / (hi - lo || 1) * 255);
    md.data[k * 4] = md.data[k * 4 + 1] = md.data[k * 4 + 2] = v; md.data[k * 4 + 3] = 255;
  }
  mx.putImageData(md, 0, 0);
  const up = canvas(w, h), ux = up.getContext("2d", { willReadFrequently: true });
  ux.imageSmoothingQuality = "high"; ux.drawImage(mc, 0, 0, w, h);
  const ud = ux.getImageData(0, 0, w, h).data, mask = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) mask[k] = ud[k * 4] / 255;
  const px = fx.getImageData(0, 0, w, h).data;
  const out = refine(px, mask, w, h);
  const person = canvas(w, h); person.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
  return frame(person, out, w, h);
}

/* ---- touch-ups: light, warmth, zoom ---- */
// light and warmth are -1..1, zoom 0.8..1.4 around the head
export function adjust(src, { light = 0, warmth = 0, zoom = 1 } = {}) {
  const size = src.width, c = canvas(size, size), x = c.getContext("2d", { willReadFrequently: true });
  const ax = HEAD_CX * size, ay = (HEAD_TOP + 0.18) * size; // about the middle of the face
  x.translate(ax, ay); x.scale(zoom, zoom); x.translate(-ax, -ay);
  x.drawImage(src, 0, 0);
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (light || warmth) {
    const id = x.getImageData(0, 0, size, size), d = id.data;
    const gain = 1 + light * 0.35, lift = light * 12, warm = warmth * 18;
    for (let p = 0; p < d.length; p += 4) {
      if (!d[p + 3]) continue;
      d[p] = d[p] * gain + lift + warm;
      d[p + 1] = d[p + 1] * gain + lift + warm * 0.25;
      d[p + 2] = d[p + 2] * gain + lift - warm;
    }
    x.putImageData(id, 0, 0);
  }
  return c;
}

/* ---- the backdrop ---- */
// the brand's own mark, tone on tone: its shape filled with the halo colour
function haloLogo(x, mark, size, color, k) {
  const w = mark.naturalWidth || mark.width, h = mark.naturalHeight || mark.height;
  const box = HALO.box * size * 0.92, s = Math.min(box / w, box / h), dw = w * s, dh = h * s;
  const t = canvas(Math.ceil(dw), Math.ceil(dh)), tx = t.getContext("2d");
  tx.drawImage(mark, 0, 0, dw, dh);
  tx.globalCompositeOperation = "source-in"; tx.fillStyle = color; tx.fillRect(0, 0, dw, dh);
  x.save(); x.globalAlpha = k;
  x.shadowColor = color; x.shadowBlur = 0.012 * size;
  x.drawImage(t, HALO.cx * size - dw / 2, HALO.cy * size - dh / 2);
  x.restore();
}

function haloShape(x, kind, size, color, k, mark) {
  if (kind === "none") return;
  if (kind === "logo") {
    if (mark) return haloLogo(x, mark, size, color, k);
    kind = "circle";
  }
  const u = HALO.box * size / 100;
  x.save();
  x.translate(HALO.cx * size, HALO.cy * size); x.scale(u, u); x.translate(-50, -50);
  x.globalAlpha = k; x.fillStyle = color;
  x.shadowColor = color; x.shadowBlur = 0.012 * size; // shadow blur ignores the scale above
  if (kind === "asterisk") {
    // six square-ended spokes
    for (let a = 0; a < 3; a++) {
      x.save(); x.translate(50, 50); x.rotate(a * Math.PI / 3); x.translate(-50, -50);
      x.fillRect(40, 6, 20, 88); x.restore();
    }
  } else if (kind === "star") {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 20 : 46, a = -Math.PI / 2 + i * Math.PI / 5;
      x.lineTo(50 + r * Math.cos(a), 50 + r * Math.sin(a));
    }
    x.closePath(); x.fill();
  } else {
    x.beginPath(); x.arc(50, 50, 40, 0, 2 * Math.PI); x.fill();
  }
  x.restore();
}

// paints the cut-out person on a backdrop; returns a size x size canvas
export function paint(cut, b, size, halo = "circle", mark = null) {
  const c = canvas(size, size), x = c.getContext("2d");
  const edge = hexRgb(b.edge), glow = hexRgb(b.glow);
  // the glow behind the head falls off as (1 - d/r)^1.2, in stops
  const g = x.createRadialGradient(GLOW.cx * size, GLOW.cy * size, 0, GLOW.cx * size, GLOW.cy * size, GLOW.r * size);
  for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, rgb(mix(edge, glow, (1 - i / 8) ** 1.2)));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  haloShape(x, halo, size, b.halo, b.k, mark);
  // studio light on the paper: a key light pooled behind the head, corners
  // falling into shade, darker toward the floor
  const lite = mix(glow, [255, 255, 255], 0.35), deep = edge.map((v) => v * 0.62);
  x.save(); x.globalCompositeOperation = "soft-light";
  const spot = x.createRadialGradient(0.47 * size, 0.30 * size, 0, 0.47 * size, 0.30 * size, 0.55 * size);
  spot.addColorStop(0, rgba(lite, 0.9)); spot.addColorStop(1, rgba(lite, 0));
  x.fillStyle = spot; x.fillRect(0, 0, size, size); x.restore();
  const fall = x.createRadialGradient(0.5 * size, 0.40 * size, 0.30 * size, 0.5 * size, 0.42 * size, 0.78 * size);
  fall.addColorStop(0, rgba(deep, 0)); fall.addColorStop(1, rgba(deep, 0.55));
  x.fillStyle = fall; x.fillRect(0, 0, size, size);
  const floor = x.createLinearGradient(0, 0.7 * size, 0, size);
  floor.addColorStop(0, rgba(deep, 0)); floor.addColorStop(1, rgba(deep, 0.25));
  x.fillStyle = floor; x.fillRect(0, 0, size, size);
  // the shadow they throw on the paper: one big soft light from the left, so
  // a wide faint shadow to the right, strongest at the shoulders and gone by
  // the top of the head (a hard offset copy looks fake)
  const shade = edge.map((v) => v * 0.5);
  const sil = canvas(size, size), sx = sil.getContext("2d");
  sx.drawImage(cut, 0, 0, size, size);
  sx.globalCompositeOperation = "source-in"; sx.fillStyle = rgb(shade); sx.fillRect(0, 0, size, size);
  const lay = canvas(size, size), lx = lay.getContext("2d");
  // drawn far off the canvas so only its blurred shadow lands (canvas shadows
  // blur in every browser; ctx.filter doesn't, in older Safari)
  lx.shadowColor = rgb(shade); lx.shadowBlur = SHADOW.blur * size;
  lx.shadowOffsetX = SHADOW.dx * size + 10000; lx.shadowOffsetY = SHADOW.dy * size;
  lx.drawImage(sil, -10000, 0);
  const fade = lx.createLinearGradient(0, SHADOW.fadeTop * size, 0, SHADOW.fadeEnd * size);
  fade.addColorStop(0, "rgba(0,0,0,.25)"); fade.addColorStop(1, "rgba(0,0,0,1)");
  lx.globalCompositeOperation = "destination-in"; lx.fillStyle = fade; lx.fillRect(0, 0, size, size);
  x.save(); x.globalAlpha = SHADOW.k; x.drawImage(lay, 0, 0); x.restore();
  x.drawImage(cut, 0, 0, size, size);
  return c;
}
