import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");
const groupData = JSON.parse(await readFile(new URL("../data/podcast-display-groups.json", import.meta.url), "utf8"));
const group = groupData.groups.find((item) => item.id === "kirsten-ringer-til-rasmus");
assert.ok(group);

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  let depth = 0;
  let inString = "";
  let escaped = false;
  const open = app.indexOf(") {", start) + 2;
  for (let index = open; index < app.length; index += 1) {
    const character = app[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === inString) inString = "";
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      inString = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const normalizeMatchKey = (value) => normalizeText(value)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9æøå ]/g, " ").replace(/\s+/g, " ").trim();
const episodeKey = (episode) => String(episode?.id || episode?.external_guid || "").trim();
const getAppleSeasonEpisodeNumber = new Function("normalizeText", `${extractFunction("getAppleSeasonEpisodeNumber")}\nreturn getAppleSeasonEpisodeNumber;`)(normalizeText);
const filterEpisodesToConfigSeason = new Function("getAppleSeasonEpisodeNumber", `${extractFunction("filterEpisodesToConfigSeason")}\nreturn filterEpisodesToConfigSeason;`)(getAppleSeasonEpisodeNumber);

const rows = [
  ...Array.from({ length: 2 }, (_, index) => ({ id: `apple-s4-e${index + 1}`, podcast_key: group.episodeConfig.databasePodcastKey, source: group.episodeConfig.source, description: `Sæson 4, afsnit ${index + 1}.`, metadata: { apple_season_number: 4, apple_season_episode_number: index + 1 } })),
  ...Array.from({ length: 6 }, (_, index) => ({ id: `apple-s5-e${index + 1}`, podcast_key: group.episodeConfig.databasePodcastKey, source: group.episodeConfig.source, description: `Sæson 5 - afsnit ${index + 1}.`, metadata: { apple_season_number: 5, apple_season_episode_number: index + 1 } })),
  ...Array.from({ length: 4 }, (_, index) => ({ id: `apple-s6-e${index + 1}`, podcast_key: group.episodeConfig.databasePodcastKey, source: group.episodeConfig.source, description: `Sæson 6, afsnit ${index + 1}.`, metadata: { apple_season_number: 6, apple_season_episode_number: index + 1 } }))
];
const immutableEpisodeIds = rows.map((row) => row.id);
for (const season of [4, 5, 6]) {
  const cacheRows = filterEpisodesToConfigSeason(rows, { seasonNumber: season });
  assert.ok(cacheRows.length > 0);
  assert.ok(cacheRows.every((row) => getAppleSeasonEpisodeNumber(row)?.season === season));
}
assert.deepEqual(filterEpisodesToConfigSeason(rows, { seasonNumber: 6 }).map((row) => row.id), [
  "apple-s6-e1", "apple-s6-e2", "apple-s6-e3", "apple-s6-e4"
]);

