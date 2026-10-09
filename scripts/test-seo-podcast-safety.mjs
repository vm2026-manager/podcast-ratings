import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { generateSeoPodcastPages, renderPage, renderTrueCrimePage, trueCrimeData } from "./generate-seo-podcast-pages.mjs";
import { prepareSeoPlan, publishSeoPlan, validateSitemap } from "./seo-podcast-safety.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(await readFile(new URL("./seo-podcast-safety-baseline.json", import.meta.url), "utf8"));
const baselineSource = JSON.parse(await readFile(path.join(repository, "data/podcasts.json"), "utf8"));

async function snapshot(root, relative = "") {
  const result = {};
  for (const name of (await readdir(path.join(root, relative))).sort()) {
    const item = path.join(relative, name);
    const stat = await lstat(path.join(root, item));
    if (stat.isSymbolicLink()) result[item] = { link: await readlink(path.join(root, item)) };
    else if (stat.isDirectory()) Object.assign(result, await snapshot(root, item));
    else result[item] = { hash: createHash("sha256").update(await readFile(path.join(root, item))).digest("hex"), mtime: stat.mtimeMs, mode: stat.mode };
  }
  return result;
}

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), "seo-safety-test-"));
  try {
    for (const directory of ["podcast", "genre"]) await cp(path.join(repository, directory), path.join(root, directory), { recursive: true });
    await mkdir(path.join(root, "data"));
    await mkdir(path.join(root, "scripts"));
    for (const relative of ["data/podcasts.json", "sitemap.xml", "scripts/generate-seo-podcast-pages.mjs", "scripts/seo-podcast-safety.mjs", "scripts/seo-podcast-safety-baseline.json", "scripts/seo-podcast-safety-state.json"]) await cp(path.join(repository, relative), path.join(root, relative));
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

async function setSource(root, transform) {
  const source = structuredClone(baselineSource);
  transform(source);
  await writeFile(path.join(root, "data/podcasts.json"), JSON.stringify(source), "utf8");
}

async function assertBlocked(root, expected) {
  const before = await snapshot(root);
  await assert.rejects(generateSeoPodcastPages({ root, write: true }), expected);
  assert.deepEqual(await snapshot(root), before, "a rejected generation must not touch existing files");
}

test("all 30 original URLs, existing pages and sitemap metadata survive repeated generation", async () => fixture(async (root) => {
  assert.equal(baseline.podcasts.length, 30);
  for (const original of baseline.podcasts) assert.equal(slugFromPublishedUrl(original.canonical), original.slug);
  const manualPodcast = path.join(root, "podcast/manual-page/index.html");
  const manualGenre = path.join(root, "genre/true-crime/manual-guide/index.html");
  for (const file of [manualPodcast, manualGenre]) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "Manually maintained SEO page\n");
  }
  const sitemapFile = path.join(root, "sitemap.xml");
  const originalXml = await readFile(sitemapFile, "utf8");
  const manualUrl = "https://podcastlisten.dk/podcast/manual-page/";
  const expandedXml = originalXml.replace("</urlset>", `  <url><loc>${manualUrl}</loc><lastmod>2026-10-09</lastmod></url>\n</urlset>`);
  await writeFile(sitemapFile, expandedXml);
  const before = await snapshot(root);
  const pages = await generateSeoPodcastPages({ root, write: true });
  assert.deepEqual(pages.map(({ id, slug, canonical }) => ({ id, slug, canonical })), baseline.podcasts);
  const urls = validateSitemap(await readFile(sitemapFile, "utf8"));
  for (const url of [...baseline.sitemapUrls, manualUrl]) assert(urls.has(url));
  assert.equal(await readFile(sitemapFile, "utf8"), expandedXml, "sitemap metadata must remain byte-identical");
  for (const original of baseline.podcasts) {
    const html = await readFile(path.join(root, `podcast/${original.slug}/index.html`), "utf8");
    assert(html.includes(`href="${original.canonical}"`));
    assert(html.includes(`href="/?podcast=${encodeURIComponent(original.id)}"`));
  }
  const after = await snapshot(root);
  for (const file of ["podcast/manual-page/index.html", "genre/true-crime/manual-guide/index.html"]) assert.deepEqual(after[file], before[file]);
  const oldGenre = await readFile(path.join(repository, "genre/true-crime/index.html"), "utf8");
  const newGenre = await readFile(path.join(root, "genre/true-crime/index.html"), "utf8");
  for (const [, id] of oldGenre.matchAll(/href="\/\?podcast=([^"&]+)"/g)) assert(newGenre.includes(`href="/?podcast=${id}"`));
  await generateSeoPodcastPages({ root, write: true });
  assert.deepEqual(await snapshot(root), after, "repeated generation must be byte- and mtime-identical");
  await writeFile(sitemapFile, originalXml);
  await assertBlocked(root, /Sitemap lost existing URL|fall in sitemap URL count/);
}));

