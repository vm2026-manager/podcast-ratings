import { FEED_CONFIGS, type FeedConfig, type FeedConfigMap } from "./feed-config.ts";
import { mapApplePodcastHtmlEpisodes } from "./apple-podcasts.ts";

export const FEED_TIMEOUT_MS = 15000;
export const BATCH_SIZE = 200;
export const MINIMUM_RATEABLE_EPISODE_COUNT = 2;

const PERSISTENT_FIELDS = [
  "external_episode_id",
  "title",
  "description",
  "published_at",
  "duration_seconds",
  "episode_url",
  "audio_url",
  "image_url",
  "is_active",
  "metadata"
] as const;

export type PodcastEpisodeRow = {
  podcast_key: string;
  source: string;
  external_guid: string;
  external_episode_id: string | null;
  title: string;
  description: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  episode_url: string | null;
  audio_url: string | null;
  image_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
};

export type ImportSummary = {
  status: "success" | "partial" | "failed";
  source: string;
  podcast_key: string;
  fetched_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  runtime_ms: number;
  error?: string;
  details?: Record<string, unknown>;
};

export type AllFeedsImportSummary = {
  status: "success" | "partial" | "failed";
  feed_count: number;
  successful_feed_count: number;
  partial_feed_count: number;
  failed_feed_count: number;
  runtime_ms: number;
  feeds: ImportSummary[];
};

export type ImportRepository = {
  createImportRun(input: {
    source: string;
    podcast_key: string;
    status: "running";
    started_at: string;
  }): Promise<{ id: string }>;
  loadExistingEpisodes(source: string, externalGuids: string[]): Promise<PodcastEpisodeRow[]>;
  upsertEpisodes(rows: PodcastEpisodeRow[]): Promise<void>;
  updateImportRun(id: string, input: Record<string, unknown>): Promise<void>;
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function safeErrorMessage(error: unknown, fallback = "Import failed"): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 180);
  return fallback;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function validateImportRequest(request: Request, expectedSecret: string | null) {
  if (request.method !== "POST") {
    return { ok: false as const, status: 405, body: { status: "failed", error: "Method not allowed" } };
  }

  const providedSecret = bearerToken(request);
  if (!providedSecret) {
    return { ok: false as const, status: 401, body: { status: "failed", error: "Missing authorization" } };
  }
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return { ok: false as const, status: 403, body: { status: "failed", error: "Forbidden" } };
  }

  try {
    const body = await request.json();
    if (!body || typeof body.feed !== "string") {
      return { ok: false as const, status: 400, body: { status: "failed", error: "Missing feed" } };
    }
    const feed = body.feed.trim();
    if (!feed) {
      return { ok: false as const, status: 400, body: { status: "failed", error: "Missing feed" } };
    }
    return { ok: true as const, feed, dryRun: body.dry_run === true };
  } catch (_error) {
    return { ok: false as const, status: 400, body: { status: "failed", error: "Invalid JSON body" } };
  }
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function isTeaserOrTrailerTitle(value: unknown): boolean {
  return /\b(?:teaser|trailer)\b/i.test(normalizeText(value));
}

export function getEpisodeExclusionReason(episode: Record<string, unknown>): string | null {
  const metadata =
    episode.metadata && typeof episode.metadata === "object"
      ? (episode.metadata as Record<string, unknown>)
      : {};
  if (episode.is_active === false) return normalizeText(metadata.exclusion_reason) || "inactive";
  if (episode.rateable === false || metadata.rateable === false) {
    return normalizeText(metadata.exclusion_reason) || "not_rateable";
  }
  if (!normalizeText(episode.title)) return "missing_title";
  if (isTeaserOrTrailerTitle(episode.title)) return "teaser_or_trailer";
  return null;
}

export function isRateableEpisode(episode: Record<string, unknown>): boolean {
  return getEpisodeExclusionReason(episode) === null;
}

export function getEpisodeFeatureEligibility(
  episodes: Array<Record<string, unknown>>,
  totalParsedEntries = episodes.length
) {
  const activeRateableEpisodes = episodes.filter(isRateableEpisode).length;
  const preservedExcludedEntries = episodes.length - activeRateableEpisodes;
  const excludedEntries = Math.max(
    preservedExcludedEntries,
    Math.max(0, totalParsedEntries - activeRateableEpisodes)
  );
  return {
    totalParsedEntries,
    excludedEntries,
    activeRateableEpisodes,
    episodeFeatureEnabled: activeRateableEpisodes >= MINIMUM_RATEABLE_EPISODE_COUNT
  };
}

