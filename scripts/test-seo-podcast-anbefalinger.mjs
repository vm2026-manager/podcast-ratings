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
const app = await readFile(path.join(root, "app.js"), "utf8");
const homeCss = await readFile(path.join(root, "style.css"), "utf8");
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
for (const [name, content] of [["app.js", app], ["index.html", home]]) {
  assert.doesNotMatch(content, /home-podcast-guide|podcast-guide-link/, `${name}: misplaced guide elements stay removed`);
  assert.doesNotMatch(content, /\/podcast-anbefalinger(?:\/|["?#])/, `${name}: do not insert a replacement SEO link in any app view`);
}
assert.doesNotMatch(homeCss, /\.(?:home-podcast-guide|podcast-guide-link)\b/, "removed links leave no orphan styling");
for (const term of ["podcastforslag", "gode podcasts", "danske podcasts", "Hvilken podcast skal jeg høre?"]) assert(html.includes(term));

// Preserve the exact SEO identity introduced in phase 2A.
assert.equal(title, "Podcast anbefalinger – gode danske podcasts | Podcastlisten");
assert.equal(description, "Find podcast anbefalinger og forslag til gode danske podcasts. Gå på opdagelse i nyheder, true crime, historie og flere genrer på Podcastlisten.");
assert.match(html, /<h1 id="guide-title">Podcastanbefalinger: find din næste podcast<\/h1>/);
assert.match(html, /Udvalget er podcastforslag, ikke en rangliste over de bedste podcasts/);
assert.doesNotMatch(html, /<time\b|Opdateret den|dateModified|AggregateRating|ratingCount/iu, "no unverified dates or user aggregates");
assert.match(html, /class="primary-link" href="\/#udforsk">Udforsk alle podcasts på Podcastlisten/);
assert.match(html, /aria-current="page">Podcastforslag/);
assert.match(html, /class="listening-choices"/);
assert.equal([...html.matchAll(/<details class="genre-details">/g)].length, 8, "native sections let visitors choose without JS");
assert.equal([...html.matchAll(/<summary>Se [12] podcastforslag<\/summary>/g)].length, 8);
assert.equal([...html.matchAll(/class="more-in-genre"/g)].length, 8);
assert.match(html, /De er ikke brugernes gennemsnitsvurderinger/);
const routeStart = app.indexOf("function getRouteInfoFromHash(");
const routeEnd = app.indexOf("\nfunction ", routeStart + 1);
assert(routeStart >= 0 && routeEnd > routeStart);
const routeSource = app.slice(routeStart, routeEnd);
for (const route of ["forside", "ranglister", "udforsk"]) {
  assert(html.includes(`href="/#${route}"`), `landing exposes ${route}`);
  assert(home.includes(`href="#${route}" data-page-link="${route}"`), `existing main navigation supports ${route}`);
  const resolve = new Function("window", `${routeSource}\nreturn getRouteInfoFromHash();`);
  assert.equal(resolve({location:{hash:`#${route}`}}).route, route);
}

// Use the app's actual genre normalization, not raw catalogue labels.
function appFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf("\nfunction ", start + 1);
  assert(start >= 0 && end > start, `app function exists: ${name}`);
  return app.slice(start, end);
}
const normalizer = new Function(`${appFunction("normalizeText")}\n${appFunction("normalizeComparable")}\n${appFunction("normalizeGenre")}\nreturn normalizeGenre;`)();
const genresDeclaration = app.match(/const GENRES = (\[[\s\S]*?\]);/);
assert(genresDeclaration, "read selectable genres from the app");
const selectableGenres = new Set(JSON.parse(genresDeclaration[1]));
assert.match(app, /const genre = normalizeGenre\(rawGenre\)/, "catalogue genres are normalized before ranking");
assert.match(appFunction("getFilteredPodcasts"), /normalizeComparable\(podcast.genre\) !== normalizeComparable\(state.activeFilter.value\)/, "ranking compares normalized genres");
function validateGenreNavigation(content) {
  const sections = [...content.matchAll(/<section class="genre-section"[\s\S]*?<\/section>/g)];
  assert.equal(sections.length, 8);
  for (const [section] of sections) {
    const helper = section.match(/<p class="more-in-genre"><a href="([^\"]+)">[^<]+<\/a><span>Vælg ([^<]+) i ranglistens genrefilter\.<\/span><\/p>/);
    assert(helper, "each section has a concrete, validated next step");
    const [, href, filter] = helper;
    assert.equal(href, "/#ranglister");
    assert(selectableGenres.has(filter) && filter !== "Alle", `selectable ranking filter: ${filter}`);
    const sectionIds = [...section.matchAll(/data-podcast-id="([^\"]+)"/g)].map((match) => decode(match[1]));
    assert(sectionIds.length > 0);
    for (const id of sectionIds) {
      const rows = source.rows.filter((row) => row["Podcast-ID"] === id);
      assert.equal(rows.length, 1);
      assert.equal(normalizer(rows[0].Genre), filter, `filter must include the actual catalogue podcast: ${id}`);
    }
  }
}
validateGenreNavigation(html);
for (const invalid of ["Nyheder", "Fodbold", "Forskning", "Snakke", "Kærlighed", "Erhverv"]) {
  assert.throws(() => validateGenreNavigation(html.replace("Vælg Samfund i", `Vælg ${invalid} i`)), /selectable ranking filter/, `reject nonexistent filter ${invalid}`);
}
assert.throws(() => validateGenreNavigation(html.replace("Vælg Sport i", "Vælg Samfund i")), /filter must include/, "a real but mismatched filter is also misleading");

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
  if (rating) assert(card.includes(`<p class="rating">Redaktionel vurdering: <strong>${escape(rating)} / 10</strong>`), `rating must match the catalogue: ${id}`);
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
  if (url.pathname === "/" && url.hash) {
    assert(["#forside", "#ranglister", "#udforsk"].includes(url.hash), `only verified app hash routes: ${href}`);
    assert.equal(url.search, "", "do not invent genre query routing");
  }
  if (url.searchParams.has("podcast")) assert(seen.has(url.searchParams.get("podcast")), `detail route uses a verified permanent ID: ${href}`);
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
const protectedFiles = [landingRelative, "podcast-anbefalinger/style.css", "sitemap.xml", "index.html", "data/podcasts.json", "scripts/seo-podcast-safety-state.json", "app.js", "style.css"];
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
