import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ADDITIONAL_PILOT_PODCAST_IDS, assertUniqueSlugs, EXISTING_PILOT_PODCAST_IDS, generateSeoPodcastPages, PILOT_PODCAST_IDS, renderPage, renderTrueCrimePage, resolvePilotPodcasts, slugFromPodcastId, TRUE_CRIME_CANONICAL, trueCrimeData } from "./generate-seo-podcast-pages.mjs";

const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const rows = resolvePilotPodcasts(payload.rows);
const ORIGINAL_PILOT_ROUTES = new Map([
  ["mørkeland", "moerkeland"], ["genstart", "genstart"], ["millionærklubben", "millionaerklubben"],
  ["sagen genabnet", "sagen-genabnet"], ["borgerlig tabloid", "borgerlig-tabloid"], ["det vi taler om", "det-vi-taler-om"],
  ["langt fra løgnen", "langt-fra-loegnen"], ["mads og a holdet", "mads-og-a-holdet"],
  ["vanvittig verdenshistorie", "vanvittig-verdenshistorie"], ["afhørt", "afhoert"]
]);
assert.equal(rows.length, 60);
assert.equal(slugFromPodcastId(" Mørkeland ÆØÅ! "), "moerkeland-aeoeaa");
assert.throws(() => resolvePilotPodcasts([{ "Podcast-ID": "mørkeland" }]), /resolve uniquely/);
assert.throws(() => assertUniqueSlugs([{ "Podcast-ID": "a!" }, { "Podcast-ID": "a?" }]), /slug collision/);
const pages = await generateSeoPodcastPages({ write: false });
assert.equal(pages.length, 60);
assert.equal(EXISTING_PILOT_PODCAST_IDS.length, 30);
const trueCrimeEntries = trueCrimeData(payload.rows);
assert.equal(trueCrimeEntries.length, payload.rows.filter((row) => row.Genre === "True Crime").length);
assert.deepEqual([...new Set(trueCrimeEntries.map((entry) => entry.id))].length, trueCrimeEntries.length);
assert(trueCrimeEntries.every((entry) => payload.rows.find((row) => row["Podcast-ID"] === entry.id)?.Genre === "True Crime"));
for (let index = 1; index < trueCrimeEntries.length; index += 1) {
  const previous = trueCrimeEntries[index - 1]; const current = trueCrimeEntries[index];
  assert(previous.ratingValue === null || current.ratingValue === null || previous.ratingValue >= current.ratingValue);
}
const urls = new Set(); const titles = new Set(); const metaDescriptions = new Set();
const safetyBaseline = JSON.parse(await readFile(new URL("./seo-podcast-safety-baseline.json", import.meta.url), "utf8"));
assert.deepEqual(safetyBaseline.additionalPodcasts.map((podcast) => podcast.id), ADDITIONAL_PILOT_PODCAST_IDS);
for (const page of pages) {
  const html = renderPage(page);
  assert.equal((html.match(/<title>/g) || []).length, 1); assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1); assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert(html.includes(page.canonical));
  const fragmentLinks = [...html.matchAll(/href="([^"]*#[^"]*)"/g)].map((match) => match[1]);
  assert(fragmentLinks.every((href) => href === "/#udforsk")); assert(!html.includes("noindex")); assert(html.length > 1200);
  assert(html.includes(page.description)); assert(html.includes(page.metaDescription));
  assert(page.longDescription.length >= 180 || EXISTING_PILOT_PODCAST_IDS.includes(page.id), `${page.id} has a documented full description`);
  assert(html.includes(`href="/?podcast=${encodeURIComponent(page.id)}"`), `${page.id} links to its exact Podcastlisten detail view`);
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
  assert.deepEqual(staticLinks, page.relatedPages.map((related) => `/podcast/${related.slug}/`));
  if (!page.relatedPages.length) assert(html.includes('href="/#udforsk"'), `${page.id} links to Podcastlistens discovery view`);
  for (const href of staticLinks) assert(await readFile(new URL(`..${href}index.html`, import.meta.url), "utf8"));
  assert(!urls.has(page.canonical)); assert(!titles.has(page.pageTitle)); assert(!metaDescriptions.has(page.metaDescription));
  urls.add(page.canonical); titles.add(page.pageTitle); metaDescriptions.add(page.metaDescription);
}
for (const [id, slug] of ORIGINAL_PILOT_ROUTES) {
  const page = pages.find((candidate) => candidate.id === id);
  assert(page, `original pilot missing: ${id}`);
  assert.equal(page.slug, slug);
  assert.equal(page.canonical, `https://podcastlisten.dk/podcast/${slug}/`);
}
for (const original of safetyBaseline.originalPodcasts) {
  const page = pages.find((candidate) => candidate.id === original.id);
  assert(page, `original pilot missing: ${original.id}`);
  assert.equal(page.slug, original.slug);
  assert.equal(page.canonical, original.canonical);
}
const trueCrimeHtml = renderTrueCrimePage(trueCrimeEntries);
assert.equal((trueCrimeHtml.match(/<title>/g) || []).length, 1); assert.equal((trueCrimeHtml.match(/<h1>/g) || []).length, 1);
assert.equal((trueCrimeHtml.match(/rel="canonical"/g) || []).length, 1); assert.equal((trueCrimeHtml.match(/name="description"/g) || []).length, 1);
assert(trueCrimeHtml.includes(TRUE_CRIME_CANONICAL)); assert(!trueCrimeHtml.includes("noindex")); assert(trueCrimeHtml.includes("True crime podcasts")); assert(!trueCrimeHtml.includes("Danske true crime podcasts"));
const genreStaticLinks = [...trueCrimeHtml.matchAll(/href="(\/podcast\/[^\"]+)"/g)].map((match) => match[1]);
const expectedGenreStaticLinks = trueCrimeEntries.filter((entry) => entry.staticSlug).map((entry) => `/podcast/${entry.staticSlug}/`);
assert.deepEqual(genreStaticLinks, expectedGenreStaticLinks);
for (const href of genreStaticLinks) assert(await readFile(new URL(`..${href}index.html`, import.meta.url), "utf8"));
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");
assert((sitemap.match(/<loc>/g) || []).length >= PILOT_PODCAST_IDS.length + 3); assert(!sitemap.includes("#"));
for (const page of pages) assert(sitemap.includes(page.canonical));
assert.equal((sitemap.match(new RegExp(TRUE_CRIME_CANONICAL, "g")) || []).length, 1);
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const pilotIdBlock = app.match(/const SEO_PILOT_PODCAST_IDS = new Set\(\[([\s\S]*?)\]\);/);
assert(pilotIdBlock, "app must limit crawlable routes to the pilot IDs");
const appPilotIds = [...pilotIdBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(appPilotIds, PILOT_PODCAST_IDS);
assert.match(app, /titleLink\.href = seoPilotRoute/);
assert.match(app, /event\.preventDefault\(\);[\s\S]*?openPodcastDetailSheet\(podcast, article, \{ allowDesktop: true \}\)/);
const desktopTitleMarkup = app.match(/function getDesktopRankingTitleMarkup\(podcast, variant\) \{[\s\S]*?(?=\nfunction createRankingHostCreditElement)/)?.[0];
assert(desktopTitleMarkup, "desktop ranking titles must have a dedicated SEO link renderer");
assert.match(desktopTitleMarkup, /const seoRoute = getSeoPilotRoute\(podcast\)/);
assert.match(desktopTitleMarkup, /href="\$\{escapeHtml\(seoRoute\)\}" data-action="open-details"/);
assert.match(app, /if \(action === "open-details"\) \{\s+if \(actionTarget\.tagName === "A"\) event\.preventDefault\(\);/);
const desktopCss = await readFile(new URL("../desktop-home-mockup.css", import.meta.url), "utf8");
assert.match(desktopCss, /\.desktop-ranking-title-link\s*\{\s*text-decoration:\s*none !important;/);
assert.match(app, /button\.href = "\/genre\/true-crime\/"/);
console.log("SEO pilot generator tests passed");
