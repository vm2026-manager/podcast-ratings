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

Deno.test("runtime feed audit reports duplicate feed URLs without silently treating them as routes", () => {
  const result = mergeSheetFeedConfigs({ rows: [] }, {
    first: { podcast_key: "first", source: "first_rss", feed_url: "https://example.test/shared" },
    second: { podcast_key: "second", source: "second_rss", feed_url: "https://example.test/shared" }
  });
  assertEquals(result.audit.duplicate_feed_urls_detected, 1);
  assertEquals(result.audit.duplicate_feed_urls, [{
    feed_url: "https://example.test/shared", feed_keys: ["first", "second"]
  }]);
});

Deno.test("a sheet feed cannot shadow an explicit static owner of the same URL", () => {
  const result = mergeSheetFeedConfigs({ rows: [{
    Titel: "Adfærd", "Podcast-ID": "adfærd",
    Feed: "https://feeds.soundcloud.com/users/soundcloud:users:154832827/sounds.rss"
  }] }, {
    borgen: {
      podcast_key: "borgen unplugged 2 0", source: "soundcloud_borgen_unplugged_rss",
      feed_url: "https://feeds.soundcloud.com/users/soundcloud:users:154832827/sounds.rss"
    }
  });
  assertEquals(result.configs.adfærd, undefined);
  assertEquals(result.audit.duplicate_feed_urls_skipped, [{
    feed_url: "https://feeds.soundcloud.com/users/soundcloud:users:154832827/sounds.rss",
    skipped_feed_key: "adfærd"
  }]);
});

Deno.test("the runtime catalogue enables Valley Heat while keeping static adapters and Apple HTML feeds out of normal all", () => {
  const staticConfigs = {
    genstart: {
      podcast_key: "genstart",
      source: "dr_genstart_rss",
      feed_url: "https://example.test/genstart",
      format: "dr_lyd_next_data" as const
    }
  };
  const result = mergeSheetFeedConfigs({ rows: [
    {
      Titel: "Valley Heat",
      "Podcast-ID": "valley heat",
      Feed: "https://feeds.simplecast.com/kKMR_wuB"
    },
    {
      Titel: "Apple-only feed",
      "Podcast-ID": "apple-only feed",
      Feed: "APPLE:1530344328"
    }
  ] }, staticConfigs);
  const normalAllFeedKeys = Object.entries(result.configs)
    .filter(([, config]) => config.enabled !== false)
    .map(([feedKey]) => feedKey);

  assertEquals(result.configs.genstart, staticConfigs.genstart);
  assertEquals(result.configs.valley_heat, {
    podcast_key: "valley heat",
    source: "sheet_valley_heat_rss",
    feed_url: "https://feeds.simplecast.com/kKMR_wuB",
    format: "rss",
    enabled: true
  });
  assertEquals(result.configs.apple_1530344328?.enabled, false);
  assertEquals(normalAllFeedKeys, ["genstart", "valley_heat"]);
});
