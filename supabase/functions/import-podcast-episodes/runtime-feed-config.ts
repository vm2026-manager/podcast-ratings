import { FEED_CONFIGS, type FeedConfig, type FeedConfigMap } from "./feed-config.ts";
import { appleShowUrl, parseAppleFeed, parseHttpFeed } from "./feed-syntax.mjs";

const PODCASTS_JSON_TIMEOUT_MS = 15000;

export type FeedConfigAudit = {
  static_feed_count: number;
  dynamic_sheet_feed_count: number;
  duplicates_skipped: number;
  duplicate_feed_urls_detected: number;
  duplicate_feed_urls: Array<{ feed_url: string; feed_keys: string[] }>;
  duplicate_feed_urls_skipped: Array<{ feed_url: string; skipped_feed_key: string }>;
  invalid_feed_urls_skipped: number;
  missing_podcast_ids_skipped: number;
  total_enabled_feeds: number;
  podcasts_json_url_configured: boolean;
  dynamic_feed_load_error?: string;
};

function normalizePodcastKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9\u00e6\u00f8\u00e5 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toFeedKey(podcastId: unknown): string {
  return normalizePodcastKey(podcastId).replace(/\s+/g, "_");
}

function getPodcastId(row: Record<string, unknown>): string {
  return String(row["Podcast-ID"] ?? row["Podcast ID"] ?? row.PodcastID ?? "").trim();
}

function getPodcastRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((row) => row && typeof row === "object");
  if (payload && typeof payload === "object" && Array.isArray((payload as { rows?: unknown }).rows)) {
    return (payload as { rows: unknown[] }).rows.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
  }
  return [];
}

function getStaticPodcastKeys(configs: FeedConfigMap): Set<string> {
  return new Set(
    Object.values(configs)
      .map((config) => normalizePodcastKey(config.podcast_key))
      .filter(Boolean)
  );
}

function getManualStaticConfigs(configs: FeedConfigMap): FeedConfigMap {
  return Object.fromEntries(
    Object.entries(configs).filter(([, config]) => config.generated_from_sheet !== true)
  );
}

function findDuplicateFeedUrls(configs: FeedConfigMap): Array<{ feed_url: string; feed_keys: string[] }> {
  const byUrl = new Map<string, string[]>();
  for (const [feedKey, config] of Object.entries(configs)) {
    const normalizedUrl = parseHttpFeed(config.feed_url)?.toLowerCase();
    if (!normalizedUrl) continue;
    byUrl.set(normalizedUrl, [...(byUrl.get(normalizedUrl) || []), feedKey]);
  }
  return [...byUrl.entries()]
    .filter(([, feedKeys]) => feedKeys.length > 1)
    .map(([feedUrl, feedKeys]) => ({ feed_url: feedUrl, feed_keys: feedKeys.sort() }));
}

