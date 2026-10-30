import { FEED_CONFIGS, DJAEVLEN_LYD_FULL_FEED_KEY, BAKSPEJL_LYD_FULL_FEED_KEY, type FeedConfig, type FeedConfigMap } from "./feed-config.ts";
import { APPROVED_SHEET_FEED_BASELINE } from "./sheet-feed-approval-baseline.ts";
import { appleShowUrl, parseAppleFeed, parseHttpFeed, parsePodimoShowFeed } from "./feed-syntax.mjs";
import { applySheetFeedPolicy, type FeedResolution } from "./sheet-feed-policy.ts";
import { buildDjaevlenRoutes, DJAEVLEN_FEED_KEY } from "./djaevlen-routing.mjs";
import { buildBakspejlRoutes, BAKSPEJL_FEED_KEY } from "./bakspejl-routing.mjs";
import { PODIMO_ONGOING_HISTORICAL_SOURCES } from "./podimo-source-registry.ts";

const PODCASTS_JSON_TIMEOUT_MS = 15000;

export type FeedConfigAudit = {
  feed_resolutions: FeedResolution[];
  feed_warnings: FeedResolution[];
  active_feeds: Array<{ feed_key: string; podcast_key: string; feed_url: string; source: string; enabled: boolean; origin: string }>;
  static_feed_count: number;
  dynamic_sheet_feed_count: number;
  duplicates_skipped: number;
  duplicate_feed_urls_detected: number;
  duplicate_feed_urls: Array<{ feed_url: string; feed_keys: string[] }>;
  duplicate_feed_urls_skipped: Array<{ feed_url: string; skipped_feed_key: string }>;
  invalid_feed_urls_skipped: number;
  missing_podcast_ids_skipped: number;
  djaevlen_route_count: number;
  bakspejl_route_count: number;
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

const approvedSheetFeeds = APPROVED_SHEET_FEED_BASELINE.map(([podcast_key, feed_url]) => ({
  podcast_key, feed_url, feed_key: toFeedKey(podcast_key), source: `sheet_${toFeedKey(podcast_key)}_rss`
}));

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

function hasVerifiedStotMedianoIdentity(rows: Array<Record<string, unknown>>): boolean {
  const expectedId = "stot mediano";
  const expectedTitle = "Støt Mediano";
  const candidates = rows.filter((row) => {
    const id = getPodcastId(row).normalize("NFC").toLocaleLowerCase("da-DK");
    const title = String(row.Titel ?? "").trim().normalize("NFC").toLocaleLowerCase("da-DK");
    return id === expectedId || title === expectedTitle.toLocaleLowerCase("da-DK");
  });
  return candidates.length === 1 &&
    getPodcastId(candidates[0]) === expectedId &&
    String(candidates[0].Titel ?? "").trim().normalize("NFC") === expectedTitle;
}

function getStaticPodcastKeys(configs: FeedConfigMap): Set<string> {
  return new Set(
    Object.values(configs)
      .flatMap((config) => [config.podcast_key, ...(config.owned_podcast_keys || [])])
      .map((key) => normalizePodcastKey(key))
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
  const approvedFeeds = staticConfigs === FEED_CONFIGS ? approvedSheetFeeds : [];
  const approvedFeedsByPodcast = new Map(approvedFeeds.map(entry => [entry.podcast_key, entry]));
  const approvedFeedsByUrl = new Map(approvedFeeds.map(entry => [entry.feed_url.toLowerCase(), entry]));
  const approvedFeedKeys = new Set(approvedFeeds.map(entry =>
    `${entry.podcast_key}\u0000${entry.feed_key}\u0000${entry.source}\u0000${entry.feed_url}`));
  const manualStaticConfigs = getManualStaticConfigs(staticConfigs);
  const rows = getPodcastRows(sheetPayload);
  const djaevlen = buildDjaevlenRoutes(rows);
  const djaevlenOwner = manualStaticConfigs[DJAEVLEN_FEED_KEY];
  const bakspejl = buildBakspejlRoutes(rows);
  const bakspejlOwner = manualStaticConfigs[BAKSPEJL_FEED_KEY];
  const djaevlenFullOwner = manualStaticConfigs[DJAEVLEN_LYD_FULL_FEED_KEY];
  const bakspejlFullOwner = manualStaticConfigs[BAKSPEJL_LYD_FULL_FEED_KEY];
  const configs: FeedConfigMap = {
    ...manualStaticConfigs,
    ...(djaevlenOwner ? {
      [DJAEVLEN_FEED_KEY]: {
        ...djaevlenOwner,
        routes: djaevlen.routes,
        // Never activate an unrouted umbrella feed: there is no safe fallback.
        enabled: djaevlen.routes.length > 0
      }
    } : {}),
    ...(bakspejlOwner ? { [BAKSPEJL_FEED_KEY]: { ...bakspejlOwner, routes: bakspejl.routes, enabled: bakspejl.routes.length > 1 } } : {}),
    // Supplemental full-episode adapters use the same exact catalogue routes.
    // Never activate an umbrella without the authoritative sheet mapping.
    ...(djaevlenFullOwner ? { [DJAEVLEN_LYD_FULL_FEED_KEY]: { ...djaevlenFullOwner, routes: djaevlen.routes, enabled: djaevlen.routes.length > 0 } } : {}),
    ...(bakspejlFullOwner ? { [BAKSPEJL_LYD_FULL_FEED_KEY]: { ...bakspejlFullOwner, routes: bakspejl.routes, enabled: bakspejl.routes.length > 1 } } : {})
  };
  // Keep every previously approved ordinary Sheet feed active even if its
  // editable metadata is temporarily changed, blank, or absent. A replacement
  // URL is reviewed below and cannot displace this code-owned source.
  for (const approved of approvedFeeds) {
    if (configs[approved.feed_key]) {
      throw new Error(`Approved Sheet feed key conflicts with static config: ${approved.feed_key}`);
    }
    configs[approved.feed_key] = {
      podcast_key: approved.podcast_key,
      source: approved.source,
      feed_url: approved.feed_url,
      format: "rss",
      enabled: true,
      generated_from_sheet: true
    };
  }
  // Støt Mediano is a category-only destination. Activate only this route,
  // and only from one exact canonical identity in the fetched catalogue.
  if (hasVerifiedStotMedianoIdentity(rows)) {
    const siteFeed = configs.mediano_site;
    if (siteFeed?.routes?.some((route) => route.key === "stot_mediano")) {
      configs.mediano_site = {
        ...siteFeed,
        routes: siteFeed.routes.map((route) => route.key === "stot_mediano"
          ? { ...route, podcast_key: "stot mediano" }
          : route)
      };
    }
  }
  // Activate only an exact Sheet Podcast-ID + Podimo show-ID match to a
  // historical source already verified in production. Unknown IDs, aliases,
  // stale shows and any existing owner ambiguity remain review-required.
  for (const row of rows) {
    const rawFeed = row.Feed ?? row.feed;
    const podimo = parsePodimoShowFeed(rawFeed);
    const podcastId = getPodcastId(row);
    if (!podimo || !podcastId) continue;
    const historical = PODIMO_ONGOING_HISTORICAL_SOURCES.find(entry =>
      normalizePodcastKey(entry.podcast_key) === normalizePodcastKey(podcastId) &&
      entry.podcast_id === podimo.showId);
    if (!historical || configs[historical.source]) continue;
    if (Object.values(configs).some(config => normalizePodcastKey(config.podcast_key) === normalizePodcastKey(podcastId))) continue;
    configs[historical.source] = {
      podcast_key: historical.podcast_key,
      source: historical.source,
      feed_url: "https://graphql.podimo.com/graphql",
      format: "podimo_graphql",
      podcast_id: historical.podcast_id,
      podimo_show_url: podimo.url,
      podimo_history_overlap_minimum: 3,
      generated_from_sheet: true
    };
  }
  const policy = applySheetFeedPolicy(rows, configs, getPodcastId, normalizePodcastKey);
  const staticKeys = new Set(Object.keys(manualStaticConfigs));
  const staticPodcastKeys = getStaticPodcastKeys(manualStaticConfigs);
  const seenSources = new Set(Object.values(configs).map((config) => config.source));
  const seenFeedUrls = new Set(
    Object.values(configs)
      .map((config) => parseHttpFeed(config.feed_url)?.toLowerCase())
      .filter(Boolean)
  );
  const seenAppleShowIds = new Set(Object.values(manualStaticConfigs).filter((config) => config.format === "apple_podcasts_html").map((config) => config.apple_show_id).filter(Boolean));
  const seenPodcastKeys = new Set([
    ...staticPodcastKeys,
    ...approvedFeeds.map(entry => entry.podcast_key)
  ]);
  const duplicateFeedUrlsSkipped: Array<{ feed_url: string; skipped_feed_key: string }> = [];
  let dynamicSheetFeedCount = approvedFeeds.length;
  let duplicatesSkipped = 0;
  let invalidFeedUrlsSkipped = 0;
  let missingPodcastIdsSkipped = 0;

  for (const row of rows) {
    if (policy.handled.has(row)) continue;
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

    // Existing owners were resolved/reported by the policy above.
    const source = apple ? `apple_podcasts_${apple.appleShowId}` : `sheet_${feedKey}_rss`;
    const normalizedFeedUrl = feedUrl?.toLowerCase();
    if (staticKeys.has(feedKey) || seenPodcastKeys.has(podcastKey) || seenSources.has(source) || (apple && seenAppleShowIds.has(apple.appleShowId)) || (!apple && normalizedFeedUrl && seenFeedUrls.has(normalizedFeedUrl))) {
      duplicatesSkipped += 1;
      if (!apple && normalizedFeedUrl && seenFeedUrls.has(normalizedFeedUrl)) {
        duplicateFeedUrlsSkipped.push({ feed_url: normalizedFeedUrl, skipped_feed_key: feedKey });
      }
      continue;
    }

    if (!apple && feedUrl) {
      const approvedOwner = approvedFeedsByUrl.get(feedUrl.toLowerCase());
      if (approvedOwner && approvedOwner.podcast_key !== podcastKey) {
        duplicatesSkipped += 1;
        duplicateFeedUrlsSkipped.push({ feed_url: normalizedFeedUrl!, skipped_feed_key: feedKey });
        policy.resolutions.push({ podcast_key: podcastKey, sheet_feed: String(rawFeed).trim(),
          active_feed_urls: [approvedOwner.feed_url], origin: "review_required", differs_from_sheet: true,
          reason: "feed_owned_by_other_podcast" });
        continue;
      }
    }

    const approvedSheetFeed = !apple && feedUrl &&
      approvedFeedKeys.has(`${podcastKey}\u0000${feedKey}\u0000${source}\u0000${feedUrl}`);
    if (!apple && feedUrl && !approvedSheetFeed) {
      const previous = approvedFeedsByPodcast.get(podcastKey);
      // The previous URL stays configured and active from the code-owned
      // baseline. The candidate is recorded for review, never as an importer.
      if (!previous) {
        configs[feedKey] = {
          podcast_key: podcastKey,
          source,
          feed_url: feedUrl,
          format: "rss",
          enabled: false
        };
      }
      policy.resolutions.push({ podcast_key: podcastKey, sheet_feed: String(rawFeed).trim(),
        active_feed_urls: previous ? [previous.feed_url] : [], origin: "review_required",
        differs_from_sheet: true,
        reason: previous ? "feed_change_requires_code_approval" : "explicit_activation_required" });
      dynamicSheetFeedCount += 1;
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
      feed_resolutions: policy.resolutions,
      feed_warnings: policy.resolutions.filter(entry => entry.origin === "review_required"),
      active_feeds: Object.entries(configs).map(([key, config]) => ({
        feed_key: key, podcast_key: config.podcast_key, feed_url: config.feed_url,
        source: config.source, enabled: config.enabled !== false,
        origin: policy.resolutions.some(entry => entry.podcast_key === config.podcast_key && entry.origin === "sheet_override")
          ? "sheet_override" : staticKeys.has(key) ? "static" : "sheet"
      })),
      static_feed_count: Object.keys(manualStaticConfigs).length,
      dynamic_sheet_feed_count: dynamicSheetFeedCount,
      duplicates_skipped: duplicatesSkipped,
      duplicate_feed_urls_detected: findDuplicateFeedUrls(configs).length,
      duplicate_feed_urls: findDuplicateFeedUrls(configs),
      duplicate_feed_urls_skipped: duplicateFeedUrlsSkipped,
      invalid_feed_urls_skipped: invalidFeedUrlsSkipped + policy.resolutions.filter(entry => entry.reason === "invalid_or_non_rss_feed").length,
      missing_podcast_ids_skipped: missingPodcastIdsSkipped + policy.resolutions.filter(entry => entry.reason === "missing_podcast_id").length,
      djaevlen_route_count: djaevlen.routes.length,
      bakspejl_route_count: bakspejl.routes.length,
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
  const sourceStaticConfigs = options.staticConfigs || FEED_CONFIGS;
  const staticConfigs = getManualStaticConfigs(sourceStaticConfigs);
  const podcastsJsonUrl = parseHttpFeed(options.podcastsJsonUrl || Deno.env.get("PODCASTS_JSON_URL"));
  const baseAudit = {
    feed_resolutions: [],
    feed_warnings: [],
    active_feeds: Object.entries(staticConfigs).map(([key, config]) => ({
      feed_key: key, podcast_key: config.podcast_key, feed_url: config.feed_url,
      source: config.source, enabled: config.enabled !== false, origin: "static"
    })),
    static_feed_count: Object.keys(staticConfigs).length,
    dynamic_sheet_feed_count: 0,
    duplicates_skipped: 0,
    duplicate_feed_urls_detected: findDuplicateFeedUrls(staticConfigs).length,
    duplicate_feed_urls: findDuplicateFeedUrls(staticConfigs),
    duplicate_feed_urls_skipped: [],
    invalid_feed_urls_skipped: 0,
    missing_podcast_ids_skipped: 0,
    djaevlen_route_count: 0,
    bakspejl_route_count: 0,
    total_enabled_feeds: Object.values(staticConfigs).filter((config) => config.enabled !== false).length,
    podcasts_json_url_configured: Boolean(podcastsJsonUrl)
  };

  if (!podcastsJsonUrl) return { configs: { ...staticConfigs }, audit: baseAudit };

  try {
    const payload = await (options.fetchPayload || fetchSheetPayload)(podcastsJsonUrl);
    const merged = mergeSheetFeedConfigs(payload, sourceStaticConfigs);
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
