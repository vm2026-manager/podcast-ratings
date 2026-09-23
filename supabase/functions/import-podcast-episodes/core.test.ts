import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runEpisodeImport, runEpisodeImports, selectAppleFeedKeys, selectNormalFeedKeys, selectNormalFeedShard, validateImportRequest, type ImportRepository, type PodcastEpisodeRow } from "./core.ts";
import { FEED_CONFIGS, type FeedConfigMap } from "./feed-config.ts";

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

Deno.test("a staged disabled feed stays out of all-feed selection while direct import remains available", async () => {
  const feedConfigs: FeedConfigMap = {
    ordinary: { podcast_key: "ordinary", source: "ordinary_rss", feed_url: "https://example.test/ordinary" },
    mediano_public: { podcast_key: "mediano superliga", source: "mediano_public_rss", feed_url: "https://example.test/mediano", enabled: false }
  };
  const created: string[] = [];
  const repository: ImportRepository = {
    createImportRun: async () => ({ id: `run-${created.push("run")}` }),
    loadExistingEpisodes: async (): Promise<PodcastEpisodeRow[]> => [],
    upsertEpisodes: async () => undefined,
    updateImportRun: async () => undefined
  };

  assertEquals(selectNormalFeedKeys(feedConfigs), ["ordinary"]);
  assertEquals(selectNormalFeedShard(feedConfigs, 0, 1), ["ordinary"]);

  const result = await runEpisodeImport({
    feedKey: "mediano_public",
    feedConfigs,
    repository,
    fetchText: async () => RSS,
    now: () => "2026-09-18T00:00:00.000Z"
  });
  assertEquals(result.source, "mediano_public_rss");
  assertEquals(created.length, 1);
});

Deno.test("enabled Mediano public appears exactly once in normal all-feed shards", () => {
  const normalKeys = selectNormalFeedKeys(FEED_CONFIGS);
  const stagedConfigs: FeedConfigMap = {
    ...FEED_CONFIGS,
    mediano_public: { ...FEED_CONFIGS.mediano_public, enabled: false }
  };
  const beforeActivation = selectNormalFeedKeys(stagedConfigs);
  const shards = [0, 1, 2, 3, 4, 5].map((shardIndex) => selectNormalFeedShard(FEED_CONFIGS, shardIndex, 6));

  assertEquals(normalKeys.includes("mediano_public"), true);
  assertEquals(normalKeys.includes("mediano_site"), true);
  assertEquals(shards.flat().filter((feedKey) => feedKey === "mediano_public").length, 1);
  assertEquals(shards.flat().filter((feedKey) => feedKey === "mediano_site").length, 1);
  assertEquals(normalKeys.filter((feedKey) => feedKey !== "mediano_public"), beforeActivation);
  assertEquals(normalKeys.filter((feedKey) => FEED_CONFIGS[feedKey].format === "apple_podcasts_html"), []);
});

Deno.test("Mediano site imports retain Spreaker public episodes by verified identity", async () => {
  const writes: PodcastEpisodeRow[][] = [];
  let observedUrls: string[] = [];
  let observedSources: string[] = [];
  let observedPodcastKeys: string[] = [];
  const repository: ImportRepository = {
    createImportRun: async () => ({ id: "site-run" }),
    loadExistingEpisodes: async (_source, _guids, urls = [], sources = [], podcastKeys = []) => {
      observedUrls = urls;
      observedSources = sources;
      observedPodcastKeys = podcastKeys;
      return [
        {
          podcast_key: "mediano superliga", source: "mediano_public_rss", external_guid: "https://api.spreaker.com/episode/75189119", external_episode_id: null,
          title: "MEDIANO SUPERLIGA #9: Her er din Superligapakke til 18 dage uden Superliga", description: null,
          published_at: "2026-09-21T10:15:37.000Z", duration_seconds: null, episode_url: "https://www.spreaker.com/episode/75189119",
          audio_url: "https://public.example/audio.mp3", image_url: null, is_active: true, metadata: {}
        },
        {
          podcast_key: "max mediano", source: "mediano_public_rss", external_guid: "https://api.spreaker.com/episode/other-parent", external_episode_id: null,
          title: "Mediano Superliga #11: Samme titel på tværs", description: null,
          published_at: "2026-09-23T10:00:00.000Z", duration_seconds: null, episode_url: "https://www.spreaker.com/episode/other-parent",
          audio_url: "https://public.example/other.mp3", image_url: null, is_active: true, metadata: {}
        }
      ];
    },
    upsertEpisodes: async (rows) => { writes.push(rows); },
    updateImportRun: async () => undefined
  };
  const feedConfigs: FeedConfigMap = {
    mediano_site: {
      podcast_key: "mediano superliga",
      source: "mediano_site_rss",
      feed_url: "https://example.test/mediano-site",
      metadata_only: true,
      dedupe_by_episode_url_with_sources: ["mediano_public_rss"],
      routes: [{ key: "superliga", podcast_key: "mediano superliga", title: { prefixes: ["Mediano Superliga"] } }]
    }
  };
  const result = await runEpisodeImport({
    feedKey: "mediano_site",
    feedConfigs,
    repository,
    fetchText: async () => "<rss><channel><title>Mediano</title><item><guid>site-duplicate</guid><title>Mediano Superliga #9: Her er din Superligapakke til 18 dage uden Superliga</title><link>https://www.mediano.nu/oversigt/medianosuperliga-9</link><pubDate>Mon, 21 Sep 2026 10:16:19 +0000</pubDate><enclosure url=\"https://private.example/audio.mp3\" /></item><item><guid>site-new</guid><title>Mediano Superliga #10: En ægte Støt Mediano-episode</title><link>https://www.mediano.nu/oversigt/medianosuperliga-10</link><pubDate>Tue, 22 Sep 2026 10:00:00 +0000</pubDate><enclosure url=\"https://private.example/new.mp3\" /></item><item><guid>site-different-parent</guid><title>Mediano Superliga #11: Samme titel på tværs</title><link>https://www.mediano.nu/oversigt/medianosuperliga-11</link><pubDate>Wed, 23 Sep 2026 10:00:00 +0000</pubDate><enclosure url=\"https://private.example/other.mp3\" /></item></channel></rss>",
    now: () => "2026-09-23T00:00:00.000Z"
  });

  assertEquals(observedUrls, ["https://www.mediano.nu/oversigt/medianosuperliga-9", "https://www.mediano.nu/oversigt/medianosuperliga-10", "https://www.mediano.nu/oversigt/medianosuperliga-11"]);
  assertEquals(observedSources, ["mediano_public_rss"]);
  assertEquals(observedPodcastKeys, ["mediano superliga"]);
  assertEquals(writes.flat().map((row) => row.title), ["Mediano Superliga #10: En ægte Støt Mediano-episode", "Mediano Superliga #11: Samme titel på tværs"]);
  assertEquals(writes.flat().every((row) => row.audio_url === null), true);
  assertEquals(result.inserted_count, 2);
  assertEquals(result.details.routing?.cross_source_url_duplicate_count, 0);
  assertEquals(result.details.routing?.cross_source_identity_duplicate_count, 1);
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