export function parseManualEpisodeTitles(value: unknown): string[] {
  return normalizeText(value)
    .split(";")
    .map((title) => title.trim())
    .filter(Boolean);
}

function decodeXmlEntities(value: string): string {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function stripHtml(value: string): string {
  return decodeXmlEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(block: string, tagName: string): string | null {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tagName}>`, "i");
  const match = block.match(pattern);
  return match ? decodeXmlEntities(match[1]).trim() : null;
}

function xmlTagRaw(block: string, tagName: string): string | null {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tagName}>`, "i");
  return block.match(pattern)?.[1]?.trim() || null;
}

function xmlTagBlock(block: string, tagName: string): string | null {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${tagName}\\b[^>]*>[\\s\\S]*?<\\/(?:[\\w.-]+:)?${tagName}>`, "i");
  return block.match(pattern)?.[0] || null;
}

function firstTagWithAttribute(block: string, tagName: string): string | null {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${tagName}\\b[^>]*(?:\\/?>)`, "i");
  return block.match(pattern)?.[0] || null;
}

function xmlAttr(tag: string | null, attrName: string): string | null {
  if (!tag) return null;
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
  return tag.match(pattern)?.[1] ? decodeXmlEntities(tag.match(pattern)![1]).trim() : null;
}

export function parseDuration(value: string | null): { value: number | null; warning: string | null } {
  const raw = normalizeText(value);
  if (!raw) return { value: null, warning: null };
  if (/^\d+$/.test(raw)) return { value: Number(raw), warning: null };
  const parts = raw.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return { value: parts[0] * 60 + parts[1], warning: null };
  }
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return { value: parts[0] * 3600 + parts[1] * 60 + parts[2], warning: null };
  }
  return { value: null, warning: "Invalid duration" };
}

export function parsePublishedAt(value: string | null): { value: string | null; warning: string | null } {
  const raw = normalizeText(value);
  if (!raw) return { value: null, warning: null };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { value: null, warning: "Invalid pubDate" };
  return { value: date.toISOString(), warning: null };
}

export function parseFeed(xml: string) {
  const channelBlock = xmlTagBlock(xml, "channel");
  if (!channelBlock) throw new Error("Invalid XML: missing channel");
  const channelImageBlock = xmlTagBlock(channelBlock, "image");
  const channelHeader = channelBlock.replace(/<item\b[\s\S]*$/i, "");
  const items = [...channelBlock.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  if (!items.length) throw new Error("Feed contains no items");

  return {
    channel: {
      title: xmlTag(channelHeader, "title"),
      link: xmlTag(channelHeader, "link"),
      image_url: channelImageBlock ? xmlTag(channelImageBlock, "url") : null
    },
    items: items.map((itemBlock) => {
      const enclosureTag = firstTagWithAttribute(itemBlock, "enclosure");
      const imageTag = firstTagWithAttribute(itemBlock, "image");
      const descriptionRaw = xmlTagRaw(itemBlock, "description");
      return {
        guid: xmlTag(itemBlock, "guid"),
        title: xmlTag(itemBlock, "title"),
        description: descriptionRaw ? stripHtml(descriptionRaw) : null,
        pubDate: xmlTag(itemBlock, "pubDate"),
        duration: xmlTag(itemBlock, "duration"),
        link: xmlTag(itemBlock, "link"),
        enclosure_url: xmlAttr(enclosureTag, "url"),
        enclosure_type: xmlAttr(enclosureTag, "type"),
        image_url: xmlAttr(imageTag, "href")
      };
    })
  };
}

export type Radio4Episode = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  published?: unknown;
  duration?: unknown;
  audioUrl?: unknown;
  episodeUrl?: unknown;
  imageUrl?: unknown;
};

export function parseRadio4Episodes(json: string): unknown[] {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch (_error) {
    throw new Error("Invalid Radio4 JSON");
  }
  if (!Array.isArray(payload)) throw new Error("Invalid Radio4 JSON: expected episode array");
  return payload;
}

function externalEpisodeIdFromGuid(guid: string): string | null {
  return /^\d+$/.test(guid) ? guid : null;
}

