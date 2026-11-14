// Drives the real page in Chromium, twice: with its server (pictures are
// saved, copy and paste just works) and as plain files (people host their own
// pictures). Run: node test/e2e.mjs   (needs playwright)
import { spawn } from "node:child_process";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { serve } from "./serve.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = resolve(new URL("..", import.meta.url).pathname);
const photo = join(root, "docs/photos/brooke-balentine.jpg"), logo = join(root, "docs/sample-logo.png");
let n = 0;
const ok = (name) => { n++; console.log("ok -", name); };

async function startServer(env) {
  const data = await mkdtemp(join(tmpdir(), "orbit-"));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [join(root, "server.mjs")], { env: { ...process.env, PORT: String(port), DATA_DIR: data, ...env }, stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/config`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { url: `http://127.0.0.1:${port}/`, data, stop: () => child.kill() };
}

const browser = await chromium.launch();
async function newPage(init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  return page;
}
const statusIs = (page, re, timeout = 60000) =>
  page.waitForFunction((s) => new RegExp(s).test(document.querySelector("#status").textContent), re.source, { timeout });
const clipboard = (page) => page.evaluate(async () => {
  const [item] = await navigator.clipboard.read();
  return { html: await (await item.getType("text/html")).text(), text: await (await item.getType("text/plain")).text() };
});
async function fillBasics(page) {
  await page.fill("[name=name]", "Alex Rivera");
  await page.fill("[name=title]", "Head of growth");
  await page.fill("[name=company]", "Northwind");
  await page.fill("[name=booking]", "calendly.com/alex-rivera");
  await page.fill("[name=linkedin]", "linkedin.com/in/alex-rivera");
  await page.fill("[name=email]", "alex@northwind.example");
}

/* ---- with the server ---- */
{
  const srv = await startServer({ PUBLIC_URL: "https://sig.example.test" });
  const page = await newPage();
  await page.goto(srv.url);
  await fillBasics(page);
  assert(await page.isHidden("#hosting"));
  ok("with a server there is nothing to host by hand");

  await page.setInputFiles("[name=logoFile]", logo);
  await page.waitForFunction(() => document.querySelector("[name=accent]").value !== "#9140b0");
  // the sample logo is teal and yellow
  assert.match(await page.inputValue("[name=accent]"), /^#(1|2)[0-9a-f]7[0-9a-f]6[0-9a-f]$/);
  assert.match(await page.textContent("#brand-note"), /from your logo/);
  ok("a logo sets the brand colours");

  await page.setInputFiles("[name=photo]", photo);
  await page.waitForFunction(() => document.querySelectorAll("#tiles .tile").length === 7, null, { timeout: 90000 });
  assert.equal(await page.textContent("#studio-status"), "");
  assert.equal(await page.getAttribute(".tile[data-key=brand-soft]", "aria-pressed"), "true");
  assert.equal(await page.locator("#tiles .tile[data-key=blur]").count(), 1);
  ok("the photo is cut out onto the brand's own backdrops: Original, Blur + 5");
  await page.click("#more-backdrops");
  assert.equal(await page.locator("#tiles-more .tile").count(), 13);
  ok("13 more backdrops a press away");

  await page.click(".tile[data-key=purple]");
  await page.check("input[name=halo][value=asterisk]", { force: true });
  await page.fill("[name=light]", "0.3");
  await page.dispatchEvent("[name=light]", "input");
  assert.equal(await page.getAttribute(".tile[data-key=purple]", "aria-pressed"), "true");
  assert.equal(await page.getAttribute("#download-photo", "disabled"), null);
  ok("backdrop, halo and light change the photo");

  await statusIs(page, /Ready to copy/);
  await page.click("#copy");
  await statusIs(page, /Copied/);
  let clip = await clipboard(page);
  const gif = clip.html.match(/https:\/\/sig\.example\.test\/i\/([0-9a-f]{32}\.gif)/);
  assert(gif, "the moving photo points at the server");
  assert(clip.html.includes("https://sig.example.test/icons/light/linkedin.png"));
  assert(!clip.html.includes("data:"));
  assert((await readdir(srv.data)).includes(gif[1]));
  const res = await fetch(srv.url + "i/" + gif[1]);
  assert.equal(res.headers.get("content-type"), "image/gif");
  ok("copy and paste just works: pictures saved, every address public");

  await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
  await page.click("#copy");
  await statusIs(page, /Copied/);
  clip = await clipboard(page);
  assert.match(clip.html, /https:\/\/sig\.example\.test\/i\/[0-9a-f]{32}\.png" height="22" alt="Northwind"/);
  assert.equal(clip.text.split("\n")[1], "Head of growth at Northwind");
  ok("an uploaded logo is saved too and replaces the company name");

  // the server takes pictures only, small ones, and serves nothing else
  assert.equal((await fetch(srv.url + "api/images", { method: "POST", body: "<script>" })).status, 415);
  assert.equal((await fetch(srv.url + "api/images", { method: "POST", body: Buffer.alloc(1100 * 1024, 0x47) })).status, 413);
  for (const p of ["server.mjs", "package.json", "../etc/passwd", "data/", ".git/config", "i/../server.mjs"]) {
    assert.equal((await fetch(srv.url + p)).status, 404, p);
  }
  ok("server refuses non-pictures, big files and anything but the page's own files");
  assert.deepEqual(page.errors, []);
  srv.stop();
}

/* ---- with a team key ---- */
{
  const srv = await startServer({ UPLOAD_KEY: "open-sesame" });
  assert.equal((await fetch(srv.url + "api/images", { method: "POST", body: Buffer.from("GIF89a....") })).status, 401);
  const page = await newPage();
  await page.goto(srv.url);
  assert(await page.isVisible("#key-box"));
  await page.fill("[name=uploadKey]", "open-sesame");
  await page.setInputFiles("[name=logoFile]", logo);
  await page.waitForFunction(() => document.querySelector("#preview").innerHTML.includes("/i/"), null, { timeout: 10000 }).catch(() => {});
  assert.equal((await readdir(srv.data)).length, 1);
  ok("a server with a team key asks for it once and saves with it");
  srv.stop();
}

/* ---- inside a portal: details filled in, brand locked ---- */
{
  const srv = await startServer({});
  const page = await newPage(() => {
    window.ORBIT_SIGNATURE = {
      person: { name: "Sam Lee", title: "Support lead", email: "sam@northwind.example" },
      team: { name: "Support team", email: "support@northwind.example" },
      brand: { company: "Northwind", accent: "#1f7a6d" },
      locked: ["company", "accent"],
    };
  });
  await page.goto(srv.url);
  assert.equal(await page.inputValue("[name=name]"), "Sam Lee");
  assert.equal(await page.inputValue("[name=accent]"), "#1f7a6d");
  assert(await page.getAttribute("[name=company]", "readonly") !== null);
  await page.check("input[name=contact][value=team]", { force: true });
  assert.equal(await page.locator('#preview a[href="mailto:support@northwind.example"]').count(), 1);
  assert.equal(await page.locator('#preview a[href="mailto:sam@northwind.example"]').count(), 0);
  ok("a portal fills in the person and team, and locks its brand");
  srv.stop();
}

/* ---- as plain files (GitHub Pages) ---- */
{
  const { server, url } = await serve(root);
  const page = await newPage();
  await page.goto(url);
  await fillBasics(page);
  await page.fill("[name=website]", "javascript:alert(1)");
  assert.equal(await page.locator("#preview img[alt=Website]").count(), 0);
  ok("an unsafe website link is left out");
  assert(await page.isVisible("#manual"));
  await page.setInputFiles("[name=photo]", photo);
  await statusIs(page, /Moving photo ready/, 90000);
  assert(await page.isVisible("#warn"));
  ok("without a server it says what to host");
  await page.fill("[name=photoUrl]", "https://cdn.example/alex.gif");
  await page.fill("[name=iconBase]", "https://cdn.example/icons");
  await page.click("#copy");
  await statusIs(page, /Copied/);
  const clip = await clipboard(page);
  assert(clip.html.includes('src="https://cdn.example/alex.gif"'));
  assert(clip.html.includes("https://cdn.example/icons/light/linkedin.png"));
  assert(await page.isHidden("#warn"));
  ok("with addresses pasted in, the copy uses them and the warnings clear");

  for (const [shape, design] of [["rounded", "comet"], ["square", "pulse"], ["circle", "still"], ["circle", "orbit"]]) {
    await page.check(`input[name=shape][value=${shape}]`, { force: true });
    await page.check(`input[name=design][value=${design}]`, { force: true });
    await statusIs(page, /Moving photo ready/);
  }
  ok("every shape and design makes a moving picture");

  assert.equal(await page.locator("#preview table").first().getAttribute("bgcolor"), null);
  // a white tile, its corners see-through
  const px = await page.evaluate(async () => {
    const img = document.querySelector("#preview img[width='108']");
    await img.decode();
    const c = document.createElement("canvas"); c.width = c.height = 216;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, 216, 216);
    return [x.getImageData(1, 1, 1, 1).data[3], [...x.getImageData(14, 14, 1, 1).data].slice(0, 3)];
  });
  assert.equal(px[0], 0);
  assert(px[1].every((v) => v > 240), String(px[1]));
  ok("the photo sits on a white tile with see-through corners; the signature has no background");

  await page.check("input[name=contact][value=both]", { force: true });
  await page.fill("[name=teamName]", "Support team");
  await page.fill("[name=teamEmail]", "support@northwind.example");
  assert.match(await page.textContent("#preview"), /Support team/);
  ok("team buttons show in Both mode");

  await page.reload();
  assert.equal(await page.inputValue("[name=name]"), "Alex Rivera");
  await page.waitForFunction(() => document.querySelectorAll("#tiles .tile").length === 7, null, { timeout: 10000 });
  ok("the form and the photo are remembered after a reload");

  await page.click("#tab-outlook");
  assert(await page.isVisible("#p-outlook") && await page.isHidden("#p-gmail"));
  ok("email app tabs switch");

  for (const w of [1280, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth) <= w, `no sideways scroll at ${w}`);
  }
  ok("no sideways scroll at 1280 or 390");
  assert.deepEqual(page.errors, []);
  ok("no page errors");
  server.close();
}

await browser.close();
console.log(`${n} checks passed`);
