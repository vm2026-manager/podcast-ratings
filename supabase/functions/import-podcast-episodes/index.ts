import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsonResponse, runEpisodeImport, runEpisodeImports, safeErrorMessage, selectAppleFeedKeys, selectNormalFeedKeys, selectNormalFeedShard, validateImportRequest } from "./core.ts";
import { dryRunConfigError, runAppleDryRun, runPodimoDryRun } from "./dry-run.ts";
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
      const runtimeFeeds = await loadRuntimeFeedConfigs();
      const config = runtimeFeeds.configs[validation.feed];
      const dryRunError = dryRunConfigError(validation.feed, config);
      if (dryRunError || !config) return jsonResponse({ status: "failed", error: dryRunError || "Unknown feed config" }, 400);
      const result = config.format === "podimo_graphql" ? await runPodimoDryRun({ config }) : await runAppleDryRun(config);
      return jsonResponse(result, result.status === "partial" ? 207 : 200);
    }
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false }
    });
    const repository = createSupabaseImportRepository(client);
    const runtimeFeeds = await loadRuntimeFeedConfigs();
    console.log("[episode-import] feed configuration", JSON.stringify(runtimeFeeds.audit));
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