export function mapEpisodes(feed: ReturnType<typeof parseFeed>, config: FeedConfig, now: string) {
  const seen = new Set<string>();
  const episodes: PodcastEpisodeRow[] = [];
  const errors: Array<Record<string, unknown>> = [];
  const warnings: Array<Record<string, unknown>> = [];

  feed.items.forEach((item, index) => {
    const guid = normalizeText(item.guid);
    const title = normalizeText(item.title);
    const duration = parseDuration(item.duration);
    const published = parsePublishedAt(item.pubDate);
    if (duration.warning) warnings.push({ index, guid, warning: duration.warning });
    if (published.warning) warnings.push({ index, guid, warning: published.warning });

    const validationErrors = [];
    if (!guid) validationErrors.push("Missing external_guid");
    if (!title) validationErrors.push("Missing title");
    if (guid && seen.has(guid)) validationErrors.push("Duplicate GUID in feed");
    if (validationErrors.length) {
      errors.push({ index, guid: guid || null, title: title || null, errors: validationErrors });
      return;
    }

    seen.add(guid);
    const exclusionReason = isTeaserOrTrailerTitle(title) ? "teaser_or_trailer" : null;
    episodes.push({
      podcast_key: config.podcast_key,
      source: config.source,
      external_guid: guid,
      external_episode_id: externalEpisodeIdFromGuid(guid),
      title,
      description: item.description || null,
      published_at: published.value,
      duration_seconds: duration.value,
      episode_url: normalizeText(item.link) || null,
      audio_url: normalizeText(item.enclosure_url) || null,
      image_url: normalizeText(item.image_url) || feed.channel.image_url || null,
      is_active: exclusionReason === null,
      metadata: {
        channel_title: feed.channel.title || null,
        feed_url: config.feed_url,
        enclosure_type: item.enclosure_type || null,
        original_pub_date: item.pubDate || null,
        rateable: exclusionReason === null,
        exclusion_reason: exclusionReason
      }
    });
  });

  episodes.sort((a, b) => Date.parse(b.published_at || "1970-01-01") - Date.parse(a.published_at || "1970-01-01"));
  return {
    fetched_count: feed.items.length,
    episodes,
    errors,
    warnings,
    eligibility: getEpisodeFeatureEligibility(episodes, feed.items.length),
    imported_at: now
  };
}

function parseRadio4Duration(value: unknown): { value: number | null; warning: string | null } {
  if (value === null || value === undefined || value === "") return { value: null, warning: null };
  const duration = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(duration) || duration < 0) return { value: null, warning: "Invalid duration" };
  return { value: Math.round(duration), warning: null };
}

export function mapRadio4Episodes(episodesInput: unknown[], config: FeedConfig, now: string) {
  const seen = new Set<string>();
  const episodes: PodcastEpisodeRow[] = [];
  const errors: Array<Record<string, unknown>> = [];
  const warnings: Array<Record<string, unknown>> = [];

  episodesInput.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push({ index, guid: null, title: null, errors: ["Invalid Radio4 episode item"] });
      return;
    }
    const radio4Episode = item as Radio4Episode;
    const guid = normalizeText(radio4Episode.id);
    const title = normalizeText(radio4Episode.title);
    const duration = parseRadio4Duration(radio4Episode.duration);
    const publishedRaw = normalizeText(radio4Episode.published) || null;
    const published = parsePublishedAt(publishedRaw);
    if (duration.warning) warnings.push({ index, guid: guid || null, warning: duration.warning });
    if (published.warning) warnings.push({ index, guid: guid || null, warning: published.warning });

    const validationErrors = [];
    if (!guid) validationErrors.push("Missing external_guid");
    if (!title) validationErrors.push("Missing title");
    if (guid && seen.has(guid)) validationErrors.push("Duplicate GUID in feed");
    if (validationErrors.length) {
      errors.push({ index, guid: guid || null, title: title || null, errors: validationErrors });
      return;
    }

    seen.add(guid);
    const exclusionReason = isTeaserOrTrailerTitle(title) ? "teaser_or_trailer" : null;
    episodes.push({
      podcast_key: config.podcast_key,
      source: config.source,
      external_guid: guid,
      external_episode_id: guid,
      title,
      description: stripHtml(normalizeText(radio4Episode.description)) || null,
      published_at: published.value,
      duration_seconds: duration.value,
      episode_url: normalizeText(radio4Episode.episodeUrl) || null,
      audio_url: normalizeText(radio4Episode.audioUrl) || null,
      image_url: normalizeText(radio4Episode.imageUrl) || null,
      is_active: exclusionReason === null,
      metadata: {
        feed_url: config.feed_url,
        format: "radio4_json",
        original_published: publishedRaw,
        rateable: exclusionReason === null,
        exclusion_reason: exclusionReason
      }
    });
  });

  episodes.sort((a, b) => Date.parse(b.published_at || "1970-01-01") - Date.parse(a.published_at || "1970-01-01"));
  return {
    fetched_count: episodesInput.length,
    episodes,
    errors,
    warnings,
    eligibility: getEpisodeFeatureEligibility(episodes, episodesInput.length),
    imported_at: now
  };
}

