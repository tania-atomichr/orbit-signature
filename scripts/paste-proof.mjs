// Pastes a copied signature into an email the way a person does (Copy
// signature, then Ctrl+V into a message body), then checks each button is
// its own link and that the signature has no box behind it. Writes docs/paste-test.png and prints every link it finds.
// Run: node scripts/paste-proof.mjs
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = resolve(new URL("..", import.meta.url).pathname);
const data = join(root, "docs/.paste");
const port = 23458;
const child = spawn(process.execPath, [join(root, "server.mjs")], { env: { ...process.env, PORT: String(port), DATA_DIR: data, PUBLIC_URL: `http://127.0.0.1:${port}` }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

await page.fill("[name=name]", "Alex Rivera");
await page.fill("[name=title]", "Head of growth");
await page.fill("[name=company]", "Northwind");
await page.setInputFiles("[name=logoFile]", join(root, "docs/sample-logo.png"));
await page.fill("[name=booking]", "calendly.com/alex-rivera");
await page.fill("[name=linkedin]", "linkedin.com/in/alex-rivera");
await page.fill("[name=email]", "alex@northwind.example");
await page.fill("[name=website]", "northwind.example");
await page.setInputFiles("[name=photo]", join(root, "docs/sample-photo.png"));
await page.waitForFunction(() => /Ready to copy/.test(document.querySelector("#status").textContent), null, { timeout: 90000 });
await page.click("#copy");
await page.waitForFunction(() => /Copied/.test(document.querySelector("#status").textContent));

// two message bodies, a light inbox and a dark one; the paste is a real Ctrl+V
const mail = await ctx.newPage();
await mail.setViewportSize({ width: 1280, height: 700 });
await mail.goto(`http://127.0.0.1:${port}/`); // same origin, so the pictures load
await mail.setContent(`<!doctype html><html><head><style>
  body{margin:0;font:14px Arial,sans-serif;background:#eef0f3;padding:24px}
  .m{max-width:760px;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08);background:#fff}
  .bar{padding:10px 16px;font-weight:bold;background:#404b5a;color:#fff}
  .hd{padding:10px 16px;border-bottom:1px solid #e3e3e3;color:#555}
  .body{padding:18px 16px 28px;min-height:250px;outline:none}
  .proof a{outline:2px dashed #e0457b;outline-offset:3px}
  .tag{position:absolute;font:11px/1.3 Arial;background:#e0457b;color:#fff;padding:2px 6px;border-radius:4px;white-space:nowrap}
</style></head><body>
<div class="m"><div class="bar">New message</div><div class="hd">To: someone@example.com</div><div class="body" contenteditable id="a">Hi Sam,<br><br>Thanks for your time today.<br><br>Best,<br><br></div></div>
</body></html>`);
const mod = process.platform === "darwin" ? "Meta" : "Control";
for (const id of ["a"]) {
  await mail.click(`#${id}`);
  await mail.keyboard.press(`${mod}+End`);
  await mail.keyboard.press(`${mod}+V`);
}
await mail.waitForTimeout(1500);

// each button: the thing under its middle is its own picture, inside its own link
const report = await mail.evaluate(() => [...document.querySelectorAll("#a a")].map((a) => {
  const r = a.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { href: a.getAttribute("href"), label: a.title || a.textContent.trim(), own: hit?.closest("a") === a };
}));
const boxed = await mail.evaluate(() => [...document.querySelectorAll("#a table, #a td")].some((e) =>
  e.querySelector("td") && (e.getAttribute("bgcolor") || /background/.test(e.getAttribute("style") || ""))));
// mark each link and write where it goes, for the picture
await mail.evaluate(() => {
  document.body.classList.add("proof");
  [...document.querySelectorAll("#a a")].forEach((a, i) => {
    const r = a.getBoundingClientRect(), t = document.createElement("div");
    t.className = "tag"; t.textContent = (i + 1) + ". " + a.getAttribute("href").replace(/^mailto:/, "");
t.style.left = "430px"; t.style.top = (r.top - 50 + i * 22) + "px";
    document.body.append(t);
  });
});
await mail.screenshot({ path: join(root, "docs/paste-test.png"), clip: { x: 0, y: 0, width: 808, height: 410 } });
console.log(JSON.stringify({ links: report, boxBehindSignature: boxed }, null, 1));
await browser.close();
child.kill();
await rm(data, { recursive: true, force: true });
if (report.length < 4 || !report.every((l) => l.own) || boxed) process.exit(1);
