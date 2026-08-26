import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertUniqueSlugs, generateSeoPodcastPages, PILOT_PODCAST_IDS, resolvePilotPodcasts, slugFromPodcastId } from "./generate-seo-podcast-pages.mjs";

const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const rows = resolvePilotPodcasts(payload.rows);
assert.equal(rows.length, 10);
assert.equal(slugFromPodcastId(" Mørkeland ÆØÅ! "), "moerkeland-aeoeaa");
assert.throws(() => resolvePilotPodcasts([{ "Podcast-ID": "mørkeland" }]), /resolve uniquely/);
assert.throws(() => assertUniqueSlugs([{ "Podcast-ID": "a!" }, { "Podcast-ID": "a?" }]), /slug collision/);
const pages = await generateSeoPodcastPages();
const urls = new Set(); const titles = new Set();
for (const page of pages) {
  const html = await readFile(new URL(`../podcast/${page.slug}/index.html`, import.meta.url), "utf8");
  assert.equal((html.match(/<title>/g) || []).length, 1); assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1); assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert(html.includes(page.canonical)); assert(!/(?:href|content)="[^\"]*#/.test(html)); assert(!html.includes("noindex")); assert(html.length > 1200);
  assert(html.includes(page.description)); assert(html.includes(page.metaDescription));
  assert(!html.includes("episoder og anbefalinger"));
  if (page.rating) {
    assert.equal(page.pageTitle, `${page.title} – vurdering og podcastinfo | Podcastlisten`);
    assert(html.includes("Podcastlistens vurdering")); assert(html.includes(`${page.rating} / 10`));
  } else {
    assert.equal(page.pageTitle, `${page.title} – podcast, info og vurderinger | Podcastlisten`);
    assert(!html.includes("Podcastlistens vurdering"));
  }
  assert(!html.includes("Podcastlistens anmeldelse"));
  const staticLinks = [...html.matchAll(/href="(\/podcast\/[^\"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(staticLinks, []);
  assert(!urls.has(page.canonical)); assert(!titles.has(page.pageTitle)); urls.add(page.canonical); titles.add(page.pageTitle);
}
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");
assert.equal((sitemap.match(/<loc>/g) || []).length, PILOT_PODCAST_IDS.length + 1); assert(!sitemap.includes("#"));
for (const page of pages) assert(sitemap.includes(page.canonical));
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const pilotIdBlock = app.match(/const SEO_PILOT_PODCAST_IDS = new Set\(\[([\s\S]*?)\]\);/);
assert(pilotIdBlock, "app must limit crawlable routes to the pilot IDs");
const appPilotIds = [...pilotIdBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(appPilotIds, PILOT_PODCAST_IDS);
assert.match(app, /titleLink\.href = seoPilotRoute/);
assert.match(app, /event\.preventDefault\(\);[\s\S]*?openPodcastDetailSheet\(podcast, article, \{ allowDesktop: true \}\)/);
console.log("SEO pilot generator tests passed");
