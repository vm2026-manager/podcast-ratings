import { mapApplePodcastHtmlEpisodes } from "./apple-podcasts.ts";
import { fetchFeedText, fetchPodimoEpisodes, mapPodimoEpisodes, parsePodimoEpisodes, routeEpisodes } from "./core.ts";
import type { FeedConfig } from "./feed-config.ts";

const SAMPLE_SIZE = 5;

export function dryRunConfigError(feedKey: string, config: FeedConfig | undefined): string | null {
  if (feedKey === "all" || feedKey === "apple_all") return "Dry run requires a single feed";
  if (!config || (config.format !== "apple_podcasts_html" && config.format !== "podimo_graphql")) {
    return "Dry run is available only for Apple Podcasts HTML and Podimo feeds";
  }
  return null;
}

function sampleEpisodes(episodes: Awaited<ReturnType<typeof mapPodimoEpisodes>>["episodes"]) {
  return episodes.slice(0, SAMPLE_SIZE).map((episode) => ({
    external_guid: episode.external_guid,
    title: episode.title,
    published_at: episode.published_at,
    duration_seconds: episode.duration_seconds,
    description_present: Boolean(episode.description),
    image_present: Boolean(episode.image_url),
    audio_url: episode.audio_url
  }));
}

function dateRange(episodes: Awaited<ReturnType<typeof mapPodimoEpisodes>>["episodes"]) {
  const dates = episodes.map((episode) => episode.published_at).filter((date): date is string => Boolean(date)).sort();
  return { earliest_published_at: dates[0] || null, latest_published_at: dates.at(-1) || null };
}

export async function runPodimoDryRun(options: {
  config: FeedConfig;
  now?: string;
  fetchPodimo?: (config: FeedConfig) => Promise<unknown>;
}) {
  const payload = await (options.fetchPodimo || fetchPodimoEpisodes)(options.config);
  const mapped = mapPodimoEpisodes(parsePodimoEpisodes(payload), options.config, options.now || new Date().toISOString());
  const routing = routeEpisodes(mapped.episodes, options.config);
  const pageCount = payload && typeof payload === "object"
    ? Number((payload as { data?: { page_count?: unknown } }).data?.page_count) || null
    : null;
  const routingReport = routing.report && {
    routed_count: routing.report.routed_count,
    route_counts: routing.report.route_counts,
    unmatched_count: routing.report.unmatched.length,
    unmatched: routing.report.unmatched.slice(0, SAMPLE_SIZE),
    ambiguous_count: routing.report.ambiguous.length,
    ambiguous: routing.report.ambiguous.slice(0, SAMPLE_SIZE),
    known_no_destination_count: routing.report.known_no_destination.length,
    known_no_destination: routing.report.known_no_destination.slice(0, SAMPLE_SIZE)
  };
  const duplicateGuidCount = mapped.errors.filter((error) => (error.errors as string[] | undefined)?.includes("Duplicate GUID in feed")).length;
  const routingIssues = routing.report
    ? routing.report.unmatched.length + routing.report.ambiguous.length + routing.report.known_no_destination.length
    : 0;
  const errorCount = mapped.errors.length + routingIssues;

  return {
    status: errorCount ? "partial" : "success",
    source: options.config.source,
    podcast_key: options.config.podcast_key,
    format: "podimo_graphql",
    fetched_count: mapped.fetched_count,
    valid_count: routing.episodes.length,
    error_count: errorCount,
    errors: mapped.errors.slice(0, SAMPLE_SIZE),
    page_count: pageCount,
    teaser_trailer_excluded_count: mapped.episodes.filter((episode) => episode.is_active === false).length,
    duplicate_guid_count: duplicateGuidCount,
    audio_url_values_are_null: routing.episodes.every((episode) => episode.audio_url === null),
    routing: routingReport,
    episodes: sampleEpisodes(routing.episodes),
    ...dateRange(routing.episodes)
  };
}

export async function runAppleDryRun(config: FeedConfig, fetchText: (url: string) => Promise<string> = fetchFeedText) {
  const parsed = await mapApplePodcastHtmlEpisodes({
    showHtml: await fetchText(config.feed_url), config, fetchText, now: new Date().toISOString()
  });
  return {
    status: parsed.errors.length ? "partial" : "success",
    fetched_count: parsed.fetched_count,
    valid_count: parsed.episodes.length,
    error_count: parsed.errors.length,
    errors: parsed.errors.slice(0, 5),
    episodes: parsed.episodes.map((episode) => ({
      external_guid: episode.external_guid, title: episode.title, published_at: episode.published_at,
      duration_seconds: episode.duration_seconds, description_present: Boolean(episode.description),
      image_present: Boolean(episode.image_url), audio_url: episode.audio_url
    }))
  };
}