export type DrLydEpisode = {
  id?: unknown;
  learnId?: unknown;
  productionNumber?: unknown;
  title?: unknown;
  description?: unknown;
  startTime?: unknown;
  durationMilliseconds?: unknown;
  presentationUrl?: unknown;
  slug?: unknown;
};

export function parseDrLydEpisodes(html: string): unknown[] {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (!match?.[1]) {
    throw new Error("Invalid DR Lyd page: missing __NEXT_DATA__");
  }

  let payload: any;

  try {
    payload = JSON.parse(match[1]);
  } catch (_error) {
    throw new Error("Invalid DR Lyd __NEXT_DATA__ JSON");
  }

  const groups = payload?.props?.pageProps?.episodesGroups;

  if (!Array.isArray(groups)) {
    throw new Error("Invalid DR Lyd page: missing episode groups");
  }

  return groups.flatMap((group: any) =>
    Array.isArray(group?.items) ? group.items : []
  );
}

function drLydExternalGuid(productionNumber: string): string | null {
  if (!/^\d+$/.test(productionNumber)) return null;

  const value = Number(productionNumber);

  if (!Number.isSafeInteger(value)) return null;

  return String(value + 10000);
}

export function mapDrLydEpisodes(
  episodesInput: unknown[],
  config: FeedConfig,
  now: string
) {
  const seen = new Set<string>();
  const episodes: PodcastEpisodeRow[] = [];
  const errors: Array<Record<string, unknown>> = [];
  const warnings: Array<Record<string, unknown>> = [];

  episodesInput.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push({ index, errors: ["Invalid DR Lyd episode item"] });
      return;
    }

    const episode = item as DrLydEpisode;
    const productionNumber = normalizeText(episode.productionNumber);
    const guid = drLydExternalGuid(productionNumber);
    const title = normalizeText(episode.title);
    const publishedRaw = normalizeText(episode.startTime) || null;
    const published = parsePublishedAt(publishedRaw);

    const durationMs = Number(episode.durationMilliseconds);
    const durationSeconds =
      Number.isFinite(durationMs) && durationMs >= 0
        ? Math.round(durationMs / 1000)
        : null;

    const validationErrors: string[] = [];

    if (!productionNumber) validationErrors.push("Missing productionNumber");
    if (!guid) validationErrors.push("Invalid productionNumber");
    if (!title) validationErrors.push("Missing title");
    if (guid && seen.has(guid)) validationErrors.push("Duplicate GUID");

    if (validationErrors.length) {
      errors.push({
        index,
        guid,
        title: title || null,
        errors: validationErrors
      });
      return;
    }

    seen.add(guid!);

    const exclusionReason =
      isTeaserOrTrailerTitle(title) ? "teaser_or_trailer" : null;

    episodes.push({
      podcast_key: config.podcast_key,
      source: config.source,
      external_guid: guid!,
      external_episode_id: guid!,
      title,
      description: stripHtml(normalizeText(episode.description)) || null,
      published_at: published.value,
      duration_seconds: durationSeconds,
      episode_url: normalizeText(episode.presentationUrl) || null,
      audio_url: null,
      image_url: null,
      is_active: exclusionReason === null,
      metadata: {
        feed_url: config.feed_url,
        format: "dr_lyd_next_data",
        dr_lyd_episode_id: normalizeText(episode.id) || null,
        dr_lyd_learn_id: normalizeText(episode.learnId) || null,
        dr_lyd_production_number: productionNumber,
        dr_lyd_slug: normalizeText(episode.slug) || null,
        original_start_time: publishedRaw,
        rateable: exclusionReason === null,
        exclusion_reason: exclusionReason
      }
    });
  });

  episodes.sort(
    (a, b) =>
      Date.parse(b.published_at || "1970-01-01") -
      Date.parse(a.published_at || "1970-01-01")
  );

  return {
    fetched_count: episodesInput.length,
    episodes,
    errors,
    warnings,
    eligibility: getEpisodeFeatureEligibility(
      episodes,
      episodesInput.length
    ),
    imported_at: now
  };
}
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value ?? null;
}

