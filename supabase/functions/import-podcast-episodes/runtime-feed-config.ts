import { FEED_CONFIGS, DJAEVLEN_LYD_FULL_FEED_KEY, BAKSPEJL_LYD_FULL_FEED_KEY, type FeedConfig, type FeedConfigMap } from "./feed-config.ts";
import { APPROVED_SHEET_FEED_BASELINE } from "./sheet-feed-approval-baseline.ts";
import { appleShowUrl, parseAppleFeed, parseHttpFeed, parsePodimoShowFeed } from "./feed-syntax.mjs";

// Explicitly retain the Apple HTML sources that already have episode history.
// Both identifiers must match the live catalogue row; this does not approve a
// new Apple ID or let a changed show claim another podcast's episode history.
const APPROVED_LEGACY_APPLE_SHEET_FEEDS = new Map<string, string>([
  ["1868403164", "arnesen og lerby"], ["1843832125", "bedraget af en svindler"],
  ["1896612889", "bøvlede mænd"], ["1694478208", "casper elsker dig"],
  ["1472183999", "danske drabssager"], ["1743434255", "data i sport kristoffer just"],
  ["1519774517", "den yderste grænse"], ["6818511364", "eksterne affaerer r8dio frihedsbrevet"],
  ["1782097164", "en anden tid"], ["6801169655", "espn laliga espn dk"],
  ["1681480800", "fuhlendorff i fængsel"], ["1642886329", "geggo og cengiz helt ærligt"],
  ["1737734007", "hærfører"], ["1609960523", "hav og kamal"],
  ["1584822502", "hvor er mit ansigt"], ["1491016826", "hypnotisøren"],
  ["1853366115", "kaere chantal"], ["1885473282", "kendte korer syge biler med joachim stender"],
  ["1715936714", "kirsten ringer til rasmus sæson 4"], ["6805489064", "kobenhavneriet"],
  ["1575533784", "mads og a holdet"], ["1754133240", "mit livs sexferie"],
  ["1770359151", "narkobetjenten pa gaden sæson 1"], ["1893329271", "om sider"],
  ["1727543781", "øverste hylde"], ["1634003610", "partners in crime"],
  ["1564898615", "pilestræde"], ["1728853305", "ren ondskab ally"],
  ["1896684988", "revolver"], ["1646639024", "sadan er politik"],
  ["1740537993", "skyggesiden"], ["1605795064", "spionchefens hemmelighed"],
  ["1810234189", "spotlight"], ["1653138467", "stolpe ind"],
  ["6801138720", "styr pa verden"], ["1843557403", "transferguru"],
  ["1896933613", "under tøjet"], ["1632594695", "vesth mysteriet om scandinavian star"],
  ["1649708700", "voxen"]
]);
import { applySheetFeedPolicy, isOrdinaryRssUrl, type FeedResolution } from "./sheet-feed-policy.ts";
import { buildDjaevlenRoutes, DJAEVLEN_FEED_KEY } from "./djaevlen-routing.mjs";
import { buildBakspejlRoutes, BAKSPEJL_FEED_KEY } from "./bakspejl-routing.mjs";
import { buildRadioIIIIRoutes, RADIO_IIII_FEED_KEY } from "./radio-iiii-routing.mjs";
import { PODIMO_ONGOING_HISTORICAL_SOURCES } from "./podimo-source-registry.ts";

const PODCASTS_JSON_TIMEOUT_MS = 15000;

// Radio IIII has verified route identities, but its production rollout is
// separately gated. Keep the routes available for audit and tests while
// preventing both scheduled and direct importer activation until an approved
// code change explicitly opens this boundary.
export const RADIO_IIII_IMPORT_ACTIVATION_APPROVED = false;

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

function createPodcastKeyNormalizer(): (value: unknown) => string {
  const cache = new Map<string, string>();
  return value => {
    const input = String(value ?? "");
    const cached = cache.get(input);
    if (cached !== undefined) return cached;
    const normalized = normalizePodcastKey(input);
    cache.set(input, normalized);
    return normalized;
  };
}

