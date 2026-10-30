import assert from "node:assert/strict";
import { checkEpisodeFeedCoverage } from "./monitor-episode-feed-coverage.mjs";
import { APPROVED_SHEET_FEED_BASELINE } from "../supabase/functions/import-podcast-episodes/sheet-feed-approval-baseline.ts";

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
assert.equal(check.findings.length, 4);
assert.deepEqual(new Set(check.findings.map(x => x.cause)),
  new Set(["podimo_adapter_review_required", "missing_or_disabled_import_adapter", "missing_podcast_id"]));
assert.equal(check.findings.find(x => x.podcast_key === "another podimo")?.cause,
  "podimo_adapter_review_required");
assert.equal(check.findings.find(x => x.podcast_key === "ordinary rss")?.cause, "missing_or_disabled_import_adapter",
  "new RSS metadata remains inactive until code explicitly approves it");
assert.ok(!check.findings.some(x => x.podcast_key === "smat brændbart"), "matching Podimo show is covered");
const [approvedId, approvedFeed] = APPROVED_SHEET_FEED_BASELINE[0];
const approvedCoverage = checkEpisodeFeedCoverage({ rows: [row(approvedId, approvedFeed)] });
assert.equal(approvedCoverage.findings.length, 0, "an existing approved feed remains covered");
const mismatch = checkEpisodeFeedCoverage({ rows: [row("smat brændbart", 
  "https://open.podimo.com/podcast/ffffffff-ffff-ffff-ffff-ffffffffffff")] },
  { podimo_smat_braendbart: podimo });
assert.equal(mismatch.findings[0].cause, "podimo_show_id_mismatch");
const malformedPodimo = checkEpisodeFeedCoverage({ rows: [row("unverified",
  "https://open.podimo.com/podcast/0db490b8-907e-4f35-bd48-60eae9f8805b?redirect=rss")] }, {});
assert.equal(malformedPodimo.findings[0].cause, "missing_or_disabled_import_adapter");
const disabled = checkEpisodeFeedCoverage({ rows: [row("archived", "https://example.test/feed.xml")] },
  { old: { podcast_key: "archived", source: "old", feed_url: "https://example.test/feed.xml", enabled: false } });
assert.equal(disabled.findings[0].cause, "missing_or_disabled_import_adapter");
const alternate = checkEpisodeFeedCoverage({ rows: [row("smat brændbart", podimoUrl)] },
  { alternative: { podcast_key: "smat brændbart", source: "rss_alternative", feed_url: "https://example.test/working.rss", format: "rss" } });
assert.equal(alternate.findings[0].cause, "podimo_adapter_review_required",
  "an unrelated RSS adapter cannot satisfy a Podimo show-link row");
console.log("Offline episode-feed adapter coverage regression: PASS");
