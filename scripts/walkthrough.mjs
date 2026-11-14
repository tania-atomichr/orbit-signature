// Records the README's walkthrough: a made-up person fills in the page, adds a
// logo, uploads a photo, picks a backdrop and a design, then copies. Frames go
// to docs/.walk; scripts/walkthrough_gif.py stitches them into docs/walkthrough.gif.
// Run: node scripts/walkthrough.mjs && python3 scripts/walkthrough_gif.py
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = resolve(new URL("..", import.meta.url).pathname);
const out = join(root, "docs/.walk");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const port = 23457;
const child = spawn(process.execPath, [join(root, "server.mjs")], { env: { ...process.env, PORT: String(port), DATA_DIR: join(out, "data"), PUBLIC_URL: "https://signature.example.com" }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

let n = 0;
// each step is held for `hold` frames (110 ms each) so it can be read
async function shot(hold = 1) {
  for (let i = 0; i < hold; i++) {
    await page.screenshot({ path: join(out, `${String(n++).padStart(3, "0")}.png`) });
    await page.waitForTimeout(110);
  }
}
async function type(sel, text) {
  await page.click(sel);
  for (const ch of text.match(/.{1,3}/g)) { await page.keyboard.type(ch); await shot(); }
}
const ready = () => page.waitForFunction(() => /Ready to copy/.test(document.querySelector("#status").textContent), null, { timeout: 90000 });

await shot(8);
await type("[name=company]", "Northwind");
await page.setInputFiles("[name=logoFile]", join(root, "docs/sample-logo.png"));
await page.setInputFiles("[name=markFile]", join(root, "docs/sample-mark.png"));
await page.waitForTimeout(400);
await shot(10);
// the photo field sits lower; bring it into view with the preview beside it
await page.locator("[name=photo]").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -140));
await page.setInputFiles("[name=photo]", join(root, "docs/sample-photo.png"));
await page.waitForFunction(() => document.querySelectorAll("#tiles .tile").length >= 5, null, { timeout: 90000 });
await ready();
await shot(12);
for (const key of ["brand", "second-soft", "brand-soft"]) {
  if (!(await page.locator(`.tile[data-key=${key}]`).count())) continue;
  await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
  await page.click(`.tile[data-key=${key}]`);
  await ready();
  await shot(9);
}
await page.locator("[name=name]").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -120));
await type("[name=name]", "Alex Rivera");
await type("[name=title]", "Head of growth");
await page.locator("input[name=design][value=comet]").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -200));
for (const d of ["comet", "pulse", "orbit"]) {
  await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
  await page.check(`input[name=design][value=${d}]`, { force: true });
  await ready();
  await shot(12);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.click("#copy");
await page.waitForFunction(() => /Copied/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
await shot(22);

await browser.close();
child.kill();
console.log("walkthrough frames:", n);
