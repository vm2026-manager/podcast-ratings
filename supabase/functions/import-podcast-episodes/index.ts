import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsonResponse, runEpisodeImport, runEpisodeImports, safeErrorMessage, selectAppleFeedKeys, selectNormalFeedKeys, selectNormalFeedShard, validateImportRequest } from "./core.ts";
import { dryRunConfigError, runAppleDryRun, runFriMadsArticleDryRun, runPodimoDryRun, runRssDryRun } from "./dry-run.ts";
import { createSupabaseImportRepository } from "./repository.ts";
import { loadRuntimeFeedConfigs } from "./runtime-feed-config.ts";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function feedIssueLog(summary: any) {
  const feeds = Array.isArray(summary?.feeds) ? summary.feeds : [summary];
  const issueFeeds = feeds.filter((feed: any) => feed?.status !== "success").map((feed: any) => {
    const details = feed?.details && typeof feed.details === "object" ? feed.details : {};
    const routing = details.routing && typeof details.routing === "object" ? details.routing : null;
    const routingCounts = routing ? Object.fromEntries([
      "routed_count",
      "ambiguous_count",
      "unmatched_count",
      "routing_conflict_count",
      "known_no_destination_count",
      "cross_source_url_conflict_count",
      "cross_source_url_duplicate_count",
      "cross_source_identity_duplicate_count"
    ].filter((key) => typeof routing[key] === "number").map((key) => [key, routing[key]])) : undefined;

    return {
      source: feed.source,
      podcast_key: feed.podcast_key,
      status: feed.status,
      error: feed.error || details.error_message || null,
      error_count: feed.error_count || 0,
      warning_count: details.warning_count || 0,
      invalid_item_count: details.invalid_item_count || 0,
      health_warning: details.health_warning || null,
      ...(routingCounts ? { routing: routingCounts } : {})
    };
  });

  return issueFeeds.length ? {
    status: summary.status,
    feed_count: summary.feed_count || issueFeeds.length,
    successful_feed_count: summary.successful_feed_count,
    partial_feed_count: summary.partial_feed_count,
    failed_feed_count: summary.failed_feed_count,
    feeds: issueFeeds
  } : null;
}

Deno.serve(async (request) => {
  const validation = await validateImportRequest(request, Deno.env.get("EPISODE_IMPORT_SECRET") ?? null);
  if (!validation.ok) return jsonResponse(validation.body, validation.status);

  try {
    if (validation.dryRun) {
      const runtimeFeeds = await loadRuntimeFeedConfigs();
      const config = runtimeFeeds.configs[validation.feed];
      const dryRunError = dryRunConfigError(validation.feed, config);
      if (dryRunError || !config) return jsonResponse({ status: "failed", error: dryRunError || "Unknown feed config" }, 400);
      const result = config.format === "podimo_graphql"
        ? await runPodimoDryRun({ config })
        : config.format === "fri_mads_article_json" ? await runFriMadsArticleDryRun(config)
        : config.format === "rss" ? await runRssDryRun(config, undefined, undefined, {
          ...(config.auto_verified_rss ? {
            repository: createSupabaseImportRepository(createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
              auth: { persistSession: false }
            }))
          } : {}),
          feedConfigs: runtimeFeeds.configs
        }) : await runAppleDryRun(config);
      return jsonResponse({ ...result, feed_config_audit: runtimeFeeds.audit }, result.status === "partial" ? 207 : 200);
    }
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false }
    });
    const repository = createSupabaseImportRepository(client);
    const runtimeFeeds = await loadRuntimeFeedConfigs();
    console.log("[episode-import] feed configuration", JSON.stringify(runtimeFeeds.audit));
    if (runtimeFeeds.audit.feed_warnings.length) {
      console.warn("[episode-import] Sheet feed review required", JSON.stringify(runtimeFeeds.audit.feed_warnings));
    }
    const allFeedKeys = validation.feed === "all"
      ? validation.shardIndex !== null
        ? selectNormalFeedShard(runtimeFeeds.configs, validation.shardIndex, validation.shardCount!)
        : selectNormalFeedKeys(runtimeFeeds.configs)
      : undefined;
    const summary = validation.feed === "all"
      ? await runEpisodeImports({ repository, feedConfigs: runtimeFeeds.configs, feedKeys: allFeedKeys })
      : validation.feed === "apple_all"
      ? await runEpisodeImports({
          repository,
          feedConfigs: runtimeFeeds.configs,
          feedKeys: selectAppleFeedKeys(runtimeFeeds.configs)
        })
      : await runEpisodeImport({ feedKey: validation.feed, repository, feedConfigs: runtimeFeeds.configs });
    const feedIssues = feedIssueLog(summary);
    if (feedIssues) console.warn("[episode-import] feed issues", JSON.stringify(feedIssues));
    const status = summary.status === "failed" ? 500 : summary.status === "partial" ? 207 : 200;
    return jsonResponse({
      ...summary,
      feed_config_audit: runtimeFeeds.audit,
      ...(validation.feed === "all" && validation.shardIndex !== null
        ? { shard_index: validation.shardIndex, shard_count: validation.shardCount }
        : {})
    }, status);
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    return jsonResponse({ status: "failed", error: safeErrorMessage(error) }, status);
  }
});
