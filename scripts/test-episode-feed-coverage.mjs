import assert from "node:assert/strict";
import { checkEpisodeFeedCoverage } from "./monitor-episode-feed-coverage.mjs";

const row = (id, feed, title = id) => ({ "Podcast-ID": id, Titel: title, Feed: feed });
const podimoUrl = "https://open.podimo.com/podcast/0db490b8-907e-4f35-bd48-60eae9f8805b";
const podimo = {
  podcast_key: "smat brændbart", source: "podimo_smat_braendbart",
  format: "podimo_graphql", feed_url: "https://graphql.podimo.com/graphql",
  podcast_id: "0db490b8-907e-4f35-bd48-60eae9f8805b"
};
const catalogue = { rows: [
  row("smat brændbart", podimoUrl),
  row("another podimo", "https://open.podimo.com/podcast/a0b490b8-907e-4f35-bd48-60eae9f8805b"),
  row("ordinary rss", "https://example.test/rss.xml"),
  row("apple only", "apple:1896920078"),
  row("non feed", ""),
  { Titel: "Missing ID", Feed: "https://example.test/other.xml" }
]};
const check = checkEpisodeFeedCoverage(catalogue, { podimo_smat_braendbart: podimo });
assert.equal(check.catalogue_rows, 6);
assert.equal(check.catalogue_rows_with_feed, 5);
assert.equal(check.findings.length, 3);
assert.deepEqual(new Set(check.findings.map(x => x.cause)),
  new Set(["missing_or_disabled_import_adapter", "missing_podcast_id"]));
assert.equal(check.findings.filter(x => x.podcast_key === "another podimo").length, 1);
assert.ok(!check.findings.some(x => x.podcast_key === "ordinary rss"), "valid RSS gets a runtime adapter");
assert.ok(!check.findings.some(x => x.podcast_key === "smat brændbart"), "matching Podimo show is covered");
const mismatch = checkEpisodeFeedCoverage({ rows: [row("smat brændbart", 
  "https://open.podimo.com/podcast/ffffffff-ffff-ffff-ffff-ffffffffffff")] },
  { podimo_smat_braendbart: podimo });
assert.equal(mismatch.findings[0].cause, "podimo_show_id_mismatch");
const disabled = checkEpisodeFeedCoverage({ rows: [row("archived", "https://example.test/feed.xml")] },
  { old: { podcast_key: "archived", source: "old", feed_url: "https://example.test/feed.xml", enabled: false } });
assert.equal(disabled.findings[0].cause, "missing_or_disabled_import_adapter");
const alternate = checkEpisodeFeedCoverage({ rows: [row("smat brændbart", podimoUrl)] },
  { alternative: { podcast_key: "smat brændbart", source: "rss_alternative", feed_url: "https://example.test/working.rss", format: "rss" } });
assert.equal(alternate.findings.length, 0, "a code-owned alternative RSS is not silently re-routed");
console.log("Offline episode-feed adapter coverage regression: PASS");
