import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runEpisodeImports, type ImportRepository, type PodcastEpisodeRow } from "./core.ts";
import type { FeedConfigMap } from "./feed-config.ts";

const RSS = "<rss><channel><title>Test</title><item><guid>episode-1</guid><title>Episode</title></item></channel></rss>";

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