function stableFieldValue(field: (typeof PERSISTENT_FIELDS)[number], value: unknown): unknown {
  if (field === "published_at" && value) {
    const timestamp = Date.parse(String(value));
    return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
  }
  return stableValue(value);
}

function persistentComparable(row: PodcastEpisodeRow): string {
  return JSON.stringify(
    Object.fromEntries(PERSISTENT_FIELDS.map((field) => [field, stableFieldValue(field, row[field])]))
  );
}

export function classifyEpisodes(mapped: PodcastEpisodeRow[], existing: PodcastEpisodeRow[]) {
  const existingByGuid = new Map(existing.map((row) => [row.external_guid, row]));
  const inserted: PodcastEpisodeRow[] = [];
  const updated: PodcastEpisodeRow[] = [];
  let skipped_count = 0;

  mapped.forEach((episode) => {
    const current = existingByGuid.get(episode.external_guid);
    if (!current) {
      inserted.push(episode);
      return;
    }
    if (persistentComparable(current) !== persistentComparable(episode)) {
      updated.push(episode);
      return;
    }
    skipped_count += 1;
  });

  return { inserted, updated, skipped_count };
}

export function chunk<T>(items: T[], size = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function fetchFeedText(url: string, timeoutMs = FEED_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Feed fetch failed: ${response.status}`);
    return await response.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Feed fetch timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function runEpisodeImport(options: {
  feedKey: string;
  repository: ImportRepository;
  feedConfigs?: FeedConfigMap;
  fetchText?: (url: string) => Promise<string>;
  now?: () => string;
}) {
  const startedAt = Date.now();
  const now = options.now || (() => new Date().toISOString());
  const feedConfigs = options.feedConfigs || FEED_CONFIGS;
  const config = feedConfigs[options.feedKey];
  if (!config) throw Object.assign(new Error("Unknown feed config"), { status: 400 });

  const importRun = await options.repository.createImportRun({
    source: config.source,
    podcast_key: config.podcast_key,
    status: "running",
    started_at: now()
  });

  try {
    const content = await (options.fetchText || fetchFeedText)(config.feed_url);
    const mapped = config.format === "apple_podcasts_html"
      ? await mapApplePodcastHtmlEpisodes({
          showHtml: content,
          config,
          fetchText: options.fetchText || fetchFeedText,
          now: now()
        })
      : config.format === "radio4_json"
      ? mapRadio4Episodes(parseRadio4Episodes(content), config, now())
      : config.format === "dr_lyd_next_data"
        ? mapDrLydEpisodes(parseDrLydEpisodes(content), config, now())
        : mapEpisodes(parseFeed(content), config, now());
    const existing = await options.repository.loadExistingEpisodes(
      config.source,
      mapped.episodes.map((episode) => episode.external_guid)
    );
    const episodesForClassification =
      config.format === "dr_lyd_next_data"
        ? mapped.episodes.map((episode) => {
            const current = existing.find(
              (row) => row.external_guid === episode.external_guid
            );

            if (!current) return episode;

            return {
              ...episode,
              audio_url: episode.audio_url || current.audio_url,
              image_url: episode.image_url || current.image_url,
              metadata: {
                ...(current.metadata || {}),
                ...(episode.metadata || {})
              }
            };
          })
        : mapped.episodes;

    const classified = classifyEpisodes(episodesForClassification, existing);
    const writeRows = classified.inserted.concat(classified.updated);
    const batches = chunk(writeRows);
    let batchErrors = 0;

    for (const batch of batches) {
      try {
        await options.repository.upsertEpisodes(batch);
      } catch (_error) {
        batchErrors += batch.length;
      }
    }

    const itemErrors = mapped.errors.length;
    const error_count = itemErrors + batchErrors;
    const hasWarnings = mapped.warnings.length > 0;
    const status = error_count > 0 ? (writeRows.length > batchErrors ? "partial" : "failed") : hasWarnings ? "partial" : "success";
    const summary: ImportSummary = {
      status,
      source: config.source,
      podcast_key: config.podcast_key,
      fetched_count: mapped.fetched_count,
      inserted_count: classified.inserted.length - Math.min(batchErrors, classified.inserted.length),
      updated_count: classified.updated.length - Math.max(0, batchErrors - classified.inserted.length),
      skipped_count: classified.skipped_count,
      error_count,
      runtime_ms: Date.now() - startedAt,
      details: {
        feed: options.feedKey,
        feed_url: config.feed_url,
        feed_format: config.format || "rss",
        batch_count: batches.length,
        warning_count: mapped.warnings.length,
        invalid_item_count: itemErrors,
        excluded_entry_count: mapped.eligibility.excludedEntries,
        active_rateable_episode_count: mapped.eligibility.activeRateableEpisodes,
        episode_feature_enabled: mapped.eligibility.episodeFeatureEnabled,
        errors: mapped.errors.slice(0, 5),
        warnings: mapped.warnings.slice(0, 5)
      }
    };

    try {
      await options.repository.updateImportRun(importRun.id, {
      finished_at: now(),
      status,
      fetched_count: summary.fetched_count,
      inserted_count: summary.inserted_count,
      updated_count: summary.updated_count,
      skipped_count: summary.skipped_count,
      error_count: summary.error_count,
      error_message: error_count ? "Import completed with errors" : null,
      details: summary.details
      });
    } catch (_error) {
      return {
        ...summary,
        status: "failed" as const,
        error_count: summary.error_count + 1,
        error: "Import log update failed"
      };
    }

    return summary;
  } catch (error) {
    const message = safeErrorMessage(error);
    const failed: ImportSummary = {
      status: "failed",
      source: config.source,
      podcast_key: config.podcast_key,
      fetched_count: 0,
      inserted_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_count: 1,
      runtime_ms: Date.now() - startedAt,
      error: message
    };
    try {
      await options.repository.updateImportRun(importRun.id, {
        finished_at: now(),
        status: "failed",
        fetched_count: 0,
        inserted_count: 0,
        updated_count: 0,
        skipped_count: 0,
        error_count: 1,
        error_message: message,
        details: { feed: options.feedKey }
      });
    } catch (_error) {
      failed.error = "Import failed and import log update failed";
    }
    return failed;
  }
}

function failedImportSummary(feedKey: string, error: unknown, feedConfigs: FeedConfigMap): ImportSummary {
  const config = feedConfigs[feedKey];
  return {
    status: "failed",
    source: config?.source || feedKey,
    podcast_key: config?.podcast_key || feedKey,
    fetched_count: 0,
    inserted_count: 0,
    updated_count: 0,
    skipped_count: 0,
    error_count: 1,
    runtime_ms: 0,
    error: safeErrorMessage(error)
  };
}

// Imports in small batches to keep the all-feeds cron invocation bounded while
// avoiding an unthrottled burst of RSS and database requests.
export async function runEpisodeImports(options: {
  feedKeys?: string[];
  repository: ImportRepository;
  feedConfigs?: FeedConfigMap;
  fetchText?: (url: string) => Promise<string>;
  now?: () => string;
  concurrency?: number;
}): Promise<AllFeedsImportSummary> {
  const startedAt = Date.now();
  const feedConfigs = options.feedConfigs || FEED_CONFIGS;
  const requestedFeedKeys = options.feedKeys || Object.entries(feedConfigs)
    .filter(([, config]) => config.enabled !== false)
    .map(([feedKey]) => feedKey);
  const feedKeys = [...new Set(requestedFeedKeys)].filter((feedKey) => Boolean(feedConfigs[feedKey]));
  const concurrency = Math.max(1, Math.min(Math.floor(options.concurrency || 3), feedKeys.length || 1));
  const feeds: ImportSummary[] = [];

  for (let index = 0; index < feedKeys.length; index += concurrency) {
    const batch = feedKeys.slice(index, index + concurrency);
    const summaries = await Promise.all(
      batch.map(async (feedKey) => {
        try {
          return await runEpisodeImport({
            feedKey,
            repository: options.repository,
            feedConfigs,
            fetchText: options.fetchText,
            now: options.now
          });
        } catch (error) {
          return failedImportSummary(feedKey, error, feedConfigs);
        }
      })
    );
    feeds.push(...summaries);
  }

  const successful_feed_count = feeds.filter((summary) => summary.status === "success").length;
  const partial_feed_count = feeds.filter((summary) => summary.status === "partial").length;
  const failed_feed_count = feeds.filter((summary) => summary.status === "failed").length;
  const status =
    failed_feed_count === feeds.length ? "failed" :
    failed_feed_count > 0 || partial_feed_count > 0 ? "partial" :
    "success";

  return {
    status,
    feed_count: feeds.length,
    successful_feed_count,
    partial_feed_count,
    failed_feed_count,
    runtime_ms: Date.now() - startedAt,
    feeds
  };
}
