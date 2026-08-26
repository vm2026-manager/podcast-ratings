import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeSheetFeedConfigs } from "./runtime-feed-config.ts";
import { selectAppleFeedKeys } from "./core.ts";

Deno.test("runtime Feed parser matches static Apple semantics and rejects collisions", () => {
  const staticConfigs = {
    genstart: { podcast_key: "genstart", source: "dr_genstart", feed_url: "https://example.test/genstart" }
  };
  const result = mergeSheetFeedConfigs({ rows: [
    { Titel: "RSS", "Podcast-ID": "rss permanent", Feed: "https://example.test/rss" },
    { Titel: "Apple", "Podcast-ID": "apple permanent", Feed: " APPLE:1843557403 " },
    { Titel: "Duplicate", "Podcast-ID": "other permanent", Feed: "apple:1843557403" },
    { Titel: "Invalid", "Podcast-ID": "bad", Feed: "apple:https://example.test" }
  ] }, staticConfigs);
  assertEquals(result.configs.apple_1843557403, {
    podcast_key: "apple permanent", source: "apple_podcasts_1843557403",
    feed_url: "https://podcasts.apple.com/dk/podcast/id1843557403",
    format: "apple_podcasts_html", apple_show_id: "1843557403", enabled: false
  });
  assertEquals(result.audit.dynamic_sheet_feed_count, 2);
  assertEquals(result.audit.duplicates_skipped, 1);
  assertEquals(result.audit.invalid_feed_urls_skipped, 1);
  assertEquals(selectAppleFeedKeys(result.configs), ["apple_1843557403"]);
  assertEquals(Object.entries(result.configs).filter(([, config]) => config.enabled !== false).map(([key]) => key), ["genstart", "rss_permanent"]);
});