const callBody = (name) => {
  const start = app.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const open = app.indexOf(") {", start) + 2;
  let depth = 0;
  let inString = "";
  let escaped = false;
  for (let index = open; index < app.length; index += 1) {
    const character = app[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === inString) inString = "";
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      inString = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
};
const fetchBody = callBody("fetchGenstartEpisodes");
const searchBody = callBody("searchGenstartEpisodes");
assert.match(fetchBody, /filterEpisodesToConfigSeason\(fetchedRows, config\)/u);
assert.match(fetchBody, /remoteLoadedCount \+ fetchedRows\.length/u, "list offsets advance by raw DB rows even when a page filters out another season");
assert.match(searchBody, /filterEpisodesToConfigSeason\(fetchedRows, config\)/u);
assert.match(searchBody, /searchRemoteLoadedCount \+ fetchedRows\.length/u, "search offsets advance by raw DB rows after season filtering");
assert.match(searchBody, /const pageSize = Number\(config\.pageSize \|\| EPISODE_PAGE_SIZE\)/u);
assert.match(app, /state\.activeEpisodeRatingContext = episodeRatingContext/u, "opening an episode rating dialog stores its explicit routing context");
assert.match(app, /state\.activeEpisodeRatingContext \|\| getEpisodeRatingContext/u, "save and delete use the dialog context before any global episode-cache lookup");

const state = {
  podcastDisplayGroups: [group],
  authUser: { id: "rating-test-user" },
  userRatingsByKey: {
    "kirsten ringer til rasmus sæson 4": 8.5,
    "display-season:kirsten-ringer-til-rasmus:5": 7.4,
    "display-season:kirsten-ringer-til-rasmus:6": 6.8
  },
  podcastEpisodesByKey: {},
  profileEpisodeRatings: { episodeMetaById: {} },
  episodeParentRatingSyncSignatures: {},
  episodeParentRatingSyncPendingKeys: new Set(),
  activePodcastDetailKey: "",
  activeEpisodeRatingId: null,
  activeEpisodeRatingContext: null,
  ratingDialogMode: "episode"
};
const resolvePodcastByStoredKey = (key) => key === "kirsten ringer til rasmus sæson 4"
  ? { podcastId: key, legacyKey: key }
  : null;
const getDisplayGroupSeasonIdentityKey = new Function("normalizeText", `${extractFunction("getDisplayGroupSeasonIdentityKey")}\nreturn getDisplayGroupSeasonIdentityKey;`)(normalizeText);
const getDisplayGroupEpisodeSeason = new Function("state", "normalizeText", "normalizeMatchKey", "resolvePodcastByStoredKey", "getEpisodePodcastKey", "getAppleSeasonEpisodeNumber", "getDisplayGroupSeasonIdentityKey", `
  ${extractFunction("getDisplayGroupEpisodeSeason")}
  return getDisplayGroupEpisodeSeason;
`)(state, normalizeText, normalizeMatchKey, resolvePodcastByStoredKey,
  (item) => item?._displayGroupEpisodeStateKey || item?.podcast_key || item?.podcastId || item?.legacyKey || "",
  getAppleSeasonEpisodeNumber, getDisplayGroupSeasonIdentityKey);
const getEpisodePodcastConfig = (podcastOrKey) => {
  const season = getDisplayGroupEpisodeSeason(podcastOrKey);
  return season ? { ...season, enabled: true, persistence: "supabase", episodeSources: [season.source] } : null;
};
const getEpisodeRatingContext = new Function("state", "getEpisodeKey", "getDisplayGroupEpisodeSeason", "getAppleSeasonEpisodeNumber", "getDisplayGroupSeasonIdentityKey", "getEpisodePodcastConfig", "normalizeText", "getEpisodePodcastKey", `
  ${extractFunction("getEpisodeRatingContext")}
  return getEpisodeRatingContext;
`)(state, episodeKey, getDisplayGroupEpisodeSeason, getAppleSeasonEpisodeNumber,
  getDisplayGroupSeasonIdentityKey, getEpisodePodcastConfig,
  normalizeText, (key) => normalizeText(key));

const profileEpisode = { ...rows.find((row) => row.id === "apple-s6-e3"), title: "Afsnit 3" };
const profileContext = getEpisodeRatingContext(profileEpisode);
assert.equal(profileContext.podcastKey, "display-season:kirsten-ringer-til-rasmus:6");
assert.equal(profileContext.seasonNumber, 6);
assert.equal(profileContext.canSyncParent, true);
const ambiguousProfileContext = getEpisodeRatingContext({ id: "ambiguous", podcast_key: group.episodeConfig.databasePodcastKey, source: group.episodeConfig.source, title: "Afsnit 12", description: "Afsnit 12.", metadata: { episodeNumber: 37 } });
assert.equal(ambiguousProfileContext.canSyncParent, false, "profile rows without validated Apple season metadata cannot sync a parent rating");

const statesByKey = new Map();
for (const season of [4, 5, 6]) {
  const key = getDisplayGroupSeasonIdentityKey(group, season);
  statesByKey.set(key, {
    items: rows.filter((row) => getAppleSeasonEpisodeNumber(row)?.season === season).map((row) => ({ ...row, _displayGroupEpisodeStateKey: key })),
    searchResults: [],
    userRatingsById: {},
    parentUserRatingsById: {},
    parentEpisodesById: {},
    parentUserRatingsResolvedFor: "",
    statsById: {}
  });
  state.podcastEpisodesByKey[key] = statesByKey.get(key);
}

const summaryStates = new Map();
for (const season of [4, 5, 6]) {
  const key = getDisplayGroupSeasonIdentityKey(group, season);
  summaryStates.set(key, {
    items: rows.filter((row) => getAppleSeasonEpisodeNumber(row)?.season === season),
    searchResults: [],
    userRatingsById: Object.fromEntries(rows.map((row, index) => [row.id, 5 + index / 10])),
    parentUserRatingsById: Object.fromEntries(rows.map((row, index) => [row.id, 5 + index / 10])),
    parentEpisodesById: Object.fromEntries(rows.map((row) => [row.id, row])),
    parentUserRatingsResolvedFor: "rating-test-user"
  });
}
const ratingSummaryState = { authUser: { id: "rating-test-user" }, profileEpisodeRatings: { episodeMetaById: {} } };
const getRatingSummary = new Function("state", "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeKey", "getGenstartEpisodeById", "episodeMatchesPodcastSourceBoundary", "parseNumber", "getAppleSeasonEpisodeNumber", `${extractFunction("getPodcastEpisodeUserRatingSummary")}\nreturn getPodcastEpisodeUserRatingSummary;`)(
  ratingSummaryState,
  (key) => summaryStates.get(normalizeText(key)),
  getEpisodePodcastConfig,
  episodeKey,
  () => null,
  (episode, config) => config.episodeSources.includes(episode.source),
  (value) => value === null || value === undefined ? null : Number(value),
  getAppleSeasonEpisodeNumber
);
for (const season of [4, 5, 6]) {
  const key = getDisplayGroupSeasonIdentityKey(group, season);
  const summary = getRatingSummary(key);
  assert.equal(summary.count, rows.filter((row) => getAppleSeasonEpisodeNumber(row)?.season === season).length, `season ${season} summary excludes the other season's ratings`);
}

const querySeasonKey = getDisplayGroupSeasonIdentityKey(group, 6);
const queryState = { ...state, podcastEpisodesByKey: { [querySeasonKey]: { items: [], searchResults: [], userRatingsById: {}, parentUserRatingsById: {}, parentEpisodesById: {}, parentUserRatingsResolvedFor: "", parentUserRatingsLoading: false } } };
const allQueryRows = rows.map((row, index) => ({ episode_id: row.id, rating: 5 + index / 10, podcast_episodes: row }));
const queryStateInstance = {
  ...queryState,
  supabase: { from() { return { select() { return this; }, eq() { return this; }, in() { return this; }, then(resolve) { return Promise.resolve({ data: allQueryRows, error: null }).then(resolve); } }; } }
};
const fetchParentRatings = new Function("state", "getUserScopedRequestContext", "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeDatabasePodcastKey", "applyPodcastEpisodeSourceBoundary", "isCurrentUserScopedRequest", "normalizeText", "parseNumber", "getAppleSeasonEpisodeNumber", `${callBody("fetchPodcastEpisodeParentRatings")}\nreturn fetchPodcastEpisodeParentRatings;`)(
  queryStateInstance,
  () => ({ userId: "rating-test-user" }),
  (key) => queryStateInstance.podcastEpisodesByKey[normalizeText(key)],
  getEpisodePodcastConfig,
  (config) => config.databasePodcastKey,
  (query, config, prefix) => query.in(`${prefix}source`, config.episodeSources),
  () => true,
  normalizeText,
  (value) => value === null || value === undefined ? null : Number(value),
  getAppleSeasonEpisodeNumber
);
await fetchParentRatings(querySeasonKey);
const queriedSeasonState = queryStateInstance.podcastEpisodesByKey[querySeasonKey];
assert.deepEqual(Object.keys(queriedSeasonState.parentUserRatingsById).sort(), rows.filter((row) => getAppleSeasonEpisodeNumber(row)?.season === 6).map((row) => row.id).sort(), "parent-rating hydration stores only the exact selected season");
assert.deepEqual(Object.keys(queriedSeasonState.parentEpisodesById).sort(), Object.keys(queriedSeasonState.parentUserRatingsById).sort(), "rating metadata remains paired with the exact episode UUIDs");

const currentRatings = new Map();
const parentRatingBackups = new Map();
let parentRatingWrites = 0;
const fakeSupabase = {
  from(table) {
    if (table !== "episode_ratings") throw new Error(`Unexpected write to ${table}`);
    const query = { filters: {}, upsert(row) { currentRatings.set(row.episode_id, row.rating); return Promise.resolve({ error: null }); }, delete() { return query; }, eq(field, value) { query.filters[field] = value; if (field === "episode_id") { return { then(resolve) { currentRatings.delete(value); return Promise.resolve({ error: null }).then(resolve); } }; } return query; } };
    return query;
  }
};
const runtime = {
  state: { ...state, supabase: fakeSupabase, podcastEpisodesByKey: Object.fromEntries(statesByKey), activeEpisodeRatingContext: null, activeEpisodeRatingId: null, episodeParentRatingSyncSignatures: {}, episodeParentRatingSyncPendingKeys: new Set() },
  elements: { ratingInput: { value: "" }, ratingSaveButton: { textContent: "Gem vurdering", disabled: false }, ratingDeleteButton: { disabled: false } },
  document: { getElementById: () => null },
  window: { setTimeout: (callback) => callback() },
  console,
  normalizeText,
  parseRatingInputValue: (value) => Number(String(value).replace(",", ".")),
  normalizeRatingInputField() {}, updateRatingDialogMessage() {}, setAuthBusy() {}, setAuthMessage() {},
  getEpisodeKey: episodeKey, getEpisodeRatingContext,
  getGenstartEpisodeById: (id) => {
    const row = rows.find((episode) => episode.id === id);
    return row ? { ...row, _displayGroupEpisodeStateKey: getDisplayGroupSeasonIdentityKey(group, 4) } : null;
  },
  getEpisodePodcastKey: (key) => normalizeText(key),
  getEpisodeRatingPersistenceConfig: () => ({ persistence: "supabase" }),
  getPodcastEpisodeState: (key) => statesByKey.get(normalizeText(key)),
  getPodcastEpisodeUserRatingSummary(key) {
    const ratings = Object.values(statesByKey.get(normalizeText(key))?.userRatingsById || {}).filter((value) => value !== null && value !== undefined);
    return { count: ratings.length, average: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null };
  },
  getEpisodeParentRatingBackup: (key) => parentRatingBackups.get(normalizeText(key)) || null,
  captureEpisodeParentRatingBackup(key) {
    const ratingKey = runtime.getEpisodeParentRatingKey(key);
    const manualRating = runtime.state.userRatingsByKey[ratingKey] ?? null;
    parentRatingBackups.set(normalizeText(key), { hasManualRating: manualRating !== null, manualRating });
    return true;
  },
  clearEpisodeParentRatingBackup(key) { parentRatingBackups.delete(normalizeText(key)); }, updateLocalCommunityStatForRating() {}, invalidateExplorePersonalSnapshot() {},
  rebuildUserRanks() {}, render() {}, refreshOpenPodcastDetailSheet() {}, updatePodcastEpisodeOverviewRatingRow() {},
  updateOpenEpisodeDetailScores() {}, updatePodcastEpisodeOverview() {}, updateGenstartEpisodeSection() {}, refreshSingleEpisodeStat: async () => {},
  updateProfileEpisodeRatingAfterSave() {}, updateProfileEpisodeRatingAfterDelete() {}, updateProfileEpisodeRatingsSection() {}, ensureManualCatalogueEpisodeMapping: async () => true
};
runtime.getEpisodePodcastConfig = getEpisodePodcastConfig;
runtime.getEpisodeParentRatingKey = new Function("getEpisodePodcastConfig", "normalizeText", "resolveCanonicalPodcastId", `${extractFunction("getEpisodeParentRatingKey")}\nreturn getEpisodeParentRatingKey;`)(getEpisodePodcastConfig, normalizeText, (key) => normalizeText(key));
runtime.hasProtectedDisplayGroupSeasonRating = new Function("state", "parseNumber", `${extractFunction("hasProtectedDisplayGroupSeasonRating")}\nreturn hasProtectedDisplayGroupSeasonRating;`)(runtime.state, (value) => value === null || value === undefined ? null : Number(value));
runtime.persistEffectiveParentRating = async (key, rating) => { parentRatingWrites += 1; runtime.state.userRatingsByKey[key] = rating; };
runtime.synchronizeEpisodeDerivedParentRating = new Function("state", "getLocalEpisodePodcastKey", "getEpisodePodcastKey", "getEpisodePodcastConfig", "getEpisodeParentRatingKey", "getPodcastEpisodeUserRatingSummary", "getEpisodeParentRatingBackup", "hasProtectedDisplayGroupSeasonRating", "parseNumber", "persistEffectiveParentRating", "formatCompactRating", "clearEpisodeParentRatingBackup", "rebuildUserRanks", "render", "refreshOpenPodcastDetailSheet", `
  return async ${extractFunction("synchronizeEpisodeDerivedParentRating")};
`)(runtime.state, (key) => normalizeText(key), runtime.getEpisodePodcastKey, runtime.getEpisodePodcastConfig,
  runtime.getEpisodeParentRatingKey, runtime.getPodcastEpisodeUserRatingSummary, runtime.getEpisodeParentRatingBackup,
  runtime.hasProtectedDisplayGroupSeasonRating, (value) => value === null || value === undefined ? null : Number(value),
  runtime.persistEffectiveParentRating, (value) => String(value), runtime.clearEpisodeParentRatingBackup,
  runtime.rebuildUserRanks, runtime.render, runtime.refreshOpenPodcastDetailSheet);
runtime.finalizeSavedEpisodeRating = async ({ podcastKey, previousEffectiveParentRating }) =>
  runtime.synchronizeEpisodeDerivedParentRating(podcastKey, previousEffectiveParentRating, { refreshUi: false });
runtime.closeRatingDialog = () => { runtime.state.activeEpisodeRatingId = null; runtime.state.activeEpisodeRatingContext = null; };
vm.runInNewContext([
  `async ${extractFunction("saveActiveEpisodeRating")}`,
  `async ${extractFunction("deleteActiveEpisodeRating")}`
].join("\n"), runtime);

const immutableIdsBefore = rows.map((row) => row.id);
const parentRatingsBefore = { ...runtime.state.userRatingsByKey };
for (const season of [4, 6, 5, 4, 6, 5]) {
  const seasonKey = getDisplayGroupSeasonIdentityKey(group, season);
  const selectedEpisode = rows.find((row) => getAppleSeasonEpisodeNumber(row)?.season === season);
  assert.ok(selectedEpisode, `fixture provides a season ${season} episode`);
  const explicitContext = getEpisodeRatingContext({ ...selectedEpisode, _displayGroupEpisodeStateKey: seasonKey });
  assert.equal(explicitContext.podcastKey, seasonKey);
  runtime.state.activeEpisodeRatingContext = explicitContext;
  runtime.state.activeEpisodeRatingId = selectedEpisode.id;
  runtime.elements.ratingInput.value = "8.1";
  await runtime.saveActiveEpisodeRating();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(currentRatings.get(selectedEpisode.id), 8.1, `save targets the selected episode in season ${season}`);
  assert.deepEqual(rows.map((row) => row.id), immutableIdsBefore, "episode UUID inventory remains unchanged after save");
  assert.deepEqual(runtime.state.userRatingsByKey, parentRatingsBefore, "direct season ratings remain unchanged after episode save");

  const editContext = getEpisodeRatingContext({ ...selectedEpisode, _displayGroupEpisodeStateKey: seasonKey });
  runtime.state.activeEpisodeRatingContext = editContext;
  runtime.state.activeEpisodeRatingId = selectedEpisode.id;
  runtime.elements.ratingInput.value = "9.4";
  await runtime.saveActiveEpisodeRating();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(currentRatings.get(selectedEpisode.id), 9.4, `edit targets only the selected episode in season ${season}`);
  assert.deepEqual(rows.map((row) => row.id), immutableIdsBefore, "episode UUID inventory remains unchanged after edit");
  assert.deepEqual(runtime.state.userRatingsByKey, parentRatingsBefore, "other season ratings remain unchanged after edit");

  const deleteContext = getEpisodeRatingContext({ ...selectedEpisode, _displayGroupEpisodeStateKey: seasonKey });
  runtime.state.activeEpisodeRatingContext = deleteContext;
  runtime.state.activeEpisodeRatingId = selectedEpisode.id;
  await runtime.deleteActiveEpisodeRating();
  assert.equal(currentRatings.has(selectedEpisode.id), false, `delete removes only the selected episode rating for season ${season}`);
  assert.deepEqual(rows.map((row) => row.id), immutableIdsBefore, "episode UUID inventory remains unchanged after delete");
  assert.deepEqual(runtime.state.userRatingsByKey, parentRatingsBefore, "direct ratings for every other season remain immutable");
}
assert.equal(parentRatingWrites, 0, "episode saves and deletes cannot overwrite a directly rated season");
assert.equal(currentRatings.size, 0, "all save/edit/delete cycles leave no test episode ratings behind");

console.log("Kirsten season episode cache, profile context, save/edit/delete order, UUID immutability, and direct-rating integrity passed.");
