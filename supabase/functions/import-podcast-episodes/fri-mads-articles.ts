import type { FeedConfig } from "./feed-config.ts";
import type { PodcastEpisodeRow } from "./core.ts";

export const FRI_MADS_ARTICLES_FORMAT = "fri_mads_article_json" as const;
export const FRI_MADS_ARTICLES_FEED_KEY = "fri_mads_official_articles";
export const FRI_MADS_ARTICLES_SOURCE = "fri_mads_official_article";
export const FRI_MADS_ARTICLES_OVERVIEW_URL = "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/";
export const FRI_MADS_ARTICLES_CATALOGUE_ID = "catalogue-v1-d94fc39e";
export const FRI_MADS_ARTICLES_PODCAST_ID = "fri mads";
export const FRI_MADS_ARTICLES_FEED_URL = "https://podcastlisten.dk/data/fri-mads-articles.json";
const MAX_ARTICLES = 324;
const ARTICLE_TITLE = /^Fri Mads #([1-9]\d*)(?::\s+|\s+–\s+|\s+)\S/u;
const LEGACY_ARTICLE_NUMBERS = new Map<string, number>([
  ["https://frihedsbrevet.dk/fri-mads-manden-fra-cypern/", 6],
  ["https://frihedsbrevet.dk/lyd-over-land/", 3]
]);

function articlePathNumber(pathname: string): number | null {
  const match = String(pathname || "").match(/^\/fri-mads-(\d+)-([^/]+)\/$/u);
  if (!match) return null;
  try {
    const slug = decodeURIComponent(match[2]);
    if (!slug || !/^[\p{L}\p{M}\p{N}\p{S}\p{P}\u200d\ufe0f]+$/u.test(slug) ||
        /[\\/?#%]/u.test(slug) || slug === "." || slug === "..") return null;
  }
  catch { return null; }
  return Number(match[1]);
}

export function parseFriMadsArticleSidecar(content: string, config: FeedConfig, _now: string): {
  fetched_count: number;
  episodes: PodcastEpisodeRow[];
  errors: Array<{ index: number; errors: string[] }>;
  warnings: Array<{ index: number; warning: string }>;
  eligibility: { activeRateableEpisodes: number; excludedEntries: number; episodeFeatureEnabled: boolean };
} {
  const fail = (message: string): never => { throw new Error(message); };
  let sidecar: any;
  try { sidecar = JSON.parse(content); } catch { return fail("Fri Mads article metadata is not valid JSON"); }
  const expectedKeys = ["schemaVersion", "podcastId", "catalogueId", "sourceOverview", "accessType", "contentKind", "metadataOnly", "playable", "rateable", "audioUrl", "items"];
  if (!sidecar || typeof sidecar !== "object" || Array.isArray(sidecar) ||
      Object.keys(sidecar).sort().join("|") !== expectedKeys.slice().sort().join("|") ||
      sidecar.schemaVersion !== 1 || sidecar.podcastId !== FRI_MADS_ARTICLES_PODCAST_ID ||
      sidecar.catalogueId !== FRI_MADS_ARTICLES_CATALOGUE_ID || sidecar.sourceOverview !== FRI_MADS_ARTICLES_OVERVIEW_URL ||
      sidecar.accessType !== "paid" || sidecar.contentKind !== "article" || sidecar.metadataOnly !== true ||
      sidecar.playable !== false || sidecar.rateable !== false || sidecar.audioUrl !== null ||
      config.podcast_key !== FRI_MADS_ARTICLES_PODCAST_ID || config.source !== FRI_MADS_ARTICLES_SOURCE ||
      config.feed_url !== FRI_MADS_ARTICLES_FEED_URL) {
    return fail("Fri Mads article source identity or access classification mismatch");
  }
  if (!Array.isArray(sidecar.items) || sidecar.items.length < 1 || sidecar.items.length > MAX_ARTICLES) {
    return fail("Fri Mads article source item count is invalid");
  }

  const seenUrls = new Set<string>();
  const seenNumbers = new Set<number>();
  const episodes: PodcastEpisodeRow[] = [];
  for (let index = 0; index < sidecar.items.length; index += 1) {
    const item = sidecar.items[index];
    const itemKeys = ["releaseId", "releaseNumber", "title", "publishedDate", "canonicalUrl"];
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).sort().join("|") !== itemKeys.slice().sort().join("|")) {
      return fail("Fri Mads article record shape is invalid");
    }
    const number = Number(item.releaseNumber);
    const titleMatch = typeof item.title === "string" ? item.title.match(ARTICLE_TITLE) : null;
    let url: URL;
    try { url = new URL(String(item.canonicalUrl || "")); } catch { return fail("Fri Mads article permalink is invalid"); }
    const pathNumber = articlePathNumber(url.pathname);
    const date = typeof item.publishedDate === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(item.publishedDate)
      ? new Date(`${item.publishedDate}T00:00:00.000Z`) : null;
    if (!Number.isSafeInteger(number) || number < 1 || !titleMatch || Number(titleMatch[1]) !== number ||
        !date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== item.publishedDate ||
        url.protocol !== "https:" || url.origin !== "https://frihedsbrevet.dk" || url.port || url.username || url.password ||
        url.search || url.hash || url.href !== item.canonicalUrl ||
        (pathNumber !== number && LEGACY_ARTICLE_NUMBERS.get(item.canonicalUrl) !== number) ||
        item.releaseId !== `fri-mads:${number}:${item.canonicalUrl}` || seenNumbers.has(number) || seenUrls.has(item.canonicalUrl)) {
      return fail("Fri Mads article identity, title, date, or permalink conflicts");
    }
    if (index > 0 && Number(sidecar.items[index - 1].releaseNumber) - number !== 1) {
      return fail("Fri Mads article sequence contains a number gap");
    }
    seenNumbers.add(number);
    seenUrls.add(item.canonicalUrl);
    episodes.push({
      podcast_key: FRI_MADS_ARTICLES_PODCAST_ID,
      source: FRI_MADS_ARTICLES_SOURCE,
      // The official overview has no GUID. Its exact canonical permalink is
      // the verified stable source identity; no synthetic GUID is invented.
      external_guid: item.canonicalUrl,
      external_episode_id: null,
      title: item.title,
      description: null,
      published_at: date.toISOString(),
      duration_seconds: null,
      episode_url: item.canonicalUrl,
      audio_url: null,
      image_url: null,
      is_active: true,
      metadata: {
        format: FRI_MADS_ARTICLES_FORMAT,
        podcast_id: FRI_MADS_ARTICLES_PODCAST_ID,
        catalogue_id: FRI_MADS_ARTICLES_CATALOGUE_ID,
        source_overview: FRI_MADS_ARTICLES_OVERVIEW_URL,
        release_id: item.releaseId,
        release_number: number,
        canonical_url: item.canonicalUrl,
        source_guid: null,
        source_guid_status: "official_overview_has_no_guid",
        access_type: "paid",
        content_kind: "article",
        metadata_only: true,
        playable: false,
        rateable: true,
        exclusion_reason: null
      }
    });
  }

  return {
    fetched_count: sidecar.items.length,
    episodes,
    errors: [],
    warnings: [],
    eligibility: { activeRateableEpisodes: episodes.length, excludedEntries: 0, episodeFeatureEnabled: episodes.length >= 2 }
  };
}
