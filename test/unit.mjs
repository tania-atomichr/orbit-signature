// Plain-node checks of the signature builder: escaping, unsafe links, and
// the plain-text copy. Run: node test/unit.mjs
import assert from "node:assert/strict";
import { buildSignature, safeHref, isDark } from "../src/signature.js";

const base = "https://example.com/icons/";
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok -", name); };

ok("name and title are escaped", () => {
  const { html } = buildSignature({ name: '<img src=x onerror=alert(1)>', title: 'A & "B"' }, base);
  assert(!html.includes("<img src=x"));
  assert(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert(html.includes("A &amp; &quot;B&quot;"));
});

ok("javascript: links never reach the signature", () => {
  assert.equal(safeHref("javascript:alert(1)"), "");
  const { html } = buildSignature({ name: "A", me: { website: "javascript:alert(1)" }, logo: "javascript:x", photo: "javascript:y" }, base);
  assert(!/javascript:/i.test(html));
});

ok("bare addresses get https:// and email/phone get their schemes", () => {
  const { html } = buildSignature({ name: "A", me: { linkedin: "linkedin.com/in/a", email: "a@b.co", phone: "+1 (555) 010-0" } }, base);
  assert(html.includes('href="https://linkedin.com/in/a"'));
  assert(html.includes('href="mailto:a@b.co"'));
  assert(html.includes('href="tel:+15550100"'));
  assert(html.includes(base + "light/linkedin.png"));
});

ok("empty links leave no icon", () => {
  const { html } = buildSignature({ name: "A" }, base);
  assert(!html.includes(".png"));
});

ok("plain text spells out the company and each link", () => {
  const { text } = buildSignature({ name: "Alex", title: "Lead", company: "Northwind", logo: "https://x/l.png", me: { email: "a@b.co" } }, base);
  assert.equal(text, "Alex\nLead at Northwind\nEmail: a@b.co");
});

ok("at most three badges", () => {
  const b = { src: "https://x/b.png", href: "https://x" };
  const { html } = buildSignature({ name: "A", badges: [b, b, b, b] }, base);
  assert.equal(html.split("https://x/b.png").length - 1, 3);
});

ok("team mode: buttons reach the team, the person still signs", () => {
  const d = { name: "Tania", me: { email: "me@x.co" }, team: { name: "Support team", email: "support@x.co" } };
  const t = buildSignature({ ...d, contact: "team" }, base).html;
  assert(t.includes("mailto:support@x.co") && !t.includes("mailto:me@x.co"));
  assert(t.includes(">Tania<") && t.includes("Support team"));
  const b = buildSignature({ ...d, contact: "both" }, base);
  assert(b.html.includes("mailto:me@x.co") && b.html.includes("mailto:support@x.co") && b.html.includes(">Me<"));
  assert(b.text.includes("Email (Support team): support@x.co"));
  const m = buildSignature({ ...d, contact: "me" }, base).html;
  assert(!m.includes("support@x.co"));
});

ok("dark backgrounds get light text, light brand colours get dark icons", () => {
  assert(isDark("#1a1a1f") && !isDark("#ffffff") && !isDark("#f2c050"));
  const dk = buildSignature({ name: "A", background: "#1a1a1f", accent: "#f2c050", me: { email: "a@b.co" } }, base).html;
  assert(dk.includes("color:#ffffff") && dk.includes("dark/mail.png") && dk.includes('bgcolor="#f2c050"'));
  const bad = buildSignature({ name: "A", background: "red;x", accent: "url(x)" }, base).html;
  assert(bad.includes('bgcolor="#ffffff"') && !bad.includes("url(x)"));
});

console.log(`${n} checks passed`);
