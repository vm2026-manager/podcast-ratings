import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSeoPodcastPages, renderSitemap } from "./generate-seo-podcast-pages.mjs";
import { validateSitemap } from "./seo-podcast-safety.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonical = "https://podcastlisten.dk/podcast-anbefalinger/";
const landingRelative = "podcast-anbefalinger/index.html";
const html = await readFile(path.join(root, landingRelative), "utf8");
const css = await readFile(path.join(root, "podcast-anbefalinger/style.css"), "utf8");
const home = await readFile(path.join(root, "index.html"), "utf8");
const source = JSON.parse(await readFile(path.join(root, "data/podcasts.json"), "utf8"));
const baseline = JSON.parse(await readFile(path.join(root, "scripts/seo-podcast-safety-baseline.json"), "utf8"));
const state = JSON.parse(await readFile(path.join(root, "scripts/seo-podcast-safety-state.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "data/podcast-cover-manifest.json"), "utf8"));
const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const decode = (value) => value.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");

assert.match(html, /^<!DOCTYPE html>\s*<html lang="da">/);
assert.equal([...html.matchAll(/<title>/g)].length, 1);
assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
assert.equal([...html.matchAll(/name="description"/g)].length, 1);
assert(html.includes(`rel="canonical" href="${canonical}"`));
assert(html.includes(`property="og:url" content="${canonical}"`));
assert(!/<script\b|supabase|app\.js|noindex/i.test(html), "Google gets static content without application/database scripts");
const title = html.match(/<title>([^<]+)<\/title>/)[1];
const description = html.match(/name="description" content="([^"]+)"/)[1];
assert(description.length >= 100 && description.length <= 160);
assert(title.includes("Podcast anbefalinger") && title.includes("gode danske podcasts"));
assert(!home.includes(`<title>${title}</title>`));
assert(!home.includes(`name="description" content="${description}"`));
assert.match(home, /<a href="\/podcast-anbefalinger\/">Podcastanbefalinger: find din næste podcast<\/a>/);
for (const term of ["podcastforslag", "gode podcasts", "danske podcasts", "Hvilken podcast skal jeg høre?"]) assert(html.includes(term));

const cards = [...html.matchAll(/<article class="podcast-card" data-podcast-id="([^"]+)">([\s\S]*?)<\/article>/g)];
assert.equal(cards.length, 15, "reviewed selection must render all 15 verified podcasts");
assert.equal([...html.matchAll(/<section class="genre-section"/g)].length, 8);
const seen = new Set(), genres = new Set();
for (const [, encodedId, card] of cards) {
  const id = decode(encodedId);
  assert(!seen.has(id), `duplicate recommendation: ${id}`);
  seen.add(id);
  const rows = source.rows.filter((row) => row["Podcast-ID"] === id);
  assert.equal(rows.length, 1, `permanent ID must resolve uniquely: ${id}`);
  const row = rows[0];
  assert.equal(row.isEnglish, false, `Danish selection must match catalogue language: ${id}`);
  const original = baseline.podcasts.find((page) => page.id === id);
  assert(original, `reuse an existing canonical route: ${id}`);
  const route = new URL(original.canonical).pathname;
  assert(card.includes(`<h3 class="podcast-title"><a href="${route}">${escape(row.Titel)}</a></h3>`));
  assert(card.includes(`<p class="description">${escape(row["Kort beskrivelse"])}</p>`), `description must be copied from the catalogue: ${id}`);
  assert(card.includes(`<p class="genre">${escape(row.Genre)}</p>`));
  genres.add(row.Genre);
  assert(card.includes(`href="/?podcast=${encodeURIComponent(id)}"`));
  const rating = row["Vuring (1-10)"];
  if (rating) assert(card.includes(`<strong>${escape(rating)} / 10</strong>`), `rating must match the catalogue: ${id}`);
  else assert(!card.includes('class="rating"'), `do not invent ratings: ${id}`);
  for (const [, src] of card.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    assert(src.startsWith("/data/covers/"), "use existing local cover assets");
    const cover = manifest.podcasts.find((entry) => entry.appPodcastKey === id && entry.title === row.Titel && entry.originalImageUrl === row.Billedlink);
    assert.equal(src, `/${cover?.variants?.["480"]?.path}`);
    assert((await stat(path.join(root, src))).isFile());
  }
}
assert(genres.size >= 8, "recommendations cover varied catalogue genres");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length);
for (const [, encodedHref] of html.matchAll(/href="([^"]+)"/g)) {
  const href = decode(encodedHref);
  const url = new URL(href, canonical);
  assert.equal(url.origin, "https://podcastlisten.dk", "links stay within Podcastlisten");
  if (href.startsWith("#")) assert(ids.includes(url.hash.slice(1)), `in-page link target must exist: ${href}`);
  else if (url.pathname.endsWith("/")) assert((await stat(path.join(root, url.pathname, "index.html"))).isFile(), `internal page must exist: ${href}`);
  else assert((await stat(path.join(root, url.pathname))).isFile());
}
assert.match(css, /@media \(max-width: 680px\)/);
assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
assert.match(css, /:focus-visible/);

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const urls = validateSitemap(sitemap, { requiredUrls: [...baseline.sitemapUrls, ...state.sitemapUrls, canonical], minimumUrls: baseline.sitemapUrls.length + 1 });
assert(urls.has(canonical));
assert(state.sitemapUrls.includes(canonical), "the new page is protected by the phase 1 safety record");
const protectedFiles = [landingRelative, "podcast-anbefalinger/style.css", "sitemap.xml", "index.html", "data/podcasts.json", "scripts/seo-podcast-safety-state.json"];
async function snapshots(base, files) {
  return Promise.all(files.map(async (file) => ({ file, content: await readFile(path.join(base, file), "utf8"), mtime: (await stat(path.join(base, file))).mtimeMs })));
}
const before = await snapshots(root, protectedFiles);
const pages = await generateSeoPodcastPages({ write: false });
assert.equal(pages.length, 30);
assert.equal(renderSitemap(pages, sitemap), sitemap, "phase 1 must preserve the expanded sitemap exactly");
assert.deepEqual(await snapshots(root, protectedFiles), before, "SEO validation must leave repository files unchanged");

const fixture = await mkdtemp(path.join(tmpdir(), "seo-landing-preservation-"));
try {
  for (const dir of ["podcast", "genre", "podcast-anbefalinger"]) await cp(path.join(root, dir), path.join(fixture, dir), { recursive: true });
  for (const dir of ["scripts", "data"]) await mkdir(path.join(fixture, dir));
  for (const file of ["sitemap.xml", "data/podcasts.json", "scripts/seo-podcast-safety-state.json"]) await cp(path.join(root, file), path.join(fixture, file));
  const files = [landingRelative, "podcast-anbefalinger/style.css", "sitemap.xml"];
  const original = await snapshots(fixture, files);
  await generateSeoPodcastPages({ root: fixture, write: true });
  assert.deepEqual(await snapshots(fixture, files), original, "phase 1 publication must preserve the landing page and all sitemap URLs");
} finally { await rm(fixture, { recursive: true, force: true }); }
console.log(`Podcast recommendation landing SEO checks passed: ${seen.size} verified Danish podcasts, 8 sections, ${urls.size} preserved sitemap URLs, zero repository writes.`);
