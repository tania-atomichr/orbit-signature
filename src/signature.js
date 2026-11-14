// Builds the signature itself: the HTML that goes on the clipboard and a
// plain-text copy for mail set to plain text. Mail apps keep only tables and
// inline styles, drop web fonts and SVG, and often block images, so the text
// is Arial, the icons are PNGs and every image has alt text. The card's
// background is set twice (bgcolor and style) because Outlook reads one and
// Gmail the other.

const FONT = "font-family:Arial,Helvetica,sans-serif";

export const LINKS = [
  // [field, icon file, label, how the href is made]
  ["booking", "calendar", "Book a call", (v) => v],
  ["linkedin", "linkedin", "LinkedIn", (v) => v],
  ["email", "mail", "Email", (v) => "mailto:" + v],
  ["website", "website", "Website", (v) => v],
  ["phone", "phone", "Phone", (v) => "tel:" + v.replace(/[^\d+]/g, "")],
];
const WEB = new Set(["booking", "linkedin", "website"]);

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Only web, mail and phone addresses become links, and only web or inline
// pictures become images, so a pasted "javascript:" never reaches an inbox.
export function safeHref(href) {
  const h = String(href || "").trim();
  return /^(https?:|mailto:|tel:)/i.test(h) ? h : "";
}
export function safeSrc(src) {
  const s = String(src || "").trim();
  return /^(https?:|data:image\/(png|gif|jpeg|webp);)/i.test(s) ? s : "";
}

export function hex(c, fallback) {
  return /^#[0-9a-f]{6}$/i.test(c || "") ? c.toLowerCase() : fallback;
}

// Relative luminance, to pick dark or light text and icon glyphs.
export function isDark(c) {
  const [r, g, b] = [1, 3, 5].map((o) => {
    const v = parseInt(c.slice(o, o + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
}

function normalise(field, raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  if (WEB.has(field)) {
    if (/^https?:\/\//i.test(v)) return v;
    // some other scheme (javascript:, data:, ftp:) is not a web page
    if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v)) return "";
    v = "https://" + v.replace(/^\/+/, "");
  }
  return v;
}

function linkList(src, iconBase, glyph, who) {
  const out = [];
  for (const [field, icon, label, href] of LINKS) {
    const v = normalise(field, src && src[field]);
    const h = v && safeHref(href(v));
    if (h) out.push({ icon: `${iconBase}${glyph}/${icon}.png`, href: h, label: who ? `${label} (${who})` : label, shown: v });
  }
  return out;
}

/**
 * d: { name, title, company, logo, photo, badges: [{src, href}],
 *      me: {booking, linkedin, email, website, phone},
 *      team: {name, booking, linkedin, email, website, phone},
 *      contact: "me" | "team" | "both", background, accent }
 * iconBase: address of the folder holding icons/light and icons/dark.
 */
export function buildSignature(d, iconBase) {
  const bg = hex(d.background, "#ffffff");
  const accent = hex(d.accent, "#1a1a1f");
  const dark = isDark(bg);
  const ink = dark ? "#ffffff" : "#1a1a1f";
  const ink2 = dark ? "#d6d6dc" : "#45454d";
  const ink3 = dark ? "#b4b4bc" : "#6b6b75";
  const glyph = isDark(accent) ? "light" : "dark";

  const contact = ["me", "team", "both"].includes(d.contact) ? d.contact : "me";
  const teamName = String(d.team?.name || "").trim();
  const mine = contact === "team" ? [] : linkList(d.me, iconBase, glyph, "");
  const team = contact === "me" ? [] : linkList(d.team, iconBase, glyph, teamName);

  const name = String(d.name || "").trim();
  const title = String(d.title || "").trim();
  const company = String(d.company || "").trim();
  const logo = safeSrc(d.logo);
  const photo = safeSrc(d.photo);
  const badges = (d.badges || []).filter((b) => safeSrc(b.src)).slice(0, 3);

  let who = "";
  if (title && (company || logo)) who = esc(title) + " at ";
  else if (title) who = esc(title);
  if (logo) {
    who += `<img src="${esc(logo)}" height="22" alt="${esc(company || "Company logo")}" style="display:inline;height:22px;width:auto;vertical-align:-6px;border:0">`;
  } else if (company) {
    who += `<b style="color:${ink}">${esc(company)}</b>`;
  }

  const badgeHtml = badges.map((b, i) => {
    const img = `<img src="${esc(b.src)}" height="20" alt="" style="display:inline;height:20px;width:auto;vertical-align:-3px;border:0;margin:0 0 0 ${i ? "2px" : "7px"}">`;
    const href = safeHref(b.href);
    return href ? `<a href="${esc(href)}" style="text-decoration:none">${img}</a>` : img;
  }).join("");

  // A round tile per link: the colour is the cell's background, so one set of
  // icon pictures works for any brand colour. Outlook on Windows ignores
  // border-radius and shows square tiles, which still read fine.
  const icons = (links) => links.map((l, i) =>
    `<td bgcolor="${accent}" width="30" height="30" style="width:30px;height:30px;background:${accent};border-radius:15px;padding:0"><a href="${esc(l.href)}" title="${esc(l.label)}" style="text-decoration:none;display:block"><img src="${esc(l.icon)}" width="30" height="30" alt="${esc(l.label)}" style="display:block;width:30px;height:30px;border:0;${FONT};font-size:7px;line-height:8px;color:${ink};text-align:center"></a></td>` +
    (i < links.length - 1 ? `<td width="8" style="width:8px;font-size:0;line-height:0">&nbsp;</td>` : "")).join("");
  const row = (links, label) => !links.length ? "" :
    `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 6px"><tr>` +
    (label ? `<td style="${FONT};font-size:12px;line-height:30px;color:${ink3};padding:0 10px 0 0;white-space:nowrap">${esc(label)}</td>` : "") +
    icons(links) + `</tr></table>`;
  // Labels only when both rows show, or when the buttons reach a team rather
  // than the person signing.
  const linkHtml =
    row(mine, contact === "both" && team.length ? "Me" : "") +
    row(team, teamName || (contact === "both" ? "Team" : ""));

  const html =
    `<table cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="border-collapse:separate;background:${bg};border-radius:16px"><tr>` +
    `<td style="padding:14px 0 14px 14px;vertical-align:middle">` +
    (photo ? `<img src="${esc(photo)}" width="108" height="108" alt="${esc(name)}" style="display:block;width:108px;height:108px;border:0">` : "") +
    `</td><td style="padding:14px 18px 8px ${photo ? "14px" : "4px"};vertical-align:middle">` +
    `<div style="${FONT};font-size:20px;line-height:24px;font-weight:bold;color:${ink};margin:0 0 3px;white-space:nowrap">${esc(name)}${badgeHtml}</div>` +
    (who ? `<div style="${FONT};font-size:14px;line-height:22px;color:${ink2};margin:0 0 10px;white-space:nowrap">${who}</div>` : "") +
    linkHtml +
    `</td></tr></table>`;

  // plain text: the logo is an image, so the company is spelled out, and
  // each link shows where it goes
  const role = title && company ? `${title} at ${company}` : title || company;
  const text = [name, role, ...mine.map((l) => `${l.label}: ${l.shown}`),
    ...team.map((l) => `${l.label}: ${l.shown}`)].filter(Boolean).join("\n");
  return { html, text, bg, accent };
}
