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

await set({ name: "Alex Rivera", title: "Head of growth", company: "Northwind", quote: "I help teams hire *faster*. Ask me anything.",
  booking: "calendly.com/alex-rivera", linkedin: "linkedin.com/in/alex-rivera", email: "alex@northwind.example",
  website: "northwind.example", teamName: "Support team", teamEmail: "support@northwind.example",
  teamBooking: "calendly.com/northwind-support", teamWebsite: "help.northwind.example" });
// the made-up brand first: its colours come from the logo
await page.setInputFiles("[name=logoFile]", join(root, "docs/sample-logo.png"));
await page.setInputFiles("[name=markFile]", join(root, "docs/sample-mark.png"));
await page.locator("form fieldset.card").first().screenshot({ path: join(docs, "brand.png") });
await page.setInputFiles("[name=photo]", join(root, "docs/sample-photo.png"));
await page.waitForFunction(() => document.querySelectorAll("#tiles .tile").length >= 5, null, { timeout: 90000 });
await ready();

// the looks: the same person in four styles
const LOOKS = [
  ["brand-orbit", { background: "#ffffff", shape: "circle", design: "orbit", contact: "me", backdrop: "brand-soft", halo: "logo" }],
  ["brand-comet", { background: "#fdf3dc", shape: "rounded", design: "comet", contact: "me", backdrop: "brand", halo: "logo" }],
  ["night-pulse", { background: "#1a1a1f", accent: "#f2c050", second: "#9140b0", shape: "square", design: "pulse", contact: "me", backdrop: "purple", halo: "asterisk" }],
  ["pink-still", { background: "#f3e9f7", accent: "#a92e64", second: "#a92e64", shape: "circle", design: "still", contact: "me", backdrop: "softpink", halo: "none" }],
];
let f = 0;
for (const [name, o] of LOOKS) {
  await look(o);
  await card().screenshot({ path: join(docs, `look-${name}.png`) });
  // the moving picture itself, as the inbox shows it
  const gif = await page.evaluate(() => document.querySelector("#preview img[width='108']").src);
  await writeFile(join(docs, "designs", `${o.design}.gif`), Buffer.from(gif.split(",")[1], "base64"));
  // frames for the demo: ~1.6s of each look
  for (let i = 0; i < 14; i++) {
    await card().screenshot({ path: join(frames, `${String(f++).padStart(3, "0")}.png`), scale: "css" });
    await page.waitForTimeout(110);
  }
}

// who people reach
await set({ accent: "#1f7a6d", second: "#f2c050" });
await look(LOOKS[0][1]);
for (const c of ["me", "team", "both"]) {
  await set({ contact: c });
  await page.waitForTimeout(100);
  await card().screenshot({ path: join(docs, `contact-${c}.png`) });
}


// the studio: the backdrops, and the card, in the brand's colours
await set({ accent: "#1f7a6d", second: "#f2c050" });
await look(LOOKS[0][1]);
await page.locator("#studio").screenshot({ path: join(docs, "studio.png") });
await page.locator("#card-prev").screenshot({ path: join(docs, "card.png") });

// the whole page, at a desk and on a phone (a viewport as tall as the page,
// so the sticky preview sits where it would)
await page.evaluate(() => { document.querySelector(".side").style.position = "static"; });
for (const w of [1280, 390]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.screenshot({ path: join(docs, `page-${w}.png`), fullPage: true });
}

// GitHub's social preview: 1280x640
await page.setViewportSize({ width: 1280, height: 640 });
await page.setContent(`<!doctype html><html><head><style>@font-face{font-family:"League Spartan";font-weight:900;src:url("${url}fonts/league-spartan-900.woff2")}</style></head>
<body style="margin:0;width:1280px;height:640px;background:#1a1a1f;display:flex;align-items:center;font-family:'League Spartan',Arial,sans-serif">
<div style="padding:0 90px;flex:1">
<div style="color:#F2C050;font-size:30px;font-weight:900;margin-bottom:14px">Orbit signature</div>
<div style="color:#fff;font-size:68px;line-height:1.02;font-weight:700;letter-spacing:-1px;font-weight:900">A signature<br>that moves,<br>in every email</div>
<div style="color:#b4b4bc;font-size:26px;margin-top:22px;font-family:Arial,sans-serif">Free, open source, runs in your browser</div></div>
<div style="padding-right:150px;transform:scale(1.45);transform-origin:right center">${await card().evaluate((e) => e.outerHTML)}</div></body></html>`.replace('src="data:', 'src="data:'));
await page.waitForTimeout(800);
await page.screenshot({ path: join(docs, "social-preview.png"), scale: "css" });

await browser.close();
child.kill();
console.log("docs pictures written");
