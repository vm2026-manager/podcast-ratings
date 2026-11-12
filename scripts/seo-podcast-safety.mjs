import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export function validateCatalogue(source, baseline, slugFromId) {
  if (!Array.isArray(source?.rows) || source.count !== source.rows.length) throw new Error("Invalid catalogue rows/count");
  if (source.rows.length < baseline.catalogueCount) throw new Error("Unexpected fall in podcast count; explicit review required");
  const ids = new Set(), slugs = new Set();
  for (const row of source.rows) {
    const id = row?.["Podcast-ID"];
    if (typeof id !== "string" || id !== id.trim() || !/^[\p{L}\p{N}][\p{L}\p{N} _'-]*$/u.test(id)) throw new Error(`Invalid Podcast-ID: ${id}`);
    if (ids.has(id)) throw new Error(`Duplicate Podcast-ID: ${id}`);
    ids.add(id);
    const slug = slugFromId(id);
    if (!slug || slugs.has(slug)) throw new Error(`Podcast slug collision: ${slug}`);
    slugs.add(slug);
    for (const keys of [["Titel", "Title"], ["Kort beskrivelse", "Lang beskrivelse"]]) {
      if (!keys.some((key) => typeof row[key] === "string" && row[key].trim())) throw new Error(`Missing title/description: ${id}`);
    }
  }
  if (source.rows.filter((row) => row.Genre === "True Crime").length < baseline.trueCrimeCount) throw new Error("Unexpected fall in True Crime count; explicit review required");
}

export function validateSitemap(xml, { requiredUrls = [], minimumUrls = 0 } = {}) {
  // Fail closed on unsupported XML instead of rebuilding a lossy sitemap.
  const body = xml.match(/^\s*(?:<\?xml[^?]*\?>\s*)?<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"\s*>([\s\S]*?)<\/urlset>\s*$/)?.[1];
  if (body === undefined) throw new Error("Invalid or unsupported sitemap XML");
  const entries = [...body.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  if (body.replace(/<url>[\s\S]*?<\/url>/g, "").trim()) throw new Error("Invalid sitemap entries");
  const urls = new Set();
  for (const [, entry] of entries) {
    const locations = [...entry.matchAll(/<loc>([^<]+)<\/loc>/g)];
    if (locations.length !== 1 || entry.replace(/<loc>[^<]+<\/loc>|<(lastmod|changefreq|priority)>[^<]*<\/\1>/g, "").trim()) throw new Error("Invalid sitemap entry");
    if (/&(?!amp;)/.test(locations[0][1])) throw new Error("Invalid or unsupported sitemap XML entity");
    const raw = locations[0][1].replace(/&amp;/g, "&");
    let url;
    try { url = new URL(raw); } catch { throw new Error(`Invalid sitemap URL: ${raw}`); }
    if (url.origin !== "https://podcastlisten.dk" || url.hash || url.username || url.password || raw !== raw.trim()) throw new Error(`Invalid sitemap URL: ${raw}`);
    if (urls.has(raw)) throw new Error(`Duplicate sitemap URL: ${raw}`);
    urls.add(raw);
  }
  if (urls.size < minimumUrls) throw new Error("Unexpected fall in sitemap URL count");
  for (const url of requiredUrls) if (!urls.has(url)) throw new Error(`Sitemap lost existing URL: ${url}`);
  return urls;
}

async function assertRegularTarget(root, relative, { allowMissing = false } = {}) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some((part) => !part || part === ".." || part === ".")) throw new Error(`Unsafe output path: ${relative}`);
  const parts = [root];
  for (const part of relative.split("/")) parts.push(path.join(parts.at(-1), part));
  for (let index = 0; index < parts.length; index += 1) {
    let stat;
    try { stat = await lstat(parts[index]); }
    catch (error) {
      if (error.code === "ENOENT" && allowMissing) return false;
      throw error;
    }
    if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) throw new Error(`Unsafe output target: ${parts[index]}`);
  }
  return true;
}

function validateCreatablePodcastOutput(output) {
  if (!output.allowCreate) return;
  let url;
  try { url = new URL(output.canonical); } catch { throw new Error(`Unsafe new podcast canonical: ${output.canonical}`); }
  const match = url.pathname.match(/^\/podcast\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/);
  if (!output.id || url.origin !== "https://podcastlisten.dk" || url.search || url.hash || !match || output.relative !== `podcast/${match[1]}/index.html`) {
    throw new Error(`Unsafe new podcast output: ${output.relative}`);
  }
}

async function ensureSafeParents(root, relative, createdDirectories) {
  const directoryParts = relative.split("/").slice(0, -1);
  let current = root;
  for (const part of directoryParts) {
    current = path.join(current, part);
    try {
      await mkdir(current);
      createdDirectories.push(current);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Unsafe output directory: ${current}`);
  }
}

async function removeCreatedDirectories(directories) {
  for (const directory of [...directories].reverse()) {
    await rm(directory).catch((error) => {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
    });
  }
}

function validatePage(html, canonical) {
  const canonicals = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/>/g)];
  if (canonicals.length !== 1 || canonicals[0][1] !== canonical) throw new Error(`Canonical conflict: ${canonical}`);
  for (const pattern of [/<title>/g, /<h1>/g, /name="description"/g]) {
    if ([...html.matchAll(pattern)].length !== 1) throw new Error(`Invalid generated page: ${canonical}`);
  }
  if (!html.endsWith("</html>") || html.includes("noindex")) throw new Error(`Invalid generated page: ${canonical}`);
}

export async function prepareSeoPlan({ root, sourceText, existingSitemap, pages, outputs, baseline }) {
  if (pages.length !== baseline.podcasts.length) throw new Error("Unexpected SEO podcast count");
  for (const original of baseline.podcasts) {
    const page = pages.find((candidate) => candidate.id === original.id);
    if (!page || page.slug !== original.slug || page.canonical !== original.canonical) throw new Error(`Existing podcast identity/URL changed: ${original.id}`);
  }
  validateSitemap(existingSitemap, { requiredUrls: baseline.sitemapUrls, minimumUrls: baseline.sitemapUrls.length });
  const snapshots = new Map([["data/podcasts.json", sourceText]]);
  for (const output of outputs) {
    validateCreatablePodcastOutput(output);
    if (output.allowCreate) {
      const accepted = baseline.podcasts.find((page) => page.id === output.id && page.canonical === output.canonical);
      const resolved = pages.find((page) => page.id === output.id && page.canonical === output.canonical);
      if (!accepted || !resolved || output.relative !== `podcast/${resolved.slug}/index.html`) throw new Error(`Unapproved new podcast output: ${output.id}`);
    }
    const exists = await assertRegularTarget(root, output.relative, { allowMissing: Boolean(output.allowCreate) });
    const original = exists ? await readFile(path.join(root, output.relative), "utf8") : null;
    if (output.relative === "sitemap.xml" && original !== existingSitemap) throw new Error("Sitemap changed during generation");
    snapshots.set(output.relative, original);
    if (output.canonical) {
      if (original !== null) validatePage(original.trimEnd(), output.canonical);
      validatePage(output.content, output.canonical);
      if (original !== null && output.id && !original.includes(`href="/?podcast=${encodeURIComponent(output.id)}"`)) throw new Error(`Existing podcast identity conflict: ${output.id}`);
      if (output.relative === "genre/true-crime/index.html") {
        const oldIds = [...original.matchAll(/href="\/\?podcast=([^"&]+)"/g)].map((match) => match[1]);
        if (!oldIds.length) throw new Error("Missing existing True Crime catalogue");
        for (const id of oldIds) if (!output.content.includes(`href="/?podcast=${id}"`)) throw new Error(`True Crime podcast disappeared: ${id}`);
      }
    } else if (output.kind !== "state") {
      const previousUrls = [...validateSitemap(original)];
      validateSitemap(output.content, { requiredUrls: previousUrls, minimumUrls: previousUrls.length });
    }
  }
  return { root, outputs, snapshots };
}

export async function publishSeoPlan(plan, { renameFile = rename } = {}) {
  const lock = path.join(tmpdir(), `podcastlisten-seo-${createHash("sha256").update(plan.root).digest("hex")}.lock`);
  // Exclusive lock: another writer (or an interrupted one) requires investigation.
  await mkdir(lock);
  let stage;
  const applied = [];
  const createdDirectories = [];
  let retainBackups = false;
  async function atomicReplace(relative, content, move = renameFile) {
    const destination = path.join(plan.root, relative);
    const temporary = path.join(path.dirname(destination), `.seo-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
      await move(temporary, destination);
    } finally {
      await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
    }
  }
  try {
    stage = await mkdtemp(path.join(lock, "stage-"));
    // All content and backups are staged before the first production rename.
    for (let index = 0; index < plan.outputs.length; index += 1) {
      const output = plan.outputs[index];
      await writeFile(path.join(stage, `${index}.html`), output.content, "utf8");
      const snapshot = plan.snapshots.get(output.relative);
      if (snapshot !== null) await writeFile(path.join(stage, `${index}.backup`), snapshot, "utf8");
    }
    for (let index = 0; index < plan.outputs.length; index += 1) {
      const output = plan.outputs[index];
      const staged = await readFile(path.join(stage, `${index}.html`), "utf8");
      if (staged !== output.content) throw new Error(`Staging verification failed: ${output.relative}`);
      if (output.canonical) validatePage(staged, output.canonical);
      else if (output.kind === "state") JSON.parse(staged);
      else validateSitemap(staged, { requiredUrls: [...validateSitemap(plan.snapshots.get(output.relative))] });
    }
    // Catch concurrent edits to source data or any output before publication.
    for (const [relative, original] of plan.snapshots) {
      const output = plan.outputs.find((candidate) => candidate.relative === relative);
      const exists = await assertRegularTarget(plan.root, relative, { allowMissing: Boolean(output?.allowCreate) });
      if (original === null ? exists : !exists || await readFile(path.join(plan.root, relative), "utf8") !== original) throw new Error(`File changed during generation: ${relative}`);
    }
    for (let index = 0; index < plan.outputs.length; index += 1) {
      const output = plan.outputs[index];
      if (output.content === plan.snapshots.get(output.relative)) continue;
      if (plan.snapshots.get(output.relative) === null) await ensureSafeParents(plan.root, output.relative, createdDirectories);
      await atomicReplace(output.relative, await readFile(path.join(stage, `${index}.html`), "utf8"));
      applied.push(output.relative);
    }
  } catch (error) {
    const failures = [];
    for (const relative of applied.reverse()) {
      try {
        const original = plan.snapshots.get(relative);
        if (original === null) await unlink(path.join(plan.root, relative));
        else await atomicReplace(relative, original, rename);
      }
      catch (rollbackError) { failures.push(rollbackError); }
    }
    try { await removeCreatedDirectories(createdDirectories); }
    catch (rollbackError) { failures.push(rollbackError); }
    if (failures.length) {
      retainBackups = true;
      throw new AggregateError([error, ...failures], `Publication failed; recovery backups retained in ${stage}`);
    }
    throw error;
  } finally {
    // Recursive cleanup is restricted to our exclusively owned temporary lock.
    if (!retainBackups) await rm(lock, { recursive: true, force: true });
  }
}