export function mergeSheetFeedConfigs(
  sheetPayload: unknown,
  staticConfigs: FeedConfigMap = FEED_CONFIGS
): { configs: FeedConfigMap; audit: Omit<FeedConfigAudit, "podcasts_json_url_configured" | "dynamic_feed_load_error"> } {
  const manualStaticConfigs = getManualStaticConfigs(staticConfigs);
  const configs: FeedConfigMap = { ...manualStaticConfigs };
  const staticKeys = new Set(Object.keys(manualStaticConfigs));
  const staticPodcastKeys = getStaticPodcastKeys(manualStaticConfigs);
  const seenSources = new Set(Object.values(manualStaticConfigs).map((config) => config.source));
  const seenFeedUrls = new Set(
    Object.values(manualStaticConfigs)
      .map((config) => parseHttpFeed(config.feed_url)?.toLowerCase())
      .filter(Boolean)
  );
  const seenAppleShowIds = new Set(Object.values(manualStaticConfigs).filter((config) => config.format === "apple_podcasts_html").map((config) => config.apple_show_id).filter(Boolean));
  const seenPodcastKeys = new Set(staticPodcastKeys);
  const duplicateFeedUrlsSkipped: Array<{ feed_url: string; skipped_feed_key: string }> = [];
  let dynamicSheetFeedCount = 0;
  let duplicatesSkipped = 0;
  let invalidFeedUrlsSkipped = 0;
  let missingPodcastIdsSkipped = 0;

  for (const row of getPodcastRows(sheetPayload)) {
    const rawFeed = row.Feed ?? row.feed;
    const apple = parseAppleFeed(rawFeed);
    const feedUrl = parseHttpFeed(rawFeed);
    const podcastId = getPodcastId(row);
    const podcastKey = podcastId;
    const feedKey = apple ? `apple_${apple.appleShowId}` : toFeedKey(podcastId);

    if (!String(row.Feed ?? row.feed ?? "").trim()) continue;
    if (!podcastId) {
      missingPodcastIdsSkipped += 1;
      continue;
    }
    if ((!feedUrl && !apple) || !podcastKey || !feedKey) {
      invalidFeedUrlsSkipped += 1;
      continue;
    }

    // Static configs own special adapters and always take precedence.
    const source = apple ? `apple_podcasts_${apple.appleShowId}` : `sheet_${feedKey}_rss`;
    const normalizedFeedUrl = feedUrl?.toLowerCase();
    if (staticKeys.has(feedKey) || seenPodcastKeys.has(podcastKey) || seenSources.has(source) || (apple && seenAppleShowIds.has(apple.appleShowId)) || (!apple && normalizedFeedUrl && seenFeedUrls.has(normalizedFeedUrl))) {
      duplicatesSkipped += 1;
      if (!apple && normalizedFeedUrl && seenFeedUrls.has(normalizedFeedUrl)) {
        duplicateFeedUrlsSkipped.push({ feed_url: normalizedFeedUrl, skipped_feed_key: feedKey });
      }
      continue;
    }

    configs[feedKey] = {
      podcast_key: podcastKey,
      source,
      feed_url: apple ? appleShowUrl(apple.appleShowId) : feedUrl,
      format: apple ? "apple_podcasts_html" : "rss",
      ...(apple ? { apple_show_id: apple.appleShowId, enabled: false } : { enabled: true })
    };
    seenPodcastKeys.add(podcastKey);
    seenSources.add(source);
    if (normalizedFeedUrl) seenFeedUrls.add(normalizedFeedUrl);
    if (apple) seenAppleShowIds.add(apple.appleShowId);
    dynamicSheetFeedCount += 1;
  }

  return {
    configs,
    audit: {
      static_feed_count: Object.keys(manualStaticConfigs).length,
      dynamic_sheet_feed_count: dynamicSheetFeedCount,
      duplicates_skipped: duplicatesSkipped,
      duplicate_feed_urls_detected: findDuplicateFeedUrls(configs).length,
      duplicate_feed_urls: findDuplicateFeedUrls(configs),
      duplicate_feed_urls_skipped: duplicateFeedUrlsSkipped,
      invalid_feed_urls_skipped: invalidFeedUrlsSkipped,
      missing_podcast_ids_skipped: missingPodcastIdsSkipped,
      total_enabled_feeds: Object.values(configs).filter((config) => config.enabled !== false).length
    }
  };
}

async function fetchSheetPayload(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PODCASTS_JSON_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`podcasts.json fetch failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadRuntimeFeedConfigs(options: {
  podcastsJsonUrl?: string | null;
  fetchPayload?: (url: string) => Promise<unknown>;
  staticConfigs?: FeedConfigMap;
} = {}): Promise<{ configs: FeedConfigMap; audit: FeedConfigAudit }> {
  const staticConfigs = getManualStaticConfigs(options.staticConfigs || FEED_CONFIGS);
  const podcastsJsonUrl = parseHttpFeed(options.podcastsJsonUrl || Deno.env.get("PODCASTS_JSON_URL"));
  const baseAudit = {
    static_feed_count: Object.keys(staticConfigs).length,
    dynamic_sheet_feed_count: 0,
    duplicates_skipped: 0,
    duplicate_feed_urls_detected: findDuplicateFeedUrls(staticConfigs).length,
    duplicate_feed_urls: findDuplicateFeedUrls(staticConfigs),
    duplicate_feed_urls_skipped: [],
    invalid_feed_urls_skipped: 0,
    missing_podcast_ids_skipped: 0,
    total_enabled_feeds: Object.values(staticConfigs).filter((config) => config.enabled !== false).length,
    podcasts_json_url_configured: Boolean(podcastsJsonUrl)
  };

  if (!podcastsJsonUrl) return { configs: { ...staticConfigs }, audit: baseAudit };

  try {
    const payload = await (options.fetchPayload || fetchSheetPayload)(podcastsJsonUrl);
    const merged = mergeSheetFeedConfigs(payload, staticConfigs);
    return {
      configs: merged.configs,
      audit: { ...merged.audit, podcasts_json_url_configured: true }
    };
  } catch (error) {
    return {
      configs: { ...staticConfigs },
      audit: {
        ...baseAudit,
        dynamic_feed_load_error:
          error instanceof Error ? error.message.slice(0, 180) : "podcasts.json fetch failed"
      }
    };
  }
}
