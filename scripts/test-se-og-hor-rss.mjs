import assert from "node:assert/strict";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { dryRunConfigError, runRssDryRun } from "../supabase/functions/import-podcast-episodes/dry-run.ts";

const config = FEED_CONFIGS.se_og_hor_lige_her;
const makeFeed = ({ channel = config.expected_rss_channel_title, items = [] } = {}) =>
  `<rss><channel><title>${channel}</title><link>https://www.spreaker.com/podcast/se-og-hor-lige-her--7077680</link>${items.join("")}</channel></rss>`;
const makeItem = ({ guid, title = "SE OG HØR LIGE HER: test", date = "Mon, 02 Nov 2026 14:50:19 +0000", link = "https://www.seoghoer.dk/reality", audio = "https://api.spreaker.com/download/episode/1/test.mp3" }) =>
  `<item><guid>${guid}</guid><title>${title}</title><pubDate>${date}</pubDate><link>${link}</link><enclosure url="${audio}" type="audio/mpeg"/></item>`;

assert.equal(dryRunConfigError("se_og_hor_lige_her", config), null);
assert.match(dryRunConfigError("all", config), /single feed/);

const guid = `${config.expected_external_guid_prefix}12345`;
const oneItem = makeItem({ guid });
const positive = await runRssDryRun(config, async (url) => {
  assert.equal(url, "https://www.spreaker.com/show/7077680/episodes/feed");
  return makeFeed({ items: [oneItem] });
}, "2026-11-03T00:00:00.000Z");
assert.equal(positive.status, "success");
assert.equal(positive.podcast_key, "se og hor lige her");
assert.equal(positive.fetched_count, 1);
assert.equal(positive.valid_count, 1);
assert.equal(positive.episodes[0].external_guid, guid);
assert.equal(positive.episodes[0].published_at, "2026-11-02T14:50:19.000Z");
assert.equal(positive.episodes[0].episode_url, "https://www.seoghoer.dk/reality");
assert.equal(positive.episodes[0].audio_url, "https://api.spreaker.com/download/episode/1/test.mp3");

const stable = await runRssDryRun(config, async () => makeFeed({ items: [oneItem] }), "2026-11-03T00:00:00.000Z");
assert.deepEqual(stable.episodes, positive.episodes);

await assert.rejects(
  runRssDryRun(config, async () => makeFeed({ channel: "Sladderministeriet", items: [oneItem] })),
  /RSS channel identity mismatch/
);
await assert.rejects(
  runRssDryRun(config, async () => makeFeed({ items: [makeItem({ guid: "https://example.com/episode/12345" })] })),
  /RSS external GUID identity mismatch/
);

const duplicate = await runRssDryRun(config, async () => makeFeed({ items: [oneItem, oneItem] }));
assert.equal(duplicate.status, "partial");
assert.equal(duplicate.fetched_count, 2);
assert.equal(duplicate.valid_count, 1);
assert.equal(duplicate.duplicate_guid_count, 1);
assert.equal(duplicate.episodes.length, 1);

assert.equal(config.podcast_key, "se og hor lige her");
assert.equal(config.enabled, true);
assert.equal(config.supersedes_sheet_feed, true);
console.log("SE OG HØR RSS identity, mapping, date, link, duplicate, negative, and repeatability checks passed.");
