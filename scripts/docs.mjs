// Makes the pictures in docs/ from the real page, with a made-up person and
// company: the page at 1280 and 390, a gallery of looks, the contact modes,
// each moving design, and frames for the README's demo GIF (stitched by
// scripts/demo_gif.py). Run: node scripts/docs.mjs && python3 scripts/demo_gif.py
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = resolve(new URL("..", import.meta.url).pathname);
const docs = join(root, "docs");
const frames = join(root, "docs/.frames");
await rm(frames, { recursive: true, force: true });
await mkdir(join(docs, "designs"), { recursive: true });
await mkdir(frames, { recursive: true });
// the real server, so the photo studio and saving work as for a team
const port = 23456;
const child = spawn(process.execPath, [join(root, "server.mjs")], { env: { ...process.env, PORT: String(port), DATA_DIR: join(frames, "data"), PUBLIC_URL: "https://signature.example.com" }, stdio: "ignore" });
process.on("exit", () => child.kill()); // a failed step must not leave the server running
await new Promise((r) => setTimeout(r, 800));
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.goto(url);

const ready = () => page.waitForFunction(() => /Ready to copy/.test(document.querySelector("#status").textContent), null, { timeout: 60000 });
async function set(o) {
  for (const [k, v] of Object.entries(o)) {
    if (k === "backdrop") continue;
    if (["shape", "design", "contact", "halo"].includes(k)) await page.check(`input[name=${k}][value=${v}]`, { force: true });
    // hidden fields (the team's, in "Me" mode) are set directly
    else await page.evaluate(([n, x]) => {
      const el = document.querySelector(`[name=${n}]`); el.value = x;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, [k, v]);
  }
}
async function look(o) {
  await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
  await set(o);
  if (o.backdrop) {
    if (!(await page.locator(`.tile[data-key=${o.backdrop}]`).count())) await page.click("#more-backdrops");
    await page.click(`.tile[data-key=${o.backdrop}]`);
  }
  await ready();
  await page.waitForTimeout(300);
}
const card = () => page.locator("#preview > table");
// the preview is redrawn as pictures finish saving, so a shot can miss it once
async function snap(o) {
  for (let i = 0; ; i++) {
    try { return await card().screenshot(o); } catch (e) { if (i > 4) throw e; await page.waitForTimeout(300); }
  }
}

await set({ name: "Alex Rivera", title: "Head of growth", company: "Northwind",
  booking: "calendly.com/alex-rivera", linkedin: "linkedin.com/in/alex-rivera", email: "alex@northwind.example",
  website: "northwind.example", teamName: "Support team", teamEmail: "support@northwind.example",
  teamBooking: "calendly.com/northwind-support", teamWebsite: "help.northwind.example" });
// the made-up brand first: its colours come from the logo
await page.setInputFiles("[name=logoFile]", join(root, "docs/sample-logo.png"));
await page.setInputFiles("[name=markFile]", join(root, "docs/sample-mark.png"));
await page.locator("form fieldset.card").first().screenshot({ path: join(docs, "brand.png") });
await page.setInputFiles("[name=photo]", join(root, "docs/photos/brooke-balentine.jpg"));
await page.waitForFunction(() => document.querySelectorAll("#tiles .tile").length >= 5, null, { timeout: 90000 });
await ready();

// the looks: the same person in four styles
const LOOKS = [
  ["brand-orbit", { shape: "circle", design: "orbit", contact: "me", backdrop: "brand-soft", halo: "logo" }],
  ["brand-comet", { shape: "rounded", design: "comet", contact: "me", backdrop: "brand", halo: "logo" }],
  ["purple-ripple", { accent: "#9140b0", second: "#f2c050", shape: "circle", design: "pulse", contact: "me", backdrop: "purple", halo: "asterisk" }],
  ["pink-still", { accent: "#a92e64", second: "#f2c050", shape: "rounded", design: "still", contact: "me", backdrop: "softpink", halo: "none" }],
];
let f = 0;
for (const [name, o] of LOOKS) {
  await look(o);
  await snap({ path: join(docs, `look-${name}.png`) });
  // the moving picture itself, as the inbox shows it
  const gif = await page.evaluate(() => document.querySelector("#preview img[width='108']").src);
  await writeFile(join(docs, "designs", `${o.design}.gif`), Buffer.from(gif.split(",")[1], "base64"));
  // frames for the demo: ~1.6s of each look
  for (let i = 0; i < 14; i++) {
    await snap({ path: join(frames, `${String(f++).padStart(3, "0")}.png`), scale: "css" });
    await page.waitForTimeout(110);
  }
}

// who people reach
await set({ accent: "#1f7a6d", second: "#f2c050" });
await look(LOOKS[0][1]);
for (const c of ["me", "team", "both"]) {
  await set({ contact: c });
  await page.waitForTimeout(100);
  await snap({ path: join(docs, `contact-${c}.png`) });
}


// the studio: the backdrops, in the brand's colours
await set({ accent: "#1f7a6d", second: "#f2c050" });
await look(LOOKS[0][1]);
await page.locator("#studio").screenshot({ path: join(docs, "studio.png") });

// the whole page, at a desk and on a phone (a viewport as tall as the page,
// so the sticky preview sits where it would)
await page.evaluate(() => { document.querySelector(".side").style.position = "static"; });
for (const w of [1280, 390]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.screenshot({ path: join(docs, `page-${w}.png`), fullPage: true });
}

// GitHub's social preview: 1280x640
await page.setViewportSize({ width: 1280, height: 640 });
await page.setContent(`<!doctype html><html><head><style>@font-face{font-family:"League Spartan";font-weight:100 900;src:url("${url}fonts/league-spartan.woff2")}</style></head>
<body style="margin:0;width:1280px;height:640px;background:#f7f7f5;color:#111;display:flex;align-items:center;font-family:'League Spartan',Arial,sans-serif">
<div style="padding:0 0 0 90px;flex:1">
<div style="display:inline-flex;align-items:center;gap:12px;font-size:26px;font-weight:800;margin-bottom:22px"><span style="background:#111;color:#fff;border-radius:999px;padding:6px 16px 4px;font-size:17px;font-weight:700">Orbit</span>Orbit signature</div>
<div style="font-size:72px;line-height:1.02;font-weight:800;letter-spacing:-1px">A signature<br>that <span style="color:#9140B0">moves</span>,<br>in every email.</div>
<div style="color:#4b4b4b;font-size:26px;margin-top:22px">Free, open source, runs in your browser</div></div>
<div style="margin-right:80px;background:#fff;border:1px solid #e3e3e3;border-radius:28px;padding:34px 40px;box-shadow:0 18px 50px rgba(0,0,0,.08)"><div style="transform:scale(1.25);transform-origin:left top;width:430px;height:150px">${await card().evaluate((e) => e.outerHTML)}</div></div></body></html>`);
await page.waitForTimeout(800);
await page.screenshot({ path: join(docs, "social-preview.png"), scale: "css" });

await page.goto(url);
await page.setViewportSize({ width: 1280, height: 900 });
// three people, three looks: one blurs their own background
const PEOPLE = [
  ["philip-white.jpg", "Sam Ortiz", "Customer success", "blur", "circle", "orbit"],
  ["brooke-balentine.jpg", "Alex Rivera", "Head of growth", "brand-soft", "circle", "comet"],
  ["devin-santiago.jpg", "Jordan Lee", "Talent partner", "second", "rounded", "pulse"],
];
const shots = [];
for (const [file, name, title, bd, shape, design] of PEOPLE) {
  await set({ name, title, shape, design, contact: "me" });
  await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
  await page.evaluate(() => { document.querySelector("#tiles").replaceChildren(); });
  await page.setInputFiles("[name=photo]", join(root, "docs/photos", file));
  await page.waitForFunction(() => !/Cutting/.test(document.querySelector("#studio-status").textContent) && document.querySelector(".tile[data-key=blur]"), null, { timeout: 90000 });
  await page.click(`.tile[data-key=${bd}]`);
  await ready(); await page.waitForTimeout(300);
  shots.push(await snap());
}
// stacked into one picture
await page.setContent(`<body style="margin:0"><div id="ppl" style="background:#fff;padding:18px 22px;display:inline-grid;gap:24px">${shots.map((b) => `<img src="data:image/png;base64,${b.toString("base64")}" onload="this.style.width=this.naturalWidth/2+'px'">`).join("")}</div></body>`);
await page.waitForTimeout(300);
await page.locator("#ppl").screenshot({ path: join(docs, "people.png") });
await browser.close();
child.kill();
console.log("docs pictures written");
