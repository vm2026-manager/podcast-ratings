export const BAKSPEJL_FEED_URL = "https://api.dr.dk/podcasts/v1/feeds/bakspejl";
export const BAKSPEJL_FEED_KEY = "bakspejl";
export const BAKSPEJL_SOURCE = "sheet_la_riots_rss";
export const BAKSPEJL_IMPORT_LABEL = "la riots";

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

export function buildBakspejlRoutes(rows) {
  const skipped = { missing_title: 0, missing_podcast_id: 0 };
  const routes = [{ key: "bakspejl:dr-promo", podcast_key: BAKSPEJL_IMPORT_LABEL, priority: 100, title: { patterns: [/^h(?:ø|o)r flere afsnit af denne\b.*\bdr lyd\b/iu] } }];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (normalized(row?.Hovedserie ?? row?.mainSeries) !== normalized("Bakspejl")) continue;
    const title = String(row?.Titel ?? row?.Title ?? row?.title ?? "").trim();
    const podcastKey = String(row?.["Podcast-ID"] ?? row?.podcast_id ?? "").trim();
    if (!title) { skipped.missing_title += 1; continue; }
    if (!podcastKey) { skipped.missing_podcast_id += 1; continue; }
    routes.push({
      key: `bakspejl:${podcastKey}`,
      podcast_key: podcastKey,
      title: { patterns: [titlePattern(title)] }
    });
  }
  return { routes, skipped };
}