function slugFromPublishedUrl(url) { return new URL(url).pathname.split("/")[2]; }

test("API defaults, explicit dry-run and CLI dry-run change no files", async () => fixture(async (root) => {
  const before = await snapshot(root);
  await generateSeoPodcastPages({ root });
  await generateSeoPodcastPages({ root, write: false });
  for (const flags of [[], ["--dry-run"]]) execFileSync(process.execPath, [path.join(root, "scripts/generate-seo-podcast-pages.mjs"), ...flags], { cwd: root });
  assert.deepEqual(await snapshot(root), before);
  for (const flags of [["--delete"], ["--write", "--dry-run"], ["--unknown"]]) assert.throws(() => execFileSync(process.execPath, [path.join(root, "scripts/generate-seo-podcast-pages.mjs"), ...flags], { cwd: root, stdio: "pipe" }));
  assert.deepEqual(await snapshot(root), before);
}));

for (const [name, change, expected] of [
  ["duplicate pilot ID", (s) => { s.rows.push(structuredClone(s.rows.find((r) => r["Podcast-ID"] === "genstart"))); s.count++; }, /Duplicate Podcast-ID/],
  ["duplicate non-pilot ID", (s) => { s.rows.push(structuredClone(s.rows.find((r) => !baseline.podcasts.some((p) => p.id === r["Podcast-ID"])))); s.count++; }, /Duplicate Podcast-ID/],
  ["slug collision", (s) => { s.rows.push({ ...s.rows[0], "Podcast-ID": "moerkeland" }); s.count++; }, /slug collision/],
  ["missing pilot with unchanged count", (s) => { s.rows.find((r) => r["Podcast-ID"] === "genstart")["Podcast-ID"] = "missing pilot replacement"; }, /resolve uniquely/],
  ["fewer catalogue podcasts", (s) => { s.rows.pop(); s.count--; }, /fall in podcast count/],
  ["fewer True Crime podcasts", (s) => { s.rows.find((r) => r.Genre === "True Crime").Genre = "Other"; }, /fall in True Crime count/],
  ["missing title", (s) => { delete s.rows[0].Titel; delete s.rows[0].Title; }, /Missing title\/description/],
  ["missing description", (s) => { delete s.rows[0]["Kort beskrivelse"]; delete s.rows[0]["Lang beskrivelse"]; }, /Missing title\/description/],
  ["wrong source count", (s) => { s.count++; }, /Invalid catalogue rows\/count/],
  ["missing rows array", (s) => { delete s.rows; }, /Invalid catalogue rows\/count/]
]) test(`${name} blocks publication without damaging any files`, async () => fixture(async (root) => {
  await setSource(root, change);
  await assertBlocked(root, expected);
}));

for (const id of ["", null, 42, "../genstart", "genstart/escape", " genstart", "genstart\n", "!!!"]) test(`invalid ID ${JSON.stringify(id)} blocks publication`, async () => fixture(async (root) => {
  await setSource(root, (s) => { s.rows[0]["Podcast-ID"] = id; });
  await assertBlocked(root, /Invalid Podcast-ID/);
}));

test("invalid JSON never changes existing pages", async () => fixture(async (root) => {
  await writeFile(path.join(root, "data/podcasts.json"), "{broken");
  await assertBlocked(root, SyntaxError);
}));

for (const [name, transform, expected] of [
  ["lost existing sitemap URL", (s) => s.replace(/\s*<url><loc>https:\/\/podcastlisten.dk\/podcast\/genstart\/<\/loc><\/url>/, ""), /Sitemap lost existing URL|fall in sitemap URL count/],
  ["duplicate sitemap URL", (s) => s.replace("</urlset>", "<url><loc>https://podcastlisten.dk/</loc></url></urlset>"), /Duplicate sitemap URL/],
  ["invalid sitemap XML", (s) => s.replace("</urlset>", ""), /Invalid or unsupported sitemap XML/]
]) test(name, async () => fixture(async (root) => {
  const file = path.join(root, "sitemap.xml");
  await writeFile(file, transform(await readFile(file, "utf8")));
  await assertBlocked(root, expected);
}));

test("canonical and identity conflicts cannot overwrite an existing page", async () => fixture(async (root) => {
  const file = path.join(root, "podcast/genstart/index.html");
  const html = await readFile(file, "utf8");
  await writeFile(file, html.replace('rel="canonical" href="https://podcastlisten.dk/podcast/genstart/"', 'rel="canonical" href="https://podcastlisten.dk/podcast/manual/"'));
  await assertBlocked(root, /Canonical conflict/);
  await writeFile(file, html.replace('href="/?podcast=genstart"', 'href="/?podcast=somebody-else"'));
  await assertBlocked(root, /identity conflict/);
}));

