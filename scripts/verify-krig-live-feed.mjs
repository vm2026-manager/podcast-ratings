import assert from "node:assert/strict";
import { classifyEpisodes, mapEpisodes, parseFeed, validateExpectedRssIdentity } from "../supabase/functions/import-podcast-episodes/core.ts";

const feedUrl = "https://api.dr.dk/podcasts/v1/feeds/krig-4";
const response = await fetch(feedUrl, { headers: { "user-agent": "podcast-ratings-read-only-source-audit/1.0" } });
assert.equal(response.status, 200, `DR feed HTTP status: ${response.status}`);
const feed = parseFeed((await response.text()).replace(/^\uFEFF/u, ""));
const config = { podcast_key: "krig", source: "sheet_krig_rss", feed_url: feedUrl,
  format: "rss", expected_rss_channel_title: "Krig" };
validateExpectedRssIdentity(feed, config);
assert.equal(feed.channel.title, "Krig");
assert.equal(feed.channel.link, "https://www.dr.dk/lyd/special-radio/krig-4109741269000");
const appleResponse = await fetch("https://itunes.apple.com/lookup?id=1667750476");
assert.equal(appleResponse.status, 200, `Apple Lookup HTTP status: ${appleResponse.status}`);
const apple = await appleResponse.json();
assert.equal(apple.resultCount, 1);
assert.equal(apple.results[0].trackName, "Krig");
assert.equal(apple.results[0].artistName, "DR");
assert.equal(apple.results[0].trackCount, 38);
assert.equal(apple.results[0].feedUrl, "https://api.dr.dk/podcasts/v1/feeds/krig-4.xml?format=podcast");

const mapped = mapEpisodes(feed, config, new Date().toISOString());
assert.equal(mapped.fetched_count, 38, "the verified DR source should contain the 38 Apple-listed episodes");
assert.equal(mapped.episodes.length, 38, "all source episodes map to the exact Krig podcast key");
assert.deepEqual(mapped.errors, [], "every source item has a usable GUID and title");
assert.equal(new Set(mapped.episodes.map((episode) => episode.external_guid)).size, 38, "DR GUIDs are unique");
assert.ok(mapped.episodes.every((episode) => episode.podcast_key === "krig" && episode.source === "sheet_krig_rss"));
assert.ok(mapped.episodes.every((episode) => episode.external_episode_id === episode.external_guid), "the importer preserves source GUIDs as external IDs");
assert.ok(mapped.episodes.every((episode) => episode.episode_url?.startsWith("https://www.dr.dk/lyd/")));
assert.ok(mapped.episodes.every((episode) => episode.audio_url?.startsWith("https://api.dr.dk/podcasts/v1/assets/")));
assert.ok(mapped.episodes.every((episode) => episode.description), "episode descriptions come from the RSS source");
assert.equal(mapped.episodes[0].external_guid, "16122492420", "latest source GUID stays stable");
assert.equal(mapped.episodes.at(-1).external_guid, "16122393251", "oldest source GUID stays stable");
assert.ok(mapped.episodes.every((episode) => /^(2023|2024)-/u.test(episode.published_at || "")), "publication dates stay in the 2023–2024 series window");
assert.deepEqual(classifyEpisodes(mapped.episodes, mapped.episodes), {
  inserted: [], updated: [], skipped_count: 38
}, "replaying the same source identities produces no duplicate inserts or updates");

const trailers = mapped.episodes.filter((episode) => episode.metadata.exclusion_reason === "teaser_or_trailer");
assert.equal(trailers.length, 0, "the current 38-item DR feed contains no teaser or trailer title");
assert.throws(() => validateExpectedRssIdentity(parseFeed(
  "<rss><channel><title>Different show</title><item><guid>16122492420</guid><title>Episode</title></item></channel></rss>"
), config), /RSS channel identity mismatch/u, "a different show cannot route into Krig");

console.log(JSON.stringify({
  status: response.status,
  appleStatus: appleResponse.status,
  channel: feed.channel.title,
  count: mapped.fetched_count,
  firstGuid: mapped.episodes[0].external_guid,
  lastGuid: mapped.episodes.at(-1).external_guid,
  teasers: trailers.length,
  repeatImport: { inserted: 0, updated: 0, skipped: 38 }
}, null, 2));
