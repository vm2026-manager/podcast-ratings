import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateSeoPodcastPages, pageData, PILOT_PODCAST_IDS, resolvePilotPodcasts, slugFromPodcastId } from "./generate-seo-podcast-pages.mjs";

const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const rows = resolvePilotPodcasts(payload.rows);
assert.equal(rows.length, 10);
assert.equal(slugFromPodcastId(" Mørkeland ÆØÅ! "), "moerkeland-aeoeaa");
assert.throws(() => resolvePilotPodcasts([{ "Podcast-ID": "mørkeland" }]), /resolve uniquely/);
const pages = await generateSeoPodcastPages();
const urls = new Set(); const titles = new Set();
for (const page of pages) {
  const html = await readFile(new URL(`../podcast/${page.slug}/index.html`, import.meta.url), "utf8");
  assert.equal((html.match(/<title>/g) || []).length, 1); assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1); assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert(html.includes(page.canonical)); assert(!/(?:href|content)="[^\"]*#/.test(html)); assert(!html.includes("noindex")); assert(html.length > 900);
  assert(!urls.has(page.canonical)); assert(!titles.has(page.title)); urls.add(page.canonical); titles.add(page.title);
}
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");
assert.equal((sitemap.match(/<loc>/g) || []).length, PILOT_PODCAST_IDS.length + 1); assert(!sitemap.includes("#"));
for (const page of pages) assert(sitemap.includes(page.canonical));
console.log("SEO pilot generator tests passed");
