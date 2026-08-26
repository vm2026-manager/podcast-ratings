import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertUniqueSlugs, generateSeoPodcastPages, PILOT_PODCAST_IDS, resolvePilotPodcasts, slugFromPodcastId, TRUE_CRIME_CANONICAL, trueCrimeData } from "./generate-seo-podcast-pages.mjs";

const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const rows = resolvePilotPodcasts(payload.rows);
const ORIGINAL_PILOT_ROUTES = new Map([
  ["mørkeland", "moerkeland"], ["genstart", "genstart"], ["millionærklubben", "millionaerklubben"],
  ["sagen genabnet", "sagen-genabnet"], ["borgerlig tabloid", "borgerlig-tabloid"], ["det vi taler om", "det-vi-taler-om"],
  ["langt fra løgnen", "langt-fra-loegnen"], ["mads og a holdet", "mads-og-a-holdet"],
  ["vanvittig verdenshistorie", "vanvittig-verdenshistorie"], ["afhørt", "afhoert"]
]);
assert.equal(rows.length, 30);
assert.equal(slugFromPodcastId(" Mørkeland ÆØÅ! "), "moerkeland-aeoeaa");
assert.throws(() => resolvePilotPodcasts([{ "Podcast-ID": "mørkeland" }]), /resolve uniquely/);
assert.throws(() => assertUniqueSlugs([{ "Podcast-ID": "a!" }, { "Podcast-ID": "a?" }]), /slug collision/);
const pages = await generateSeoPodcastPages();
assert.equal(pages.length, 30);
const trueCrimeEntries = trueCrimeData(payload.rows);
assert.equal(trueCrimeEntries.length, 222);
assert.deepEqual([...new Set(trueCrimeEntries.map((entry) => entry.id))].length, trueCrimeEntries.length);
assert(trueCrimeEntries.every((entry) => payload.rows.find((row) => row["Podcast-ID"] === entry.id)?.Genre === "True Crime"));
for (let index = 1; index < trueCrimeEntries.length; index += 1) {
  const previous = trueCrimeEntries[index - 1]; const current = trueCrimeEntries[index];
  assert(previous.ratingValue === null || current.ratingValue === null || previous.ratingValue >= current.ratingValue);
}
const urls = new Set(); const titles = new Set();
for (const page of pages) {
  const html = await readFile(new URL(`../podcast/${page.slug}/index.html`, import.meta.url), "utf8");
  assert.equal((html.match(/<title>/g) || []).length, 1); assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1); assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert(html.includes(page.canonical)); assert(!/href="[^\"]*#/.test(html)); assert(!html.includes("noindex")); assert(html.length > 1200);
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
for (const [id, slug] of ORIGINAL_PILOT_ROUTES) {
  const page = pages.find((candidate) => candidate.id === id);
  assert(page, `original pilot missing: ${id}`);
  assert.equal(page.slug, slug);
  assert.equal(page.canonical, `https://podcastlisten.dk/podcast/${slug}/`);
}
const trueCrimeHtml = await readFile(new URL("../genre/true-crime/index.html", import.meta.url), "utf8");
assert.equal((trueCrimeHtml.match(/<title>/g) || []).length, 1); assert.equal((trueCrimeHtml.match(/<h1>/g) || []).length, 1);
assert.equal((trueCrimeHtml.match(/rel="canonical"/g) || []).length, 1); assert.equal((trueCrimeHtml.match(/name="description"/g) || []).length, 1);
assert(trueCrimeHtml.includes(TRUE_CRIME_CANONICAL)); assert(!trueCrimeHtml.includes("noindex")); assert(trueCrimeHtml.includes("Danske true crime podcasts"));
const genreStaticLinks = [...trueCrimeHtml.matchAll(/href="(\/podcast\/[^\"]+)"/g)].map((match) => match[1]);
const expectedGenreStaticLinks = trueCrimeEntries.filter((entry) => entry.staticSlug).map((entry) => `/podcast/${entry.staticSlug}/`);
assert.deepEqual(genreStaticLinks, expectedGenreStaticLinks);
for (const href of genreStaticLinks) assert(await readFile(new URL(`..${href}index.html`, import.meta.url), "utf8"));
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");
assert.equal((sitemap.match(/<loc>/g) || []).length, PILOT_PODCAST_IDS.length + 2); assert(!sitemap.includes("#"));
for (const page of pages) assert(sitemap.includes(page.canonical));
assert.equal((sitemap.match(new RegExp(TRUE_CRIME_CANONICAL, "g")) || []).length, 1);
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const pilotIdBlock = app.match(/const SEO_PILOT_PODCAST_IDS = new Set\(\[([\s\S]*?)\]\);/);
assert(pilotIdBlock, "app must limit crawlable routes to the pilot IDs");
const appPilotIds = [...pilotIdBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(appPilotIds, PILOT_PODCAST_IDS);
assert.match(app, /titleLink\.href = seoPilotRoute/);
assert.match(app, /event\.preventDefault\(\);[\s\S]*?openPodcastDetailSheet\(podcast, article, \{ allowDesktop: true \}\)/);
assert.match(app, /button\.href = "\/genre\/true-crime\/"/);
console.log("SEO pilot generator tests passed");