function toFeedKey(podcastId: unknown): string {
  return normalizePodcastKey(podcastId).replace(/\s+/g, "_");
}

const approvedSheetFeeds = APPROVED_SHEET_FEED_BASELINE.map(([podcast_key, feed_url, identity]) => ({
  ...identity, podcast_key, feed_url, feed_key: toFeedKey(podcast_key), source: `sheet_${toFeedKey(podcast_key)}_rss`
}));

function getPodcastId(row: Record<string, unknown>): string {
  return String(row["Podcast-ID"] ?? row["Podcast ID"] ?? row.PodcastID ?? "").trim();
}

type CountedCatalogueRow = { count: number; first: Record<string, unknown> };
type CatalogueRowIndexes = {
  exactPodcastIds: Map<string, CountedCatalogueRow>;
  normalizedPodcastIds: Map<string, number>;
  catalogueIds: Map<string, number>;
  verifiedRssUrls: Map<string, number>;
};

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) || 0) + 1);
}

function addCatalogueRow(map: Map<string, CountedCatalogueRow>, key: string, row: Record<string, unknown>): void {
  const current = map.get(key);
  if (current) current.count += 1;
  else map.set(key, { count: 1, first: row });
}

function indexCatalogueRows(rows: Array<Record<string, unknown>>, normalizeKey: (value: unknown) => string): CatalogueRowIndexes {
  const exactPodcastIds = new Map<string, CountedCatalogueRow>();
  const normalizedPodcastIds = new Map<string, number>();
  const catalogueIds = new Map<string, number>();
  const verifiedRssUrls = new Map<string, number>();
  for (const row of rows) {
    const podcastId = getPodcastId(row);
    addCatalogueRow(exactPodcastIds, podcastId, row);
    incrementCount(normalizedPodcastIds, normalizeKey(podcastId));
    incrementCount(catalogueIds, String(row.catalogue_id ?? "").trim());
    const verification = row.episodeFeedVerification as Record<string, unknown> | undefined;
    incrementCount(verifiedRssUrls, String(verification?.feed_url ?? "").toLowerCase());
  }
  return { exactPodcastIds, normalizedPodcastIds, catalogueIds, verifiedRssUrls };
}

