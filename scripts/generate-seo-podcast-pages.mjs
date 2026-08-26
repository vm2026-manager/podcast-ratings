import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const podcastRoot = path.join(repoRoot, "podcast");
const podcastsPath = path.join(repoRoot, "data", "podcasts.json");
const sitemapPath = path.join(repoRoot, "sitemap.xml");

export const PILOT_PODCAST_IDS = [
  "mørkeland", "genstart", "millionærklubben", "sagen genabnet",
  "borgerlig tabloid", "det vi taler om", "langt fra løgnen", "mads og a holdet",
  "vanvittig verdenshistorie", "afhørt",
  "fantino og bonde", "danske drabssager", "only in america", "dkpol",
  "børsen morgenbriefing", "jagten pa det evige liv", "sig det løgn", "frontlinjen",
  "børsen brænder", "hva sa", "112 for knuste hjerter", "aftalt spil",
  "transferguru", "grebet af gvfb", "opskriften pa kærlighed", "bomben",
  "mathias helts talkshow", "tiden", "nationens mareridt", "kvart i bold"
];

export function slugFromPodcastId(id) {
  return String(id ?? "").trim().toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function stableImageUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

function pick(row, keys) {
  for (const key of keys) if (String(row?.[key] ?? "").trim()) return String(row[key]).trim();
  return "";
}

export function resolvePilotPodcasts(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const id = String(row?.["Podcast-ID"] ?? "").trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(row);
  }
  const resolved = PILOT_PODCAST_IDS.map((id) => {
    const matches = byId.get(id) || [];
    if (matches.length !== 1) throw new Error(`Pilot Podcast-ID must resolve uniquely: ${id} (${matches.length} matches)`);
    return matches[0];
  });
  assertUniqueSlugs(resolved);
  return resolved;
}

export function assertUniqueSlugs(rows) {
  const seen = new Set();
  for (const row of rows || []) {
    const slug = slugFromPodcastId(row["Podcast-ID"]);
    if (!slug || seen.has(slug)) throw new Error(`Pilot slug collision: ${slug || "(empty)"}`);
    seen.add(slug);
  }
}

export function pageData(row) {
  const id = String(row["Podcast-ID"]).trim();
  const title = pick(row, ["Titel", "Title"]);
  const slug = slugFromPodcastId(id);
  const shortDescription = pick(row, ["Kort beskrivelse"]);
  const longDescription = pick(row, ["Lang beskrivelse"]);
  const description = longDescription || shortDescription;
  if (!title || !description) throw new Error(`Pilot podcast lacks required title/description: ${id}`);
  const host = pick(row, ["Vært", "Vaert", "Host", "Værter"]);
  const publisher = pick(row, ["Udgiver", "Publisher"]);
  const genre = pick(row, ["Genre"]);
  const secondaryGenre = pick(row, ["Sekundær genre", "Sekundærgenre", "Secondary genre"]);
  const rating = pick(row, ["Vuring (1-10)", "Vurdering (1-10)", "Vurdering"]);
  const cover = stableImageUrl(pick(row, ["Billedlink", "Billedefil", "Billede", "Cover", "Image"]));
  const canonical = `https://podcastlisten.dk/podcast/${slug}/`;
  const conciseDescription = shortDescription || description;
  const normalizedDescription = conciseDescription.replace(/\s+/g, " ");
  const metaDescription = normalizedDescription.slice(0, 155).replace(/[,:;\s]+$/, "") + (normalizedDescription.length > 155 ? "…" : "");
  const pageTitle = rating
    ? `${title} – vurdering og podcastinfo | Podcastlisten`
    : `${title} – podcast, info og vurderinger | Podcastlisten`;
  return { id, title, slug, shortDescription, longDescription, description, host, publisher, genre, secondaryGenre, rating, cover, canonical, metaDescription, pageTitle };
}

export function renderPage(data) {
  const details = [["Vært", data.host], ["Udgiver", data.publisher], ["Genre", data.genre], ["Sekundær genre", data.secondaryGenre]]
    .filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("\n        ");
  const image = data.cover ? `<img class="cover" src="${escapeHtml(data.cover)}" alt="Cover til ${escapeHtml(data.title)}" />` : "";
  const ogImage = data.cover ? `\n    <meta property="og:image" content="${escapeHtml(data.cover)}" />` : "";
  const rating = data.rating ? `<section aria-labelledby="rating"><h2 id="rating">Podcastlistens vurdering</h2><p><strong>${escapeHtml(data.rating)} / 10</strong></p></section>` : "";
  const facts = details ? `<section aria-labelledby="facts"><h2 id="facts">Fakta</h2><dl>${details}</dl></section>` : "";
  return `<!DOCTYPE html>
<html lang="da">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(data.pageTitle)}</title>
    <meta name="description" content="${escapeHtml(data.metaDescription)}" />
    <link rel="canonical" href="${data.canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Podcastlisten" />
    <meta property="og:title" content="${escapeHtml(data.pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(data.metaDescription)}" />
    <meta property="og:url" content="${data.canonical}" />${ogImage}
    <style>body{margin:0;background:#f8f6f2;color:#17201f;font:16px/1.6 system-ui,sans-serif}.page{max-width:760px;margin:auto;padding:32px 20px 56px}a{color:#075f59}.brand{font-weight:700;text-decoration:none}.cover{width:min(280px,100%);border-radius:12px;margin:24px 0;display:block}.cta{display:inline-block;background:#075f59;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700}h1{line-height:1.15;margin:24px 0 12px}h2{margin:28px 0 8px;line-height:1.25}p{max-width:70ch}dl{display:grid;gap:10px;margin:0;max-width:42rem}dl div{display:grid;grid-template-columns:minmax(8rem,12rem) 1fr;gap:12px}dt{font-weight:700}dd{margin:0}@media (max-width:420px){.page{padding:24px 16px 40px}dl div{grid-template-columns:1fr;gap:0}}</style>
  </head>
  <body><main class="page">
    <a class="brand" href="/">Podcastlisten</a>
    <h1>${escapeHtml(data.title)}</h1>
    ${image ? `<div>${image}</div>` : ""}
    <section aria-labelledby="about"><h2 id="about">Om podcasten</h2>
      <p>${escapeHtml(data.description)}</p>
    </section>
    ${rating}${facts}
    <p><a class="cta" href="/?podcast=${encodeURIComponent(data.id)}">Åbn ${escapeHtml(data.title)} i Podcastlisten</a></p>
    <p><a href="/">Tilbage til Podcastlisten</a></p>
  </main></body>
</html>`;
}

export function renderSitemap(pages) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["https://podcastlisten.dk/", ...pages.map((page) => page.canonical)].map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export async function generateSeoPodcastPages({ write = true } = {}) {
  const source = JSON.parse(await readFile(podcastsPath, "utf8"));
  const pages = resolvePilotPodcasts(source.rows).map(pageData);
  if (write) {
    await rm(podcastRoot, { recursive: true, force: true });
    for (const page of pages) {
      const output = path.join(podcastRoot, page.slug, "index.html");
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, renderPage(page), "utf8");
    }
    await writeFile(sitemapPath, renderSitemap(pages), "utf8");
  }
  return pages;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateSeoPodcastPages().then((pages) => console.log(`Generated ${pages.length} SEO pilot pages.`)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