test("symlink targets are rejected", async () => fixture(async (root) => {
  const file = path.join(root, "podcast/genstart/index.html");
  const sentinel = path.join(root, "manual-sentinel.html");
  await cp(file, sentinel);
  await rm(file);
  await symlink(sentinel, file);
  await assertBlocked(root, /Unsafe output target/);
}));

test("successful counts are remembered, including growth above the baseline", async () => fixture(async (root) => {
  await setSource(root, (s) => { s.rows.push({ ...s.rows.find((r) => r.Genre !== "True Crime"), "Podcast-ID": "additional safety fixture" }); s.count++; });
  await generateSeoPodcastPages({ root, write: true });
  await setSource(root, () => {});
  await assertBlocked(root, /fall in podcast count/);
}));

test("a temporarily absent published True Crime ID blocks removal even with unchanged counts", async () => fixture(async (root) => {
  const html = await readFile(path.join(root, "genre/true-crime/index.html"), "utf8");
  const id = [...html.matchAll(/href="\/\?podcast=([^"&]+)"/g)].map((match) => decodeURIComponent(match[1])).find((id) => !baseline.podcasts.some((page) => page.id === id));
  assert(id);
  await setSource(root, (s) => { s.rows.find((row) => row["Podcast-ID"] === id)["Podcast-ID"] = "replacement true crime fixture"; });
  await assertBlocked(root, /True Crime podcast disappeared/);
}));

async function changedPlan(root) {
  const sourceText = await readFile(path.join(root, "data/podcasts.json"), "utf8");
  const existingSitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
  const pages = await generateSeoPodcastPages({ root });
  const changed = pages.map((page) => ({ ...page, description: `${page.description} Safety fixture change.` }));
  const outputs = changed.map((page) => ({ relative: `podcast/${page.slug}/index.html`, id: page.id, canonical: page.canonical, content: renderPage(page) }));
  outputs.push({ relative: "genre/true-crime/index.html", canonical: "https://podcastlisten.dk/genre/true-crime/", content: renderTrueCrimePage(trueCrimeData(baselineSource.rows)) });
  outputs.push({ relative: "sitemap.xml", content: existingSitemap });
  return prepareSeoPlan({ root, sourceText, existingSitemap, pages, outputs, baseline });
}

test("a mid-publication I/O failure restores every already replaced file", async () => fixture(async (root) => {
  const plan = await changedPlan(root);
  const before = await snapshot(root);
  let moves = 0;
  await assert.rejects(publishSeoPlan(plan, { renameFile: async (...args) => {
    if (++moves === 2) throw new Error("Simulated disk failure");
    return rename(...args);
  } }), /Simulated disk failure/);
  const after = await snapshot(root);
  assert.deepEqual(Object.keys(after), Object.keys(before), "no deleted pages or abandoned temporary files");
  for (const file of Object.keys(before)) assert.equal(after[file].hash, before[file].hash, `rollback preserves ${file}`);
  assert.equal(moves, 2, "failure occurs after a real successful rename");
}));

test("staging failure cannot reach production files", async () => fixture(async (root) => {
  const plan = await changedPlan(root);
  plan.outputs[1].content = null;
  const before = await snapshot(root);
  await assert.rejects(publishSeoPlan(plan), /data.*argument|type string/i);
  assert.deepEqual(await snapshot(root), before);
}));

test("invalid staged HTML blocks publication before the first rename", async () => fixture(async (root) => {
  const plan = await changedPlan(root);
  plan.outputs[0].content = "<html>Truncated staged output</html>";
  const before = await snapshot(root);
  await assert.rejects(publishSeoPlan(plan), /Canonical conflict/);
  assert.deepEqual(await snapshot(root), before);
}));

test("an existing writer lock blocks publication without touching its staging files", async () => fixture(async (root) => {
  const plan = await changedPlan(root);
  const lock = path.join(tmpdir(), `podcastlisten-seo-${createHash("sha256").update(root).digest("hex")}.lock`);
  await mkdir(lock);
  const sentinel = path.join(lock, "other-writer.txt");
  await writeFile(sentinel, "Another writer owns this staging area");
  const before = await snapshot(root);
  try {
    await assert.rejects(publishSeoPlan(plan), { code: "EEXIST" });
    assert.equal(await readFile(sentinel, "utf8"), "Another writer owns this staging area");
    assert.deepEqual(await snapshot(root), before);
  } finally { await rm(lock, { recursive: true, force: true }); }
}));

test("concurrent source edits block publication before the first rename", async () => fixture(async (root) => {
  const plan = await changedPlan(root);
  await setSource(root, (s) => { s.generatedAt = "concurrent-edit"; });
  const before = await snapshot(root);
  await assert.rejects(publishSeoPlan(plan), /File changed during generation/);
  assert.deepEqual(await snapshot(root), before);
}));
