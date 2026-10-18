import type { FeedConfig, FeedConfigMap } from "./feed-config.ts";
import { appleShowUrl, parseAppleFeed, parseHttpFeed } from "./feed-syntax.mjs";

export type FeedResolution = {
  podcast_key: string;
  sheet_feed: string;
  active_feed_urls: string[];
  origin: "static" | "sheet_override" | "review_required";
  differs_from_sheet: boolean;
  reason: string;
};

export function sheetFeedUrl(raw: unknown): string {
  const apple = parseAppleFeed(raw);
  return apple ? appleShowUrl(apple.appleShowId) : parseHttpFeed(raw);
}

export function isOrdinaryRssUrl(raw: unknown): boolean {
  const value = parseHttpFeed(raw);
  if (!value) return false;
  const url = new URL(value);
  // These are show pages/API adapters, not RSS, even though they are HTTP URLs.
  return !url.username && !url.password && !url.hash &&
    !/(^|\.)(podimo\.com|spotify\.com|apple\.com)$/.test(url.hostname) &&
    (!/(^|\.)dr\.dk$/.test(url.hostname) || (url.hostname === "api.dr.dk" && url.pathname.startsWith("/podcasts/v1/feeds/")));
}

function protectedConfig(config: FeedConfig): boolean {
  return (config.format !== undefined && config.format !== "rss") ||
    config.routes !== undefined || config.owned_podcast_keys !== undefined ||
    config.manual_identity_links !== undefined || config.metadata_only === true ||
    config.dedupe_by_episode_url_with_sources !== undefined || !isOrdinaryRssUrl(config.feed_url) ||
    /(^|\.)dr\.dk$/.test(new URL(config.feed_url).hostname);
}

// Review is deliberately code-owned, never taken from editable Sheet cells.
// A review must establish same show AND stable episode GUIDs before preserving
// the existing source namespace. Different shows require a separate decision.
export function applySheetFeedPolicy(
  rows: Array<Record<string, unknown>>,
  configs: FeedConfigMap,
  getId: (row: Record<string, unknown>) => string,
  normalizeId: (value: unknown) => string
): { handled: Set<Record<string, unknown>>; resolutions: FeedResolution[] } {
  const handled = new Set<Record<string, unknown>>();
  const resolutions: FeedResolution[] = [];
  const candidates = rows.filter(row => String(row.Feed ?? row.feed ?? "").trim()).map(row => ({
    row, id: getId(row), raw: String(row.Feed ?? row.feed).trim(), url: sheetFeedUrl(row.Feed ?? row.feed)
  }));
  // Snapshot ownership before any overrides: swaps and collisions cannot depend
  // on row order, nor free a URL for another canonical identity during this run.
  const owners = Object.entries(configs);
  for (const candidate of candidates) {
    const { row, id, raw, url } = candidate;
    const matches = owners.filter(([, c]) => [c.podcast_key, ...(c.owned_podcast_keys || []),
      ...(c.routes || []).flatMap(route => route.podcast_key ? [route.podcast_key] : [])]
      .some(key => normalizeId(key) === normalizeId(id)));
    const active = matches.map(([, c]) => c.feed_url);
    const report = (reason: string, origin: FeedResolution["origin"] = "review_required") => {
      handled.add(row);
      resolutions.push({ podcast_key: id, sheet_feed: raw, active_feed_urls: active,
        origin, differs_from_sheet: !active.includes(url), reason });
    };
    if (!id) { report("missing_podcast_id"); continue; }
    if (!url || (!parseAppleFeed(raw) && !isOrdinaryRssUrl(url) && !active.includes(url))) {
      report("invalid_or_non_rss_feed"); continue;
    }
    if (candidates.some(other => other !== candidate && (
      (normalizeId(other.id) === normalizeId(id) && (other.id !== id || other.url !== url)) ||
      (other.url === url && other.id !== id)
    ))) { report("conflicting_sheet_identity"); continue; }
    if (matches.length > 0 && (matches.length !== 1 || matches[0][1].podcast_key !== id)) {
      report("special_or_ambiguous_owner"); continue;
    }
    if (matches.length === 1 && active.includes(url)) { report("unchanged", "static"); continue; }
    if (owners.some(([, c]) => sheetFeedUrl(c.feed_url) === url && c.podcast_key !== id)) {
      report("feed_owned_by_other_podcast"); continue;
    }
    if (!matches.length) {
      if (owners.some(([key]) => key === normalizeId(id).replace(/\s+/g, "_"))) report("feed_key_collision");
      continue; // Existing new-feed path, including disabled Apple adapters.
    }
    const [key, config] = matches[0];
    if (protectedConfig(config) || parseAppleFeed(raw)) { report("special_adapter_preserved"); continue; }
    const review = config.reviewed_sheet_feeds?.find(entry =>
      entry.from_url === config.feed_url && entry.to_url === url &&
      entry.same_show_and_guids === true && entry.evidence.trim().length > 0);
    if (!review) { report("identity_review_required"); continue; }
    // Preserve canonical ID, source, enablement and all identity-related options.
    configs[key] = { ...config, feed_url: url };
    active.splice(0, active.length, url);
    report("reviewed_same_show_and_guids", "sheet_override");
  }
  return { handled, resolutions };
}
