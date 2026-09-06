import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runEpisodeImports, selectAppleFeedKeys, selectNormalFeedKeys, selectNormalFeedShard, validateImportRequest, type ImportRepository, type PodcastEpisodeRow } from "./core.ts";
import type { FeedConfigMap } from "./feed-config.ts";

const RSS = "<rss><channel><title>Test</title><item><guid>episode-1</guid><title>Episode</title></item></channel></rss>";

Deno.test("normal all-feed shards are sorted, complete, disjoint, and exclude Apple HTML feeds", () => {
  const feedConfigs: FeedConfigMap = {
    epsilon: { podcast_key: "epsilon", source: "epsilon_rss", feed_url: "https://example.test/epsilon" },
    zeta: { podcast_key: "zeta", source: "zeta_rss", feed_url: "https://example.test/zeta" },
    alpha: { podcast_key: "alpha", source: "alpha_rss", feed_url: "https://example.test/alpha" },
    apple_disabled: { podcast_key: "apple disabled", source: "apple_disabled", feed_url: "https://example.test/apple-disabled", format: "apple_podcasts_html", enabled: false },
    valley_heat: { podcast_key: "valley heat", source: "sheet_valley_heat_rss", feed_url: "https://feeds.simplecast.com/kKMR_wuB" },
    genstart: { podcast_key: "genstart", source: "dr_genstart", feed_url: "https://example.test/genstart", format: "dr_lyd_next_data" },
    beta: { podcast_key: "beta", source: "beta_rss", feed_url: "https://example.test/beta" },
    delta: { podcast_key: "delta", source: "delta_rss", feed_url: "https://example.test/delta" },
    eta: { podcast_key: "eta", source: "eta_rss", feed_url: "https://example.test/eta" },
    apple_accidentally_enabled: { podcast_key: "apple enabled", source: "apple_enabled", feed_url: "https://example.test/apple-enabled", format: "apple_podcasts_html" }
  };
  const normalKeys = selectNormalFeedKeys(feedConfigs);
  const shards = [0, 1, 2, 3, 4, 5].map((shardIndex) => selectNormalFeedShard(feedConfigs, shardIndex, 6));
  const assigned = shards.flat();

  assertEquals(normalKeys, ["alpha", "beta", "delta", "epsilon", "eta", "genstart", "valley_heat", "zeta"]);
  assertEquals(shards, [["alpha", "valley_heat"], ["beta", "zeta"], ["delta"], ["epsilon"], ["eta"], ["genstart"]]);
  assertEquals([...assigned].sort(), normalKeys);
  assertEquals(new Set(assigned).size, normalKeys.length);
  assertEquals(assigned.includes("valley_heat"), true);
  assertEquals(selectAppleFeedKeys(feedConfigs), ["apple_disabled", "apple_accidentally_enabled"]);
});

Deno.test("single-feed requests remain compatible and shards are limited to feed=all", async () => {
  const headers = { authorization: "Bearer test-secret", "content-type": "application/json" };
  const single = await validateImportRequest(new Request("https://example.test", {
    method: "POST", headers, body: JSON.stringify({ feed: "genstart" })
  }), "test-secret");
  const shard = await validateImportRequest(new Request("https://example.test", {
    method: "POST", headers, body: JSON.stringify({ feed: "all", shard_index: 2, shard_count: 6 })
  }), "test-secret");
  const invalid = await validateImportRequest(new Request("https://example.test", {
    method: "POST", headers, body: JSON.stringify({ feed: "genstart", shard_index: 0, shard_count: 6 })
  }), "test-secret");

  assertEquals(single.ok, true);
  if (single.ok) assertEquals({ feed: single.feed, shardIndex: single.shardIndex, shardCount: single.shardCount }, { feed: "genstart", shardIndex: null, shardCount: null });
  assertEquals(shard.ok, true);
  if (shard.ok) assertEquals({ feed: shard.feed, shardIndex: shard.shardIndex, shardCount: shard.shardCount }, { feed: "all", shardIndex: 2, shardCount: 6 });
  assertEquals(invalid.ok, false);
});

Deno.test("all-feed imports stay bounded, continue after failures, and finalize every created run", async () => {
  const created: string[] = [];
  const finalized = new Map<string, Record<string, unknown>>();
  let activeFetches = 0;
  let maximumActiveFetches = 0;
  const repository: ImportRepository = {
    createImportRun: async () => {
      const id = `run-${created.length + 1}`;
      created.push(id);
      return { id };
    },
    loadExistingEpisodes: async (): Promise<PodcastEpisodeRow[]> => [],
    upsertEpisodes: async () => undefined,
    updateImportRun: async (id, input) => { finalized.set(id, input); }
  };
  const feedConfigs: FeedConfigMap = {
    first: { podcast_key: "first", source: "first_rss", feed_url: "https://example.test/first" },
    broken: { podcast_key: "broken", source: "broken_rss", feed_url: "https://example.test/broken" },
    last: { podcast_key: "last", source: "last_rss", feed_url: "https://example.test/last" }
  };

  const result = await runEpisodeImports({
    repository,
    feedConfigs,
    concurrency: 2,
    now: () => "2026-09-06T00:00:00.000Z",
    fetchText: async (url) => {
      activeFetches += 1;
      maximumActiveFetches = Math.max(maximumActiveFetches, activeFetches);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeFetches -= 1;
      if (url.endsWith("/broken")) throw new Error("unavailable feed");
      return RSS;
    }
  });

  assertEquals(result.feed_count, 3);
  assertEquals(result.successful_feed_count, 2);
  assertEquals(result.failed_feed_count, 1);
  assertEquals(result.status, "partial");
  assertEquals(maximumActiveFetches <= 2, true);
  assertEquals(created.length, 3);
  assertEquals([...finalized.values()].map((run) => run.status).sort(), ["failed", "success", "success"]);
  assertEquals([...finalized.values()].every((run) => Boolean(run.finished_at)), true);
});
