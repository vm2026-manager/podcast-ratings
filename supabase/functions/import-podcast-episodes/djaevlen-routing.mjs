export const DJAEVLEN_FEED_URL = "https://api.dr.dk/podcasts/v1/feeds/djaevlen-i-detaljen";
export const DJAEVLEN_FEED_KEY = "djaevlen_i_detaljen";
export const DJAEVLEN_SOURCE = "sheet_danmarks_vaerste_massemorder_rss";
export const DJAEVLEN_IMPORT_LABEL = "danmarks vaerste massemorder";

function normalized(value) {
  return String(value ?? "").trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("da-DK").replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titlePattern(title) {
  const words = normalized(title).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(escapeRegExp);
  // A title route must start the feed item (apart from DR's verified Teaser:
  // prefix). Punctuation between title words is deliberately flexible, but no
  // description or fuzzy matching is used.
  return new RegExp(`^(?:teaser\\s*:\\s*)?${words.join("[^\\p{L}\\p{N}]+")}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

export function buildDjaevlenRoutes(rows) {
  const skipped = { missing_title: 0, missing_podcast_id: 0 };
  const routes = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (normalized(row?.Hovedserie ?? row?.mainSeries) !== normalized("Djævlen i detaljen")) continue;
    const title = String(row?.Titel ?? row?.Title ?? row?.title ?? "").trim();
    const podcastKey = String(row?.["Podcast-ID"] ?? row?.podcast_id ?? "").trim();
    if (!title) { skipped.missing_title += 1; continue; }
    if (!podcastKey) { skipped.missing_podcast_id += 1; continue; }
    routes.push({
      key: `djaevlen:${podcastKey}`,
      podcast_key: podcastKey,
      title: { patterns: [titlePattern(title)] }
    });
  }
  return { routes, skipped };
}
