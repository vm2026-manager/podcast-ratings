import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildEpisodeImportLifecycle } from "./monitor-episode-feed-coverage.mjs";
import { getEpisodeFeatureEligibility } from "../supabase/functions/import-podcast-episodes/core.ts";

const row = (id, feed, extra = {}) => ({ "Podcast-ID": id, Titel: id, Feed: feed, ...extra });
const makeConfig = (podcast_key, source, format, feed_url, extra = {}) => ({
  podcast_key, source, format, feed_url, enabled: true, ...extra
});

const rss = makeConfig("ordinary rss", "ordinary_rss_v1", "rss", "https://ordinary.example/feed.xml");
const appleHtml = makeConfig("apple html", "apple_podcasts_123456", "apple_podcasts_html",
  "https://podcasts.apple.com/dk/podcast/id123456", { apple_show_id: "123456" });
const graphQl = makeConfig("podimo graphql", "podimo_graphql_v1", "podimo_graphql",
  "https://graphql.podimo.com/graphql", { podcast_id: "22345678-1234-1234-1234-123456789012" });
const drLyd = makeConfig("dr lyd", "dr_lyd_example", "dr_lyd_next_data",
  "https://www.dr.dk/lyd/p1/example-1234567890");
const radio4 = makeConfig("radio4 json", "radio4_example_api", "radio4_json",
  "https://radio4.dk/api/programs/12345678-1234-1234-1234-123456789012/episodes?limit=25",
  { routes: [{ podcast_key: "radio4 json", guid: "radio-guid-1" }] });
const configs = { rss, appleHtml, graphQl, drLyd, radio4 };
const validRows = [
  row("ordinary rss", rss.feed_url),
  row("apple html", "Apple:123456", { Link: appleHtml.feed_url }),
  row("podimo graphql", "https://open.podimo.com/podcast/22345678-1234-1234-1234-123456789012"),
  row("dr lyd", drLyd.feed_url),
  row("radio4 json", radio4.feed_url),
  row("manual series", "", { manualEpisodes: ["Episode 1"] })
];
const valid = buildEpisodeImportLifecycle({ rows: validRows }, configs);
const byId = new Map(valid.map(entry => [entry.podcast_id, entry]));

for (const [id, format, source] of [
  ["ordinary rss", "rss", "ordinary_rss_v1"],
  ["apple html", "apple_podcasts_html", "apple_podcasts_123456"],
  ["podimo graphql", "podimo_graphql", "podimo_graphql_v1"],
  ["dr lyd", "dr_lyd_next_data", "dr_lyd_example"],
  ["radio4 json", "radio4_json", "radio4_example_api"]
]) {
  const adapter = byId.get(id)?.adapter?.owners?.[0];
  assert.equal(adapter?.format, format, `${id}: exact adapter format is reported`);
  assert.equal(adapter?.source, source, `${id}: exact source ID is reported`);
  assert.ok(adapter?.feed_key, `${id}: exact feed key is reported`);
  assert.equal(adapter?.enabled, true, `${id}: approved config is active in main code`);
}
assert.equal(byId.get("manual series")?.adapter.status, "manual_catalogue");

const negatives = [
  {
    id: "ordinary rss",
    rows: [row("ordinary rss", rss.feed_url, { episodeFeedVerification: {
      version: 1, status: "review_required", reason: "rss_channel_title_mismatch", podcast_id: "ordinary rss",
      feed_url: rss.feed_url
    } })],
    configs,
    code: "rss_channel_title_mismatch"
  },
  {
    id: "apple html",
    rows: [row("apple html", "Apple:123456", { Link: appleHtml.feed_url })],
    configs: { ...configs, appleHtml: { ...appleHtml, enabled: false } },
    code: "adapter_disabled"
  },
  {
    id: "podimo graphql",
    rows: [row("podimo graphql", "https://open.podimo.com/podcast/ffffffff-ffff-ffff-ffff-ffffffffffff")],
    configs,
    code: "podimo_show_id_mismatch"
  },
  {
    id: "dr lyd",
    rows: [row("dr lyd", drLyd.feed_url)],
    configs: { ...configs, drLyd: { ...drLyd, enabled: false } },
    code: "adapter_disabled"
  },
  {
    id: "radio4 json",
    rows: [row("radio4 json", radio4.feed_url), row("RADIO4 JSON", radio4.feed_url)],
    configs,
    code: "normalized_podcast_id_collision"
  },
  {
    id: "manual series",
    rows: [row("manual series", "", { manualEpisodes: ["Episode 1"] }), row("manual series", "", { manualEpisodes: ["Episode 1"] })],
    configs,
    code: "duplicate_exact_podcast_id"
  }
];
for (const test of negatives) {
  const entry = buildEpisodeImportLifecycle({ rows: test.rows }, test.configs).find(item => item.podcast_id === test.id);
  assert.equal(entry?.lifecycle_status, "blocked", `${test.id}: unsafe lifecycle is fail-closed`);
  assert.ok(entry?.blockers.some(item => item.code === test.code), `${test.id}: precise blocker ${test.code}`);
}

