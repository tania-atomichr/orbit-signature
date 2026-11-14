// Turns a photo into the moving signature picture, made in the browser with
// gifenc; nothing is uploaded. The photo sits in a circle, a rounded square or
// a square, on a small tile with see-through corners (so in a dark inbox it
// reads as a little card), with one of four designs around it: dots on two
// orbits, a comet running round, a pulse, or a still outline.

// 216px drawn, shown at 108 for sharp phone screens; 48 frames of 120ms is
// about 6 seconds a loop.
const W = 216, R = 80, C = W / 2, FRAMES = 48, DELAY = 120;

export const SHAPES = { circle: 2, rounded: 5, square: 12 }; // superellipse exponent
export const DESIGNS = ["orbit", "comet", "pulse", "still"];

function path(ctx, r, shape) {
  ctx.beginPath();
  if (shape === "circle") ctx.arc(C, C, r, 0, 2 * Math.PI);
  else if (ctx.roundRect) ctx.roundRect(C - r, C - r, 2 * r, 2 * r, shape === "rounded" ? r * 0.42 : r * 0.1);
  else ctx.rect(C - r, C - r, 2 * r, 2 * r);
}

// A point on the shape's outline at angle a, so dots follow a square as
// happily as a circle.
function at(a, r, shape) {
  const n = SHAPES[shape] || 2, c = Math.cos(a), s = Math.sin(a);
  return [C + r * Math.sign(c) * Math.abs(c) ** (2 / n), C + r * Math.sign(s) * Math.abs(s) ** (2 / n)];
}

function dot(ctx, [x, y], size, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, size, 0, 2 * Math.PI); ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawFrame(ctx, photo, t, o) {
  const { shape, design, accent, second, background } = o;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = background;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, W, W, 30); else ctx.rect(0, 0, W, W);
  ctx.fill();
  if (design === "orbit") {
    // [orbit, start angle, size, colour, turns per loop]: two orbits, one
    // each way, whole turns so the loop has no jump
    for (const d of [[R + 12, -Math.PI / 2, 7, accent, 1], [R + 12, Math.PI / 2, 9, second, 1],
      [R + 22, 0, 6, accent, -1], [R + 22, 2 * Math.PI / 3, 5, second, -1], [R + 22, 4 * Math.PI / 3, 4.5, accent, -1]]) {
      dot(ctx, at(d[1] + 2 * Math.PI * d[4] * t, d[0], shape), d[2], d[3]);
    }
  } else if (design === "comet") {
    ctx.strokeStyle = second; ctx.globalAlpha = 0.35; ctx.lineWidth = 3;
    path(ctx, R + 14, shape); ctx.stroke(); ctx.globalAlpha = 1;
    for (let k = 14; k >= 0; k--) {
      dot(ctx, at(2 * Math.PI * t - Math.PI / 2 - k * 0.09, R + 14, shape), 7 - k * 0.4, accent, 1 - k / 16);
    }
  } else if (design === "pulse") {
    for (const [off, col] of [[0, accent], [0.5, second]]) {
      const p = (t + off) % 1;
      ctx.strokeStyle = col; ctx.lineWidth = 6 - 4 * p; ctx.globalAlpha = 1 - p;
      path(ctx, R + 4 + 24 * p, shape); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = accent; ctx.lineWidth = 5;
    path(ctx, R + 9, shape); ctx.stroke();
  }
  ctx.save();
  path(ctx, R, shape); ctx.clip();
  const w = photo.naturalWidth || photo.width, h = photo.naturalHeight || photo.height;
  const s = Math.min(w, h);
  ctx.drawImage(photo, (w - s) / 2, (h - s) / 2, s, s, C - R, C - R, 2 * R, 2 * R);
  ctx.restore();
}

function rgb(hex) { return [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)); }

export function makeOrbitGif(lib, photo, o) {
  const opts = { shape: "circle", design: "orbit", accent: "#9140b0", second: "#f2c050", background: "#ffffff", ...o };
  if (!SHAPES[opts.shape]) opts.shape = "circle";
  if (!DESIGNS.includes(opts.design)) opts.design = "orbit";
  const frames = opts.design === "still" ? 1 : FRAMES;
  const cv = document.createElement("canvas");
  cv.width = cv.height = W;
  const ctx = cv.getContext("2d", { willReadFrequently: true });

  // the palette comes from a few frames, so fading rings keep their in-between colours
  const sample = [];
  for (const t of frames === 1 ? [0] : [0, 0.25, 0.5, 0.75]) {
    drawFrame(ctx, photo, t, opts);
    sample.push(ctx.getImageData(0, 0, W, W).data);
  }
  const all = new Uint8ClampedArray(sample.length * W * W * 4);
  sample.forEach((d, i) => all.set(d, i * W * W * 4));
  const palette = lib.quantize(all, 250, { format: "rgb444" });
  for (const c of [opts.background, opts.accent, opts.second]) palette.push(rgb(c));
  const T = palette.length; // one more entry: transparent
  const full = palette.concat([[0, 255, 0]]);

  // only what is around the photo changes: the photo is drawn once, in the
  // first frame, so it never shifts colour and the file stays small
  const m = document.createElement("canvas"); m.width = m.height = W;
  const mc = m.getContext("2d", { willReadFrequently: true });
  mc.fillStyle = "#000"; path(mc, R - 1, opts.shape); mc.fill();
  const inside = mc.getImageData(0, 0, W, W).data;

  const gif = lib.GIFEncoder();
  let prev = null;
  for (let i = 0; i < frames; i++) {
    drawFrame(ctx, photo, i / frames, opts);
    const px = ctx.getImageData(0, 0, W, W).data;
    const idx = lib.applyPalette(px, palette, "rgb444");
    const out = new Uint8Array(idx);
    for (let p = 0; p < idx.length; p++) {
      // the tile's corners stay see-through; after the first frame only
      // what changed around the photo is written
      if (px[p * 4 + 3] < 128 || (prev && (inside[p * 4 + 3] > 127 || idx[p] === prev[p]))) out[p] = T;
    }
    gif.writeFrame(out, W, W, { palette: i ? undefined : full, delay: DELAY,
      transparent: true, transparentIndex: T, dispose: 1 });
    // what the viewer now sees: unchanged pixels keep the previous frame's colour
    if (prev) for (let p = 0; p < idx.length; p++) if (out[p] === T) idx[p] = prev[p];
    prev = idx;
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