function verifiedPodimoRssEvidence(
  row: Record<string, unknown>, indexes: CatalogueRowIndexes, normalizeKey: (value: unknown) => string
) {
  const verification = row.episodeFeedVerification as Record<string, unknown> | undefined;
  const id = getPodcastId(row);
  const rawFeed = String(row.Feed ?? row.feed ?? "").trim();
  const show = parsePodimoShowFeed(rawFeed);
  if (!show) return null;
  const catalogueId = String(row.catalogue_id ?? "").trim();
  const rssUrl = String(verification?.feed_url ?? "").trim();
  const exactRowCount = indexes.exactPodcastIds.get(id)?.count || 0;
  const normalizedRowCount = indexes.normalizedPodcastIds.get(normalizeKey(id)) || 0;
  const catalogueRowCount = indexes.catalogueIds.get(catalogueId) || 0;
  const rssOwnerCount = indexes.verifiedRssUrls.get(rssUrl.toLowerCase()) || 0;
  const valid = verification?.version === 1 && verification.status === "verified" &&
    verification.verification_kind === "apple_podimo_public_rss" &&
    verification.podcast_id === id && verification.catalogue_id === catalogueId &&
    verification.catalogue_feed_url === rawFeed && verification.official_url === String(row.Link ?? "").trim() &&
    verification.publisher === String(row.Udgiver ?? "").trim() && verification.podimo_show_id === show.showId &&
    typeof verification.apple_collection_id === "string" && /^\d+$/u.test(verification.apple_collection_id) &&
    typeof verification.apple_collection_url === "string" && verification.channel_title === String(row.Titel ?? "").trim() &&
    typeof verification.channel_link === "string" && verification.channel_link.startsWith("https://") &&
    verification.self_url === rssUrl && /^podimo(?:\s+studios)?$/iu.test(String(verification.channel_owner ?? "")) &&
    Number.isInteger(verification.unique_guid_count) && Number(verification.unique_guid_count) > 0 &&
    Number.isInteger(verification.full_episode_count) && Number(verification.full_episode_count) > 0 &&
    exactRowCount === 1 && normalizedRowCount === 1 && catalogueId !== "" && catalogueRowCount === 1 &&
    rssOwnerCount === 1 && isOrdinaryRssUrl(rssUrl);
  return valid ? { verification, rssUrl, showId: show!.showId, catalogueId } : null;
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

function getStaticPodcastKeys(configs: FeedConfigMap, normalizeKey: (value: unknown) => string): Set<string> {
  return new Set(
    Object.values(configs)
      .flatMap((config) => [config.podcast_key, ...(config.owned_podcast_keys || [])])
      .map((key) => normalizeKey(key))
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
  const normalizeKey = createPodcastKeyNormalizer();
  const approvedFeeds = staticConfigs === FEED_CONFIGS ? approvedSheetFeeds : [];
  const approvedFeedsByPodcast = new Map(approvedFeeds.map(entry => [entry.podcast_key, entry]));
  const approvedFeedsByUrl = new Map(approvedFeeds.map(entry => [entry.feed_url.toLowerCase(), entry]));
  const approvedFeedKeys = new Set(approvedFeeds.map(entry =>
    `${entry.podcast_key}\u0000${entry.feed_key}\u0000${entry.source}\u0000${entry.feed_url}`));
  const manualStaticConfigs = getManualStaticConfigs(staticConfigs);
  const rows = getPodcastRows(sheetPayload);
  const rowIndexes = indexCatalogueRows(rows, normalizeKey);
  const djaevlen = buildDjaevlenRoutes(rows);
  const djaevlenOwner = manualStaticConfigs[DJAEVLEN_FEED_KEY];
  const bakspejl = buildBakspejlRoutes(rows);
  const bakspejlOwner = manualStaticConfigs[BAKSPEJL_FEED_KEY];
  const radioIIII = buildRadioIIIIRoutes(rows);
  const radioIIIIOwner = manualStaticConfigs[RADIO_IIII_FEED_KEY];
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
    ...(radioIIIIOwner ? {
      [RADIO_IIII_FEED_KEY]: {
        ...radioIIIIOwner,
        routes: radioIIII,
        enabled: RADIO_IIII_IMPORT_ACTIVATION_APPROVED && radioIIII.length > 0
      }
    } : {}),
    // Supplemental full-episode adapters use the same exact catalogue routes.
    // Never activate an umbrella without the authoritative sheet mapping.
    ...(djaevlenFullOwner ? { [DJAEVLEN_LYD_FULL_FEED_KEY]: { ...djaevlenFullOwner, routes: djaevlen.routes, enabled: djaevlen.routes.length > 0 } } : {}),
    ...(bakspejlFullOwner ? { [BAKSPEJL_LYD_FULL_FEED_KEY]: { ...bakspejlFullOwner, routes: bakspejl.routes, enabled: bakspejl.routes.length > 1 } } : {})
  };
  // A reviewed exact Podimo mapping stays disabled unless the current Sheet
  // contains one exact canonical Podcast-ID and the same exact show UUID.
  // Either drift or ambiguity must fail closed before an import can be scheduled.
  for (const [feedKey, config] of Object.entries(configs)) {
    if (config.sheet_podimo_identity_required !== true) continue;
    const matching = rowIndexes.exactPodcastIds.get(config.podcast_key);
    const exactShow = matching?.count === 1 &&
      rowIndexes.normalizedPodcastIds.get(normalizeKey(config.podcast_key)) === 1 &&
      parsePodimoShowFeed(matching.first.Feed ?? matching.first.feed)?.showId === config.podcast_id?.toLowerCase() &&
      (!config.podimo_catalogue_id || (
        matching.first.catalogue_id === config.podimo_catalogue_id &&
        rowIndexes.catalogueIds.get(config.podimo_catalogue_id) === 1 &&
        String(matching.first.Link ?? "").trim() === config.podimo_show_url
      ));
    configs[feedKey] = { ...config, enabled: exactShow };
  }
  for (const [feedKey, config] of Object.entries(configs)) {
    if (config.podimo_public_rss_identity_required !== true) continue;
    const matching = rowIndexes.exactPodcastIds.get(config.podcast_key);
    const row = matching?.first;
    const show = row ? parsePodimoShowFeed(row.Feed ?? row.feed) : null;
    const competingFeedOwner = Object.entries(configs).some(([otherKey, other]) => otherKey !== feedKey &&
      parseHttpFeed(other.feed_url)?.toLowerCase() === config.feed_url.toLowerCase());
    const exactIdentity = matching?.count === 1 &&
      rowIndexes.normalizedPodcastIds.get(normalizeKey(config.podcast_key)) === 1 &&
      show?.showId === config.podimo_show_id && row?.catalogue_id === config.podimo_catalogue_id &&
      typeof config.podimo_catalogue_id === "string" &&
      rowIndexes.catalogueIds.get(config.podimo_catalogue_id) === 1 && !competingFeedOwner &&
      String(row?.Link ?? "").trim() === config.podimo_show_url &&
      String(row?.Titel ?? "").trim() === config.expected_rss_channel_title &&
      String(row?.Udgiver ?? "").trim() === "Podimo" &&
      isOrdinaryRssUrl(config.feed_url) && config.expected_rss_self_url === config.feed_url;
    configs[feedKey] = { ...config, enabled: exactIdentity };
  }
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
      generated_from_sheet: true,
      ...(approved.expected_rss_channel_title ? { expected_rss_channel_title: approved.expected_rss_channel_title } : {}),
      ...(approved.expected_external_guid_prefix ? { expected_external_guid_prefix: approved.expected_external_guid_prefix } : {})
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
      normalizeKey(entry.podcast_key) === normalizeKey(podcastId) &&
      entry.podcast_id === podimo.showId);
    if (!historical || configs[historical.source]) continue;
    if (Object.values(configs).some(config => normalizeKey(config.podcast_key) === normalizeKey(podcastId))) continue;
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
  for (const row of rows) {
    const attested = verifiedPodimoRssEvidence(row, rowIndexes, normalizeKey);
    if (!attested || rowIndexes.normalizedPodcastIds.get(normalizeKey(getPodcastId(row))) !== 1 ||
        rowIndexes.catalogueIds.get(attested.catalogueId) !== 1 ||
        rowIndexes.verifiedRssUrls.get(attested.rssUrl.toLowerCase()) !== 1) continue;
    const podcastKey = getPodcastId(row);
    const feedKey = `podimo_public_rss_${toFeedKey(podcastKey)}`;
    const source = `podimo_public_rss_${toFeedKey(podcastKey)}`;
    if (configs[feedKey] || Object.values(configs).some(config => config.source === source ||
        normalizeKey(config.podcast_key) === normalizeKey(podcastKey) ||
        parseHttpFeed(config.feed_url)?.toLowerCase() === attested.rssUrl.toLowerCase())) continue;
    configs[feedKey] = {
      podcast_key: podcastKey,
      source,
      feed_url: attested.rssUrl,
      format: "rss",
      enabled: true,
      generated_from_sheet: true,
      auto_verified_rss: true,
      podimo_public_rss_identity_required: true,
      podimo_show_id: attested.showId,
      podimo_show_url: String(row.Link ?? "").trim(),
      podimo_catalogue_id: attested.catalogueId,
      apple_collection_id: String(attested.verification.apple_collection_id),
      expected_rss_channel_title: String(attested.verification.channel_title),
      expected_rss_channel_link: String(attested.verification.channel_link),
      expected_rss_self_url: String(attested.verification.self_url),
      expected_rss_publisher: String(attested.verification.channel_owner),
      expected_rss_unique_guids: true
    };
  }
  const policy = applySheetFeedPolicy(rows, configs, getPodcastId, normalizeKey);
  const staticKeys = new Set(Object.keys(manualStaticConfigs));
  const staticPodcastKeys = getStaticPodcastKeys(manualStaticConfigs, normalizeKey);
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
        const verification = row.episodeFeedVerification as Record<string, unknown> | undefined;
        const exactIdRows = rowIndexes.exactPodcastIds.get(podcastId);
        const normalizedIdCount = rowIndexes.normalizedPodcastIds.get(normalizeKey(podcastId)) || 0;
        const catalogueId = String(row.catalogue_id ?? "").trim();
        const catalogueIdCount = catalogueId ? rowIndexes.catalogueIds.get(catalogueId) || 0 : 0;
        const attested = verification?.version === 1 && verification.status === "verified" &&
          verification.podcast_id === podcastId && verification.catalogue_id === catalogueId &&
          verification.feed_url === feedUrl && verification.official_url === String(row.Link ?? "").trim() &&
          verification.publisher === String(row.Udgiver ?? "").trim() &&
          typeof verification.channel_title === "string" && verification.channel_title === String(row.Titel ?? "").trim() &&
          typeof verification.channel_link === "string" && verification.channel_link === String(row.Link ?? "").trim() &&
          typeof verification.self_url === "string" && verification.self_url === feedUrl &&
          typeof verification.channel_owner === "string" && verification.channel_owner === String(row.Udgiver ?? "").trim() &&
          Number.isInteger(verification.unique_guid_count) && Number(verification.unique_guid_count) > 0 &&
          exactIdRows?.count === 1 && normalizedIdCount === 1 && catalogueIdCount === 1 &&
          isOrdinaryRssUrl(feedUrl) && !parsePodimoShowFeed(rawFeed);
        configs[feedKey] = {
          podcast_key: podcastKey,
          source,
          feed_url: feedUrl,
          format: "rss",
          enabled: attested,
          ...(attested ? {
            generated_from_sheet: true,
            expected_rss_channel_title: verification!.channel_title as string,
            expected_rss_channel_link: verification!.channel_link as string,
            expected_rss_self_url: verification!.self_url as string,
            expected_rss_publisher: verification!.channel_owner as string,
            expected_rss_unique_guids: true,
            auto_verified_rss: true
          } : {})
        };
        if (attested) {
          policy.resolutions.push({ podcast_key: podcastKey, sheet_feed: String(rawFeed).trim(),
            active_feed_urls: [feedUrl], origin: "auto_verified", differs_from_sheet: false,
            reason: "official_page_and_rss_identity_verified" });
        }
      }
      if (!policy.resolutions.some(entry => entry.podcast_key === podcastKey && entry.origin === "auto_verified")) {
        const verification = row.episodeFeedVerification as Record<string, unknown> | undefined;
        const reason = previous ? "feed_change_requires_code_approval" :
          verification?.version === 1 && verification.status === "review_required"
            ? `source_verification_${String(verification.reason || "identity_evidence_missing").replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 100)}`
            : "explicit_activation_required";
        policy.resolutions.push({ podcast_key: podcastKey, sheet_feed: String(rawFeed).trim(),
          active_feed_urls: previous ? [previous.feed_url] : [], origin: "review_required",
          differs_from_sheet: true, reason });
      }
      dynamicSheetFeedCount += 1;
      continue;
    }

    configs[feedKey] = {
      podcast_key: podcastKey,
      source,
      feed_url: apple ? appleShowUrl(apple.appleShowId) : feedUrl,
      format: apple ? "apple_podcasts_html" : "rss",
      ...(apple ? {
        apple_show_id: apple.appleShowId,
        enabled: APPROVED_LEGACY_APPLE_SHEET_FEEDS.get(apple.appleShowId) === podcastKey
      } : { enabled: true })
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
        origin: policy.resolutions.find(entry => entry.podcast_key === config.podcast_key &&
          (entry.origin === "sheet_override" || entry.origin === "auto_verified"))?.origin ||
          (staticKeys.has(key) ? "static" : "sheet")
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