const targetPayload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const targetLifecycle = buildEpisodeImportLifecycle(targetPayload).find(item =>
  item.podcast_id === "politik for viderekomne med søs og huxi");
assert.equal(targetLifecycle?.catalogue.status, "unique");
assert.equal(targetLifecycle?.source_verification.status, "verified");
assert.equal(targetLifecycle?.adapter.owners[0]?.feed_key,
  "podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi");
assert.equal(targetLifecycle?.adapter.owners[0]?.source, "podimo_rss_politik_for_viderekomne_med_sos_og_huxi");
assert.equal(targetLifecycle?.source_verification.status, "verified");
assert.equal(targetLifecycle?.lifecycle_status, "awaiting_production_evidence");
assert.equal(targetLifecycle?.deployment.status, "unknown");
assert.equal(targetLifecycle?.scheduled_import.status, "not_observed_by_coverage");
assert.match(targetLifecycle?.evidence_gaps[0]?.code || "", /deployment_status_unavailable/u);
const staleTarget = structuredClone(targetPayload.rows.find(item => item["Podcast-ID"] === targetLifecycle.podcast_id));
staleTarget.episodeFeedVerification.catalogue_feed_url = "https://open.podimo.com/podcast/ffffffff-ffff-ffff-ffff-ffffffffffff";
const staleLifecycle = buildEpisodeImportLifecycle({ rows: [staleTarget] }).find(item => item.podcast_id === targetLifecycle.podcast_id);
assert.ok(staleLifecycle?.blockers.some(item => item.code === "source_verification_evidence_mismatch"),
  "Podimo public-RSS mapping fails closed when its source identity drifts");

const ep01 = { id: "6058c15e-31a6-4c64-9f28-db7f732a69fe", title: "EP01", is_active: true,
  rateable: true, metadata: { rateable: true } };
const trailer = { id: "931b18bd-0dc8-45a6-8952-17f6c9ed7820", title: "Trailer", is_active: false,
  rateable: false, metadata: { rateable: false } };
const eligibility = getEpisodeFeatureEligibility([ep01, trailer]);
assert.equal(eligibility.activeRateableEpisodes, 1);
assert.equal(eligibility.episodeFeatureEnabled, false,
  "the existing two-rateable-episode health threshold remains distinct from frontend visibility");

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf("function renderPodcastEpisodeOverviewRows(");
const end = app.indexOf("\nfunction ", start + 1);
assert.ok(start >= 0 && end > start, "the existing episode overview renderer must exist");
const rendererSource = app.slice(start, end);
const stubs = {
  getPodcastEpisodeState: () => ({ loading: false, error: "", items: [ep01], workspaceVisibleCount: 12 }),
  getEpisodePodcastConfig: () => ({ enabled: true, persistence: "supabase" }),
  getEpisodeWorkspaceEpisodes: () => [ep01],
  EPISODE_WORKSPACE_PAGE_SIZE: 12,
  getEpisodeKey: episode => episode.id,
  getAppleSeasonEpisodeNumber: () => null,
  formatEpisodeDate: () => "",
  getEpisodeStat: () => null,
  getEpisodeUserRating: () => null,
  parseNumber: value => value == null ? null : Number(value),
  isManualEpisodeRatingAvailable: () => true,
  formatCompactRating: String,
  getOfficialMedianoEpisodeSourceUrl: () => "",
  formatEpisodeOverviewScore: () => "—",
  formatUserRatingCount: () => "",
  formatEpisodeOverviewOwnScore: () => "Vurdér",
  escapeHtml: value => String(value)
};
const renderRows = new Function(...Object.keys(stubs), `${rendererSource}; return renderPodcastEpisodeOverviewRows;`)(...Object.values(stubs));
const rendered = renderRows({ podcast_id: "politik for viderekomne med søs og huxi" });
assert.equal((rendered.match(/<tr class=/gu) || []).length, 1);
assert.match(rendered, /EP01/u, "one active rateable episode renders in the existing episode table");
assert.match(rendered, /data-episode-overview-rating-id="6058c15e-31a6-4c64-9f28-db7f732a69fe"/u);
assert.doesNotMatch(rendered, /disabled aria-disabled/u);
assert.doesNotMatch(rendered, /Der er endnu ingen episoder/u);

console.log("Per-ID importer lifecycle, fail-closed adapter matrix, and one-episode frontend regression: PASS");
