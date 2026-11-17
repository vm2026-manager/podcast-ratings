import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const EPISODE_ID = "59389cfb-aa8c-40a3-94b4-9e2b04e832cc";
const PODCAST_KEY = "troels bech i en samtale";
const TITLE = "Landsholdets analytiker: Mounir Akhiat";
const [app, catalogueText] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")
]);
const catalogueRows = JSON.parse(catalogueText).rows || [];
const catalogueRow = catalogueRows.find((row) => row["Podcast-ID"] === PODCAST_KEY);
assert.equal(catalogueRow?.catalogue_id, "catalogue-v1-4665551d");

const sourceFunction = (name, nextName) => {
  const functionStart = app.indexOf(`function ${name}`);
  const start = app.slice(0, functionStart).endsWith("async ") ? functionStart - 6 : functionStart;
  const endCandidates = [app.indexOf(`\nfunction ${nextName}`, start), app.indexOf(`\nasync function ${nextName}`, start)]
    .filter((index) => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : -1;
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return app.slice(start, end);
};
const normalizeText = (value) => String(value ?? "").trim();
const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const legacyCanonicalIds = { "landsholdets analytiker mounir akhiat": PODCAST_KEY };
const historicalIds = { "landsholdets analytiker mounir akhiat": EPISODE_ID };
const state = { manualCanonicalEpisodeMappings: new Map(), authUser: null, supabase: {} };
const getEpisodeKey = new Function(
  "state",
  "normalizeText",
  `${sourceFunction("getEpisodeKey", "mergeEpisodes")}\nreturn getEpisodeKey;`
)(state, normalizeText);
const mergeEpisodes = new Function(
  "getEpisodeKey",
  "parseNumber",
  `${sourceFunction("mergeEpisodes", "formatEpisodeDate")}\nreturn mergeEpisodes;`
)(getEpisodeKey, parseNumber);
const getVerifiedHistoricalMedianoEpisodeBridges = new Function(
  "normalizeText",
  "MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS",
  "MEDIANO_HISTORICAL_CATALOGUE_CANONICAL_EPISODE_IDS",
  "MANUAL_CATALOGUE_SOURCE",
  `${sourceFunction("getVerifiedHistoricalMedianoEpisodeBridges", "refreshManualEpisodeRatingData")}\nreturn getVerifiedHistoricalMedianoEpisodeBridges;`
)(normalizeText, legacyCanonicalIds, historicalIds, "manual_catalogue_v1");
const getMappedManualEpisodesForDisplay = new Function(
  "getVerifiedHistoricalMedianoEpisodeBridges",
  "isManualEpisodeMappingResolved",
  `${sourceFunction("getMappedManualEpisodesForDisplay", "refreshManualEpisodeRatingData")}\nreturn getMappedManualEpisodesForDisplay;`
)(getVerifiedHistoricalMedianoEpisodeBridges, (episode) => Boolean(state.manualCanonicalEpisodeMappings.get(episode.manual_episode_key)));
const remoteMounir = {
  id: EPISODE_ID,
  podcast_key: PODCAST_KEY,
  source: "mediano_public_rss",
  title: TITLE,
  dataSource: "supabase",
  is_active: true
};
const manualMounir = {
  id: EPISODE_ID,
  podcast_key: PODCAST_KEY,
  source: "manual_catalogue_v1",
  dataSource: "manual",
  manual_episode_key: `manual-catalogue-v1:${EPISODE_ID}`,
  title: TITLE,
  editorial_rating: 6.7
};
const thomas = {
  id: "88695513-6a00-4c76-8273-078913f0af03",
  podcast_key: PODCAST_KEY,
  source: "mediano_public_rss",
  title: "Troels Bech i en samtale med Thomas Thomasberg",
  dataSource: "supabase"
};
const henrik = {
  id: "dbd7db8f-8af3-4743-991c-a64b8eb9c5d2",
  podcast_key: PODCAST_KEY,
  source: "mediano_public_rss",
  title: "Troels Bech i en samtale med Henrik Jensen",
  dataSource: "supabase"
};
assert.deepEqual(
  getMappedManualEpisodesForDisplay(PODCAST_KEY, [manualMounir], []),
  [],
  "the canonical UUID alone cannot make a missing Mediano mapping safe"
);

assert.deepEqual(
  getVerifiedHistoricalMedianoEpisodeBridges(PODCAST_KEY, [manualMounir], [remoteMounir]),
  [manualMounir],
  "the exact reviewed UUID and loaded Mediano RSS row validate the historical bridge"
);
for (const changedRemote of [
  { ...remoteMounir, source: "manual_catalogue_v1" },
  { ...remoteMounir, id: "unknown-episode-id" },
  { ...remoteMounir, title: "Different title" },
  { ...remoteMounir, podcast_key: "another podcast" }
]) {
  assert.deepEqual(
    getVerifiedHistoricalMedianoEpisodeBridges(PODCAST_KEY, [manualMounir], [changedRemote]),
    [],
    "unknown or mismatched episode identities fail closed"
  );
}
assert.deepEqual(
  getVerifiedHistoricalMedianoEpisodeBridges("another podcast", [manualMounir], [remoteMounir]),
  [],
  "the bridge is scoped to the exact Podcast-ID"
);

const merged = mergeEpisodes([remoteMounir, thomas, henrik], [manualMounir]);
assert.equal(merged.length, 3, "the historical episode is shown once with the three RSS episodes");
const mergedMounir = merged.find((episode) => episode.title === TITLE);
assert.equal(mergedMounir.id, EPISODE_ID, "the existing canonical UUID is retained");
assert.equal(mergedMounir.source, "mediano_public_rss", "the imported source provenance is retained");
assert.equal(mergedMounir.dataSource, "supabase", "the existing episode remains the displayed row");
assert.equal(mergedMounir.editorial_rating, 6.7, "the catalogue editorial score is merged onto the RSS row");

const mappingCalls = [];
const ensureCalls = [];
const refreshManualEpisodeRatingData = new Function(
  "state",
  "getVerifiedHistoricalMedianoEpisodeBridges",
  "fetchManualCanonicalEpisodeMappings",
  "isManualEpisodeMappingResolved",
  "hydrateLocalEpisodeRatingState",
  "fetchEpisodeRatingMetaForEpisodes",
  `${sourceFunction("refreshManualEpisodeRatingData", "fetchEpisodeStatsForIds")}\nreturn refreshManualEpisodeRatingData;`
)(
  state,
  getVerifiedHistoricalMedianoEpisodeBridges,
  async (episodes) => {
    mappingCalls.push(episodes);
    ensureCalls.push(...episodes);
    if (episodes.some((episode) => episode.title === "Unknown manual episode")) {
      throw new Error("P0001 identity conflict");
    }
  },
  () => false,
  () => {},
  async () => {}
);
await refreshManualEpisodeRatingData(PODCAST_KEY, [manualMounir], { existingEpisodes: [remoteMounir] });
assert.deepEqual(mappingCalls, [[]], "verified RSS bridge bypasses manual mapping lookup and ensure RPC");
assert.deepEqual(ensureCalls, [], "verified RSS bridge causes no ensure_manual_catalogue_episode call");

const unrelatedManual = { ...manualMounir, id: "unreviewed-uuid", manual_episode_key: "manual-catalogue-v1:unreviewed-uuid", title: "Unknown manual episode" };
mappingCalls.length = 0;
await assert.rejects(
  () => refreshManualEpisodeRatingData(PODCAST_KEY, [unrelatedManual], { existingEpisodes: [remoteMounir] }),
  "identity conflicts outside the reviewed bridge remain fail-closed"
);
assert.deepEqual(mappingCalls.at(-1), [unrelatedManual], "unknown manual episodes still enter normal guarded mapping resolution");

const buildFetchHarness = ({ rows = [], queryError = null, manualEpisodes = [], user = null, mappingError = null } = {}) => {
  const episodeState = {
    items: [], loading: false, loadingMore: false, error: "", remoteLoadedCount: 0,
    totalCount: null, hasMore: false, statsById: {}, userRatingsById: {}
  };
  const config = { podcastKey: PODCAST_KEY, databasePodcastKey: PODCAST_KEY, pageSize: 20 };
  const query = {
    select() { return this; },
    eq() { return this; },
    async range() { return { data: rows, error: queryError, count: rows.length }; }
  };
  const fetchManual = async (episodes) => {
    mappingCalls.push(episodes);
    if (mappingError) throw mappingError;
  };
  const scopedRefresh = async (podcastKey, episodes, options = {}) => {
    const bridgeIds = new Set(getVerifiedHistoricalMedianoEpisodeBridges(podcastKey, episodes, options.existingEpisodes));
    await fetchManual(episodes.filter((episode) => !bridgeIds.has(episode)));
  };
  const fetch = new Function(
    "state", "getEpisodePodcastConfig", "getPodcastEpisodeState", "getEpisodeDatabasePodcastKey",
    "applyPodcastEpisodeSourceBoundary", "orderPodcastEpisodes", "EPISODE_PAGE_SIZE",
    "getRateablePodcastEpisodes", "filterEpisodesToConfigSeason", "getConfiguredManualEpisodes",
    "refreshManualEpisodeRatingData", "getMappedManualEpisodesForDisplay", "hydrateLocalEpisodeRatingState", "mergeEpisodes",
    "fetchEpisodeRatingMetaForEpisodes", "updateGenstartEpisodeSection", "updateOpenEpisodeDetailScores",
    "console", "Date", "Number", "Math",
    `${sourceFunction("fetchGenstartEpisodes", "searchGenstartEpisodes")}\nreturn fetchGenstartEpisodes;`
  )(
    { activePodcastDetailKey: PODCAST_KEY, authUser: user, supabase: { from: () => query } },
    () => config,
    () => episodeState,
    () => PODCAST_KEY,
    (value) => value,
    (value) => value,
    20,
    (value) => value,
    (value) => value,
    () => manualEpisodes,
    scopedRefresh,
    getMappedManualEpisodesForDisplay,
    () => {},
    mergeEpisodes,
    async () => {},
    () => {},
    () => {},
    { error() {} },
    Date,
    Number,
    Math
  );
  return { run: fetch, episodeState };
};

for (const user of [null, { id: "test-user" }]) {
  mappingCalls.length = 0;
  const harness = buildFetchHarness({ rows: [remoteMounir, thomas, henrik], manualEpisodes: [manualMounir], user });
  await harness.run();
  assert.equal(harness.episodeState.items.length, 3, "all three RSS episodes remain visible for anonymous and logged-in users");
  assert.equal(harness.episodeState.items.filter((episode) => episode.id === EPISODE_ID).length, 1, "Mounir is rendered once");
  assert.equal(harness.episodeState.items[0].editorial_rating, 6.7, "the editorial score survives fetch and merge");
  assert.deepEqual(mappingCalls, [[]], "no manual ensure RPC is attempted for the verified bridge");
}

mappingCalls.length = 0;
const mappingFailure = buildFetchHarness({
  rows: [remoteMounir, thomas, henrik],
  manualEpisodes: [unrelatedManual],
  user: { id: "test-user" },
  mappingError: new Error("P0001 identity conflict")
});
await mappingFailure.run();
assert.equal(mappingFailure.episodeState.items.length, 3, "one manual mapping failure does not hide valid fetched episodes");
assert.equal(mappingFailure.episodeState.error, "", "a secondary mapping failure is not reported as a feed fetch failure");
assert.equal(mappingFailure.episodeState.items.some((episode) => episode.title === "Unknown manual episode"), false,
  "an unresolved manual identity is not merged by its candidate UUID");

const empty = buildFetchHarness({ rows: [] });
await empty.run();
assert.equal(empty.episodeState.items.length, 0);
assert.equal(empty.episodeState.error, "", "a successful empty response is an empty list, not a fetch failure");
const httpFailure = buildFetchHarness({ rows: [], queryError: new Error("HTTP 503") });
await httpFailure.run();
assert.equal(httpFailure.episodeState.items.length, 0);
assert.equal(httpFailure.episodeState.error, "Episoderne kunne ikke hentes lige nu.", "a real HTTP error remains distinct from an empty list");

const getEpisodeWorkspaceSummary = new Function(
  "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeWorkspaceEpisodes", "normalizeText", "EPISODE_WORKSPACE_PAGE_SIZE",
  `${sourceFunction("getEpisodeWorkspaceSummary", "resetEpisodeWorkspaceSearch")}\nreturn getEpisodeWorkspaceSummary;`
)((podcast) => podcast.state, () => null, (podcast) => podcast.state.items, normalizeText, 20);
const failedSummary = getEpisodeWorkspaceSummary({ state: httpFailure.episodeState });
const emptySummary = getEpisodeWorkspaceSummary({ state: empty.episodeState });
assert.equal(failedSummary, "Episoderne kunne ikke hentes lige nu.");
assert.equal(emptySummary, "Der er endnu ingen episoder at vise.");
assert.notEqual(failedSummary, emptySummary, "the overview never combines an empty-list message with a fetch error");

assert.match(app, /refreshManualEpisodeRatingData\(config\.podcastKey, manualEpisodes, \{ existingEpisodes: rows \}\)/u);
assert.match(app, /if \(!loaded && episodeState\.error\) return episodeState\.error;/u);
console.log("Troels Bech episode display stability regressions passed.");
