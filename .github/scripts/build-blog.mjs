// Refreshes the post list in blog/index.html from the Substack feed.
// Run daily by .github/workflows/blog.yml, or by hand: node .github/scripts/build-blog.mjs
// No dependencies. If anything looks wrong it stops with an error and leaves the page exactly as it was.
import { readFileSync, writeFileSync } from "node:fs";

const FEED = "https://camtoando.substack.com/feed";
const FILE = "blog/index.html";
const START = "<!-- posts:start", END = "<!-- posts:end -->";
// Posts whose title contains any of these (case-insensitive) stay off the blog.
const EXCLUDE = ["ĐBQH", "Ex-Parliamentarian"];
// Posts that live on this site rather than on Substack.
const LOCAL = [
  {
    title: "10 security basics every small business should have",
    description: "A plain-English checklist that stops most real-world attacks — no security team required.",
    url: "/blog/small-business-security-checklist/",
    date: new Date("2026-10-15"),
  },
];

const tag = (xml, name) =>
  xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`))?.[1].trim() ?? "";

// Feed HTML → plain text. Tags are stripped until none remain (one pass can leave "<scr<b>ipt>" behind),
// and &amp; is decoded last so "&amp;lt;" becomes the text "&lt;" rather than "<".
const decode = (input) => {
  let s = input, prev;
  do { prev = s; s = s.replace(/<[^>]*>/g, ""); } while (s !== prev);
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
};

// The feed is someone else's text going into our HTML: escape every character that could start markup.
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const res = await fetch(FEED, {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; camtoan-me-build; +https://camtoan.me)" },
  signal: AbortSignal.timeout(15_000),
});
if (!res.ok) throw new Error(`Substack feed answered HTTP ${res.status}`);
const xml = await res.text();

const substack = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  .map(([, item]) => ({
    title: decode(tag(item, "title")),
    description: decode(tag(item, "description")),
    url: tag(item, "link"),
    date: new Date(tag(item, "pubDate")),
    external: true,
  }))
  // Only real https links, real dates, and nothing on the exclude list.
  .filter((p) => p.title && /^https:\/\/[^\s"'<>]+$/.test(p.url) && !isNaN(p.date))
  .filter((p) => !EXCLUDE.some((x) => p.title.toLowerCase().includes(x.toLowerCase())));
if (!substack.length) throw new Error("The feed gave no usable posts; leaving the page as it is");

const posts = [...LOCAL, ...substack].sort((a, b) => b.date - a.date);
const list = posts.map((p) => {
  const day = p.date.toISOString().slice(0, 10);
  const link = p.external
    ? `<a href="${esc(p.url)}" rel="noopener noreferrer">${esc(p.title)}</a><span class="where">Substack ↗</span>`
    : `<a href="${esc(p.url)}">${esc(p.title)}</a>`;
  return `      <li><time datetime="${day}">${day}</time><div>${link}</div><p>${esc(p.description)}</p></li>`;
}).join("\n");

const html = readFileSync(FILE, "utf8");
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) throw new Error(`Markers not found in ${FILE}`);
const afterStart = html.indexOf("-->", a) + 3;
const next = `${html.slice(0, afterStart)}\n${list}\n      ${html.slice(b)}`;

if (next === html) console.log(`No change: ${posts.length} posts already listed.`);
else { writeFileSync(FILE, next); console.log(`Updated ${FILE}: ${posts.length} posts (${substack.length} from Substack).`); }
