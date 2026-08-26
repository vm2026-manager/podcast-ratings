import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { fetchFeedText, jsonResponse, runEpisodeImport, runEpisodeImports, safeErrorMessage, selectAppleFeedKeys, validateImportRequest } from "./core.ts";
import { mapApplePodcastHtmlEpisodes } from "./apple-podcasts.ts";
import { FEED_CONFIGS } from "./feed-config.ts";
import { createSupabaseImportRepository } from "./repository.ts";
import { loadRuntimeFeedConfigs } from "./runtime-feed-config.ts";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

Deno.serve(async (request) => {
  const validation = await validateImportRequest(request, Deno.env.get("EPISODE_IMPORT_SECRET"));
  if (!validation.ok) return jsonResponse(validation.body, validation.status);

  try {
    if (validation.dryRun) {
      const config = FEED_CONFIGS[validation.feed];
      if (!config || config.format !== "apple_podcasts_html") {
        return jsonResponse({ status: "failed", error: "Dry run is available only for Apple Podcasts HTML feeds" }, 400);
      }
      const parsed = await mapApplePodcastHtmlEpisodes({
        showHtml: await fetchFeedText(config.feed_url),
        config,
        fetchText: fetchFeedText,
        now: new Date().toISOString()
      });
      return jsonResponse({
        status: parsed.errors.length ? "partial" : "success",
        fetched_count: parsed.fetched_count,
        valid_count: parsed.episodes.length,
        error_count: parsed.errors.length,
        errors: parsed.errors.slice(0, 5),
        episodes: parsed.episodes.map((episode) => ({
          external_guid: episode.external_guid,
          title: episode.title,
          published_at: episode.published_at,
          duration_seconds: episode.duration_seconds,
          description_present: Boolean(episode.description),
          image_present: Boolean(episode.image_url),
          audio_url: episode.audio_url
        }))
      }, parsed.errors.length ? 207 : 200);
    }
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false }
    });
    const repository = createSupabaseImportRepository(client);
    const runtimeFeeds = await loadRuntimeFeedConfigs();
    console.log("[episode-import] feed configuration", JSON.stringify(runtimeFeeds.audit));
    const summary = validation.feed === "all"
      ? await runEpisodeImports({ repository, feedConfigs: runtimeFeeds.configs })
      : validation.feed === "apple_all"
      ? await runEpisodeImports({
          repository,
          feedConfigs: runtimeFeeds.configs,
          feedKeys: selectAppleFeedKeys(runtimeFeeds.configs)
        })
      : await runEpisodeImport({ feedKey: validation.feed, repository, feedConfigs: runtimeFeeds.configs });
    const status = summary.status === "failed" ? 500 : summary.status === "partial" ? 207 : 200;
    return jsonResponse({ ...summary, feed_config_audit: runtimeFeeds.audit }, status);
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    return jsonResponse({ status: "failed", error: safeErrorMessage(error) }, status);
  }
});
