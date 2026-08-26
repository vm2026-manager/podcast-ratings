import type { FeedConfig } from "./feed-config.ts";
import type { PodcastEpisodeRow } from "./core.ts";

export type ApplePodcastEpisodeLink = { episodeId: string; url: string };

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function decodeHtml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function episodeIdFromUrl(value: string): string | null {
  try {
    const id = new URL(value).searchParams.get("i") || "";
    return /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function meta(html: string, key: string, attribute = "property"): string | null {
  const expression = new RegExp(`<meta[^>]*${attribute}=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  return html.match(expression)?.[1] ? decodeHtml(html.match(expression)![1]).trim() : null;
}

function canonicalUrl(html: string): string | null {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return match?.[1] ? decodeHtml(match[1]).trim() : null;
}

function jsonLdEpisode(html: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    const payload = JSON.parse(match[1]);
    return payload && payload["@type"] === "PodcastEpisode" ? payload : null;
  } catch {
    return null;
  }
}

function findMatchedMetadata(value: unknown, episodeId: string): Record<string, unknown> | null {
  let best: { record: Record<string, unknown>; score: number } | null = null;

  const visit = (entry: unknown) => {
    if (!entry || typeof entry !== "object") return;
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    const record = entry as Record<string, unknown>;
    const storeUrl = text(record.storeUrl || record.url);
    if (episodeIdFromUrl(storeUrl) === episodeId) {
      const score =
        (text(record.releaseDate) ? 4 : 0) +
        (durationSeconds(record.duration) ? 3 : 0) +
        (record.episodeArtwork ? 2 : 0) +
        (text(record.contentId || record.adamId) === episodeId ? 1 : 0);
      if (!best || score > best.score) best = { record, score };
    }
    Object.values(record).forEach(visit);
  };

  visit(value);
  return best?.record || null;
}

function serializedMetadata(html: string, episodeId: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    return findMatchedMetadata(JSON.parse(match[1]), episodeId);
  } catch {
    return null;
  }
}

function artworkUrl(value: unknown): string | null {
  const template = text((value as Record<string, unknown> | null)?.template);
  return template ? template.replace("{w}", "1200").replace("{h}", "1200").replace("{f}", "jpg") : null;
}

function durationSeconds(value: unknown): number | null {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
}

function isTeaserOrTrailer(title: string): boolean {
  return /\b(?:teaser|trailer)\b/i.test(title);
}

export function parseApplePodcastShowLinks(html: string, showId: string): ApplePodcastEpisodeLink[] {
  if (!/^\d+$/.test(showId)) throw new Error("Invalid Apple show ID");
  const seen = new Set<string>();
  const links: ApplePodcastEpisodeLink[] = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const rawUrl = decodeHtml(match[1]);
    let url: URL;
    try {
      url = new URL(rawUrl, "https://podcasts.apple.com");
    } catch {
      continue;
    }
    const episodeId = url.searchParams.get("i") || "";
    if (url.hostname !== "podcasts.apple.com" || !url.pathname.includes(`/id${showId}`) || !/^\d+$/.test(episodeId) || seen.has(episodeId)) continue;
    seen.add(episodeId);
    links.push({ episodeId, url: url.href });
  }
  if (!links.length) throw new Error("Apple show page contains no valid episode links");
  return links;
}

export function parseApplePodcastEpisodePage(html: string, requestedEpisodeId: string) {
  if (!/^\d+$/.test(requestedEpisodeId)) throw new Error("Invalid Apple episode ID");
  const ld = jsonLdEpisode(html);
  const canonical = canonicalUrl(html);
  const canonicalId = canonical ? episodeIdFromUrl(canonical) : null;
  if (!ld || canonicalId !== requestedEpisodeId) throw new Error("Apple episode page identity could not be verified");

  const metadata = serializedMetadata(html, requestedEpisodeId);
  const title = text(ld.name) || text(meta(html, "og:title"));
  if (!title) throw new Error("Apple episode page missing title");
  const jsonLdUrl = text(ld.url);
  if (episodeIdFromUrl(jsonLdUrl) !== requestedEpisodeId) throw new Error("Apple JSON-LD identity mismatch");
  const description = text(ld.description) || null;
  const releaseDate = text(metadata?.releaseDate);
  const publishedAt = releaseDate || text(ld.datePublished) || null;
  const duration = durationSeconds(metadata?.duration);
  const episodeArtwork = artworkUrl(metadata?.episodeArtwork);
  const imageUrl = episodeArtwork || text(ld.thumbnailUrl) || meta(html, "og:image") || null;
  const ogDescription = text(meta(html, "og:description"));

  return {
    episodeId: requestedEpisodeId,
    title,
    description,
    publishedAt,
    durationSeconds: duration,
    episodeUrl: canonical,
    imageUrl,
    channelOnly: /podimo channel only/i.test(ogDescription),
    preciseReleaseDateMatched: Boolean(releaseDate),
    warning: metadata ? null : "Apple serialized metadata missing for verified episode"
  };
}

export async function mapApplePodcastHtmlEpisodes(options: {
  showHtml: string;
  config: FeedConfig;
  fetchText: (url: string) => Promise<string>;
  now: string;
}) {
  const showId = text(options.config.apple_show_id);
  const links = parseApplePodcastShowLinks(options.showHtml, showId);
  const episodes: PodcastEpisodeRow[] = [];
  const errors: Array<Record<string, unknown>> = [];
  const warnings: Array<Record<string, unknown>> = [];

  for (const link of links) {
    try {
      const parsed = parseApplePodcastEpisodePage(await options.fetchText(link.url), link.episodeId);
      if (parsed.warning) warnings.push({ episode_id: link.episodeId, warning: parsed.warning });
      const exclusionReason = isTeaserOrTrailer(parsed.title) ? "teaser_or_trailer" : null;
      episodes.push({
        podcast_key: options.config.podcast_key,
        source: options.config.source,
        external_guid: parsed.episodeId,
        external_episode_id: parsed.episodeId,
        title: parsed.title,
        description: parsed.description,
        published_at: parsed.publishedAt,
        duration_seconds: parsed.durationSeconds,
        episode_url: parsed.episodeUrl,
        audio_url: null,
        image_url: parsed.imageUrl,
        is_active: exclusionReason === null,
        metadata: {
          format: "apple_podcasts_html",
          apple_podcast_id: showId,
          apple_episode_id: parsed.episodeId,
          apple_channel_only: parsed.channelOnly,
          apple_page_url: parsed.episodeUrl,
          rateable: exclusionReason === null,
          exclusion_reason: exclusionReason
        }
      });
    } catch (error) {
      errors.push({ episode_id: link.episodeId, url: link.url, error: error instanceof Error ? error.message.slice(0, 180) : "Apple episode parse failed" });
    }
  }

  if (!episodes.length) throw new Error("Apple episode parser returned zero valid episodes");
  episodes.sort((a, b) => Date.parse(b.published_at || "1970-01-01") - Date.parse(a.published_at || "1970-01-01"));
  const activeRateableEpisodes = episodes.filter((episode) => episode.is_active).length;
  return {
    fetched_count: links.length,
    episodes,
    errors,
    warnings,
    eligibility: {
      totalParsedEntries: links.length,
      excludedEntries: links.length - activeRateableEpisodes,
      activeRateableEpisodes,
      episodeFeatureEnabled: activeRateableEpisodes >= 2
    },
    imported_at: options.now
  };
}
