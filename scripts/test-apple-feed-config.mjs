import assert from "node:assert/strict";
import { buildSheetFeedEntries } from "./generate-feed-config-from-podcasts.mjs";
import { parseAppleFeed } from "../supabase/functions/import-podcast-episodes/feed-syntax.mjs";

for (const value of ["apple:1575533784", "Apple:1575533784", " APPLE:1575533784 "]) {
  assert.deepEqual(parseAppleFeed(value), { appleShowId: "1575533784" });
}
for (const value of ["apple:", "apple:abc", "apple:https://example.test", "apple_1575533784"]) {
  assert.equal(parseAppleFeed(value), null);
}

const configSource = "export const FEED_CONFIGS = {\n  // BEGIN GENERATED SHEET FEEDS\n  // END GENERATED SHEET FEEDS\n};";
const { generated } = buildSheetFeedEntries([
  { Titel: "RSS", "Podcast-ID": "permanent rss", Feed: "https://example.test/feed.xml" },
  { Titel: "Apple", "Podcast-ID": "permanent apple", Feed: " Apple:1843557403 " }
], configSource);
assert.deepEqual(generated[0], {
  feedKey: "permanent_rss", podcastKey: "permanent rss", source: "sheet_permanent_rss_rss",
  feedUrl: "https://example.test/feed.xml", format: "rss", appleShowId: ""
});
assert.deepEqual(generated[1], {
  feedKey: "apple_1843557403", podcastKey: "permanent apple", source: "apple_podcasts_1843557403",
  feedUrl: "https://podcasts.apple.com/dk/podcast/id1843557403", format: "apple_podcasts_html", appleShowId: "1843557403"
});
assert.equal(buildSheetFeedEntries([
  { Titel: "one", "Podcast-ID": "one", Feed: "apple:1843557403" },
  { Titel: "two", "Podcast-ID": "two", Feed: "apple:1843557403" }
], configSource).summary.duplicatesDetected, 1);
console.log("apple feed syntax and static config tests passed");
