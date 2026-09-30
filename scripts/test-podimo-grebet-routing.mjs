import assert from "node:assert/strict";
import { fetchPodimoEpisodes, mapPodimoEpisodes, routeEpisodes, runEpisodeImports, selectNormalFeedKeys } from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

const config = FEED_CONFIGS.podimo_grebet_af_gvfb;
const hotel = ["7483ff0b-d64c-4cb4-81e3-7442da43d706", ...Array.from({ length: 8 }, (_, i) => `hotel-${i}`), "2c9ffc6a-a885-4cfa-a52e-4981402b8fe8"];
const gvfb = ["beaa8a13-edc9-4670-85f9-dd4948f543b3", ...Array.from({ length: 27 }, (_, i) => `gvfb-${i}`)];
const source = [...hotel.map((id, i) => ({ id, title: `S3-E${i + 1}: ${i ? "Efter hotellet" : "Velkommen til Romantik på Hotellet"}`, description: "DRs Hotel Romantik med æøå", duration: 12, publishedOn: "2026-01-01T00:00:00Z" })), ...gvfb.map((id, i) => ({ id, title: i ? `GVFB ${i}` : "S4-E1: Hvem er de nye par?", description: i ? "Gift ved første blik med ÆØÅ" : "Beskrivelse med æøå", duration: 12, publishedOn: "2026-01-01T00:00:00Z" }))];
const mapped = mapPodimoEpisodes(source, config, "2026-09-30T00:00:00Z");
const routed = routeEpisodes(mapped.episodes, config);
assert.equal(mapped.fetched_count, 38); assert.equal(routed.episodes.filter((e) => e.podcast_key === "grebet af gvfb").length, 28); assert.equal(routed.episodes.filter((e) => e.podcast_key === "romantik pa hotellet").length, 10);
assert.equal(routed.report.unmatched.length, 0); assert.equal(routed.report.ambiguous.length, 0); assert.equal(routed.episodes.every((e) => e.audio_url === null), true);
assert.equal(routeEpisodes(mapPodimoEpisodes([{ id: "unknown", title: "Unknown", description: "Unknown" }], config, "x").episodes, config).episodes.length, 0);
const conflicting = routeEpisodes(mapPodimoEpisodes([{ id: "conflict", title: "Hotel Romantik", description: "Gift ved første blik" }], config, "x").episodes, config);
assert.equal(conflicting.episodes.length, 0); assert.equal(conflicting.report.ambiguous.length, 1);
const merged = mergeSheetFeedConfigs({ rows: [{ "Podcast-ID": "grebet af gvfb", Feed: "apple:1765309936" }, { "Podcast-ID": "romantik pa hotellet", Feed: "https://podimo.com/dk/shows/grebet-af-gvfb" }] });
assert.equal(merged.configs.apple_1765309936, undefined); assert.equal(merged.configs.romantik_pa_hotellet, undefined);
let calls = 0; const repo = { createImportRun: async () => ({ id: "1" }), loadExistingEpisodes: async () => [], upsertEpisodes: async () => {}, updateImportRun: async () => {} };
await runEpisodeImports({ feedKeys: ["podimo_grebet_af_gvfb", "podimo_grebet_af_gvfb"], repository: repo, fetchPodimo: async () => { calls++; return { data: { episodes: source } }; } }); assert.equal(calls, 1);

const originalFetch = globalThis.fetch;
const pageEpisode = (id) => ({ id, title: `Episode ${id}`, description: "", duration: 1, publishedOn: "2026-01-01T00:00:00Z" });
const withMockedFetch = async (handler, assertion) => {
  globalThis.fetch = async (_url, init) => new Response(JSON.stringify(handler(JSON.parse(init.body))), { status: 200 });
  try { await assertion(); } finally { globalThis.fetch = originalFetch; }
};
await withMockedFetch(({ variables }) => ({ data: { episodes: variables.offset === 0 ? Array.from({ length: 100 }, (_, i) => pageEpisode(`first-${i}`)) : variables.offset === 100 ? Array.from({ length: 3 }, (_, i) => pageEpisode(`second-${i}`)) : [] } }), async () => {
  const paged = await fetchPodimoEpisodes(config);
  assert.equal(mapPodimoEpisodes(paged.data.episodes, config, "x").fetched_count, 103);
});
await withMockedFetch(({ variables }) => ({ data: { episodes: variables.offset === 0 ? Array.from({ length: 100 }, (_, i) => pageEpisode(`repeat-${i}`)) : Array.from({ length: 100 }, (_, i) => pageEpisode(`repeat-${i}`)) } }), async () => {
  await assert.rejects(() => fetchPodimoEpisodes(config), /repeated a page/);
});
await withMockedFetch(({ variables }) => ({ data: { episodes: variables.offset === 0 ? Array.from({ length: 100 }, (_, i) => pageEpisode(`duplicate-${i}`)) : [pageEpisode("duplicate-0")] } }), async () => {
  await assert.rejects(() => fetchPodimoEpisodes(config), /duplicate episode id/);
});
await withMockedFetch(() => ({ data: { episodes: "not-an-array" } }), async () => {
  await assert.rejects(() => fetchPodimoEpisodes(config), /expected episodes array/);
});
await withMockedFetch(() => ({ data: { episodes: [{}] } }), async () => {
  await assert.rejects(() => fetchPodimoEpisodes(config), /malformed episode/);
});
assert.equal(mapPodimoEpisodes([pageEpisode("url-check")], config, "x").episodes[0].episode_url, "https://podimo.com/dk/shows/grebet-af-gvfb/episode/url-check");
const livetConfig = FEED_CONFIGS.podimo_livet_ifolge_emil_og_thomas;
assert.equal(mapPodimoEpisodes([pageEpisode("url-check")], livetConfig, "x").episodes[0].episode_url, "https://podimo.com/dk/shows/274d3039-b004-4c08-87bf-6b0f952093fb/episode/url-check");
const livetMerged = mergeSheetFeedConfigs({ rows: [{ "Podcast-ID": "livet ifølge emil og thomas", Feed: "https://feeds.simplecast.com/TBCuWUyN" }] });
assert.equal(livetMerged.configs.livet_ifølge_emil_og_thomas, undefined);
const normalFeedKeys = selectNormalFeedKeys(FEED_CONFIGS);
assert.equal(normalFeedKeys.filter((key) => key === "podimo_grebet_af_gvfb").length, 1);
assert.equal(normalFeedKeys.filter((key) => key === "podimo_livet_ifolge_emil_og_thomas").length, 1);
console.log("Podimo shared-feed routing tests passed");
