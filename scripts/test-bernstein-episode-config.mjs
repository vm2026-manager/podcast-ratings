import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const read = (name) => readFile(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
const [app, payload, baseCss, desktopCss, mobileCss] = await Promise.all([
  read("app.js"),
  read("data/podcasts.json"),
  read("style.css"),
  read("desktop-episode-workspace.css"),
  read("mobile-episode-expansion.css")
]);
const podcast = JSON.parse(payload).rows.find((row) => row["Podcast-ID"] === "bernstein cigaretetui");
const rssEpisodeId = "9349a75d-d92b-456e-b600-fc76fa5f9d99";
const episodeTitles = Array.from({ length: 23 }, (_, index) => `${index + 1}. cigaret`);

assert.ok(podcast, "the exact Bernstein catalogue row exists");
assert.equal(Object.hasOwn(podcast, "Feed"), false, "the blank Feed field stays absent");
assert.equal(podcast.catalogue_id, "catalogue-v1-4fa58dee", "the catalogue identity is unchanged");
assert.equal(podcast["Vuring (1-10)"], "5,5", "the editorial rating is unchanged");
assert.deepEqual(podcast.manualEpisodes, episodeTitles, "all 23 catalogue episode titles remain unchanged");

const configStart = app.indexOf("const EPISODE_PODCAST_CONFIG = {");
const configEnd = app.indexOf("\n};", configStart) + 3;
assert.ok(configStart >= 0 && configEnd > configStart, "episode config exists");
const configs = new Function(
  "MEDIANO_EPISODE_PODCAST_CONFIG",
  `${app.slice(configStart, configEnd).replace("const EPISODE_PODCAST_CONFIG =", "return")}\n`
)({});
const config = configs["bernstein cigaretetui"];
const lookupConfig = () => config;
assert.deepEqual(config.episodeSources, ["sheet_bernstein_cigaretetui_rss"]);
assert.equal(config.databasePodcastKey, "bernstein cigaretetui");
assert.equal(config.persistence, "supabase");
assert.equal(config.includeManualEpisodes, true);
assert.equal(config.manualEpisodeRatingPersistence, "local");
assert.equal(config.manualEpisodeCanonicalIds["1 cigaret"], rssEpisodeId);

const normalizeText = (value) => String(value ?? "").trim();
const normalizeMatchKey = (value) => normalizeText(value).toLocaleLowerCase("da-DK")
  .replace(/[^a-z0-9æøå ]/g, " ").replace(/\s+/g, " ").trim();
const sourceFunction = (name, nextName) => {
  const functionStart = app.indexOf(`function ${name}(`);
  const asyncStart = app.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 && (functionStart < 0 || asyncStart < functionStart)
    ? asyncStart
    : functionStart;
  const nextFunction = app.indexOf(`\nfunction ${nextName}(`, start);
  const nextAsyncFunction = app.indexOf(`\nasync function ${nextName}(`, start);
  const end = [nextFunction, nextAsyncFunction].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
  assert.notEqual(start, -1, `${name} exists`);
  assert.notEqual(end, -1, `${nextName} follows ${name}`);
  return app.slice(start, end);
};
const getEpisodePodcastConfig = new Function(
  "normalizeText", "normalizeMatchKey", "getPodcastId", "getEpisodePodcastKey",
  "getDisplayGroupEpisodeSeason", "EPISODE_PODCAST_CONFIG", "EPISODE_DATABASE_KEY_ALIASES",
  `${sourceFunction("getEpisodePodcastConfig", "podcastHasEpisodeConfiguration")}\nreturn getEpisodePodcastConfig;`
)(normalizeText, normalizeMatchKey, (row) => row?.["Podcast-ID"], (row) => row?.["Podcast-ID"], () => null, configs, {});
assert.equal(getEpisodePodcastConfig(podcast).databasePodcastKey, "bernstein cigaretetui");
assert.equal(getEpisodePodcastConfig({ "Podcast-ID": "unrelated podcast", manualEpisodes: episodeTitles }), null,
  "the exact Bernstein configuration does not enable another podcast with matching catalogue titles");
const hashStringToEightHex = new Function(
  "normalizeText",
  `${sourceFunction("hashStringToEightHex", "createStableManualEpisodeUuid")}\nreturn hashStringToEightHex;`
)(normalizeText);
const createStableManualEpisodeUuid = new Function(
  "normalizeText", "hashStringToEightHex",
  `${sourceFunction("createStableManualEpisodeUuid", "createStableManualCatalogueEpisodeUuid")}\nreturn createStableManualEpisodeUuid;`
)(normalizeText, hashStringToEightHex);
const createStableManualCatalogueEpisodeUuid = new Function(
  "normalizeText", "hashStringToEightHex",
  `${sourceFunction("createStableManualCatalogueEpisodeUuid", "getPodcastManualEpisodes")}\nreturn createStableManualCatalogueEpisodeUuid;`
)(normalizeText, hashStringToEightHex);
const parseManualEpisodeEntries = new Function(
  "normalizeText",
  `${sourceFunction("parseManualEpisodeEntries", "mergeManualEpisodeEntries")}\nreturn parseManualEpisodeEntries;`
)(normalizeText);
const getManualEpisodeCanonicalId = new Function(
  "normalizeText", "normalizeMatchKey", "EPISODE_PODCAST_CONFIG", "getPodcastId",
  `${sourceFunction("getManualEpisodeCanonicalId", "parseManualEpisodeTitles")}\nreturn getManualEpisodeCanonicalId;`
)(normalizeText, normalizeMatchKey, configs, (row) => row?.["Podcast-ID"]);
const getManualEpisodeEditorialRating = new Function(
  "parseNumber", "normalizeMatchKey",
  `${sourceFunction("getManualEpisodeEditorialRating", "getManualEpisodeCanonicalId")}\nreturn getManualEpisodeEditorialRating;`
)((value) => value == null || value === "" ? null : Number(String(value).replace(",", ".")), normalizeMatchKey);
const getPodcastManualEpisodes = new Function(
  "normalizeText", "getLocalEpisodePodcastKey", "getLegacyPodcastKey", "resolvePodcastByStoredKey", "getPodcastId",
  "parseManualEpisodeEntries", "getManualEpisodeCanonicalId", "createStableManualEpisodeUuid",
  "createStableManualCatalogueEpisodeUuid", "getManualEpisodeEditorialRating", "MANUAL_CATALOGUE_SOURCE",
  `${sourceFunction("getPodcastManualEpisodes", "resolveManualCatalogueEpisodeFromLocalRow")}\nreturn getPodcastManualEpisodes;`
)(
  normalizeText, (row) => row?.["Podcast-ID"], () => "", () => null, (row) => row?.["Podcast-ID"],
  parseManualEpisodeEntries, getManualEpisodeCanonicalId, createStableManualEpisodeUuid,
  createStableManualCatalogueEpisodeUuid, getManualEpisodeEditorialRating, "manual_catalogue_v1"
);
const manualEpisodes = getPodcastManualEpisodes(podcast);
assert.equal(manualEpisodes.length, 23, "the app creates one rateable entry for each catalogue title");
assert.equal(manualEpisodes[0].id, rssEpisodeId, "1. cigaret maps to the existing RSS UUID");
assert.equal(manualEpisodes.slice(1).some((episode) => episode.id === rssEpisodeId), false);
assert.equal(new Set(manualEpisodes.slice(1).map((episode) => episode.id)).size, 22, "episodes 2–23 get distinct stable identities");
assert.equal(getManualEpisodeCanonicalId({ ...podcast, "Podcast-ID": "unrelated podcast" }, "1. cigaret"), "",
  "the canonical ID is not inferred for an unrelated podcast with the same title");

const state = { manualCanonicalEpisodeMappings: new Map() };
const getEpisodeKey = new Function(
  "state", "normalizeText",
  `${sourceFunction("getEpisodeKey", "mergeEpisodes")}\nreturn getEpisodeKey;`
)(state, normalizeText);
const parseNumber = (value) => value == null || value === "" ? null : Number(value);
const mergeEpisodes = new Function(
  "getEpisodeKey", "parseNumber",
  `${sourceFunction("mergeEpisodes", "formatEpisodeDate")}\nreturn mergeEpisodes;`
)(getEpisodeKey, parseNumber);
const rssEpisode = {
  id: rssEpisodeId,
  podcast_key: "bernstein cigaretetui",
  title: "1. cigaret",
  source: "sheet_bernstein_cigaretetui_rss",
  dataSource: "supabase",
  is_active: true,
  communityRating: 4.25,
  userRating: 7
};
const merged = mergeEpisodes([rssEpisode], manualEpisodes);
assert.equal(merged.length, 23, "one RSS episode and 22 manual titles produce exactly 23 episodes");
assert.equal(merged.filter((episode) => episode.title === "1. cigaret").length, 1, "1. cigaret is not duplicated");
assert.equal(merged[0].id, rssEpisodeId, "the RSS UUID remains canonical after the merge");
assert.equal(merged[0].source, "sheet_bernstein_cigaretetui_rss", "the historical RSS provenance remains intact");
assert.equal(merged[0].communityRating, 4.25, "community episode data is retained");
assert.equal(merged[0].userRating, 7, "existing episode user data is retained");
const getEpisodeRatingPersistenceConfig = new Function(
  "state", "normalizeText", "getEpisodePodcastConfig", "getEpisodePodcastKey",
  `${sourceFunction("getEpisodeRatingPersistenceConfig", "usesLocalEpisodePersistence")}\nreturn getEpisodeRatingPersistenceConfig;`
)(state, normalizeText, lookupConfig, (key) => key);
state.manualCanonicalEpisodeMappings.set(manualEpisodes[1].manual_episode_key, {
  episodeId: "must-not-be-used-for-bernstein",
  canonicalSource: "manual_catalogue_v1"
});
assert.equal(getEpisodeRatingPersistenceConfig("bernstein cigaretetui", manualEpisodes[1]).persistence, "local",
  "even a pre-existing mapping cannot switch Bernstein manual episodes to Supabase writes");
state.manualCanonicalEpisodeMappings.delete(manualEpisodes[1].manual_episode_key);

// Load using the production query path and a read-only Supabase builder.
const queryTables = [];
const queryMethods = [];
const query = {
  from(table) { queryTables.push(table); return this; },
  select() { queryMethods.push("select"); return this; },
  eq() { queryMethods.push("eq"); return this; },
  in(column, values) { queryMethods.push(`in:${column}:${values.join(",")}`); return this; },
  order() { queryMethods.push("order"); return this; },
  range() { return Promise.resolve({ data: [rssEpisode], error: null, count: 1 }); }
};
const episodeState = {
  items: [], searchResults: [], loading: false, loadingMore: false, error: "",
  remoteLoadedCount: 0, totalCount: null, hasMore: false, fetchedAt: 0,
  eligibilityResolved: false, userRatingsById: {}, statsById: {}, workspaceVisibleCount: 30
};
const loaderState = { activePodcastDetailKey: "bernstein cigaretetui", supabase: query, manualCanonicalEpisodeMappings: new Map() };
const fetchGenstartEpisodes = new Function(
  "state", "normalizeText", "getEpisodePodcastConfig", "getPodcastEpisodeState", "getEpisodeDatabasePodcastKey",
  "applyPodcastEpisodeSourceBoundary", "orderPodcastEpisodes", "EPISODE_PAGE_SIZE",
  "getRateablePodcastEpisodes", "filterEpisodesToConfigSeason", "getConfiguredManualEpisodes", "hydrateLocalEpisodeRatingState",
  "refreshManualEpisodeRatingData", "mergeEpisodes", "fetchEpisodeRatingMetaForEpisodes",
  "updateGenstartEpisodeSection", "updateOpenEpisodeDetailScores", "append", "console",
  `${sourceFunction("fetchGenstartEpisodes", "searchGenstartEpisodes")}\nreturn fetchGenstartEpisodes;`
)(
  loaderState, normalizeText, lookupConfig, () => episodeState, () => config.databasePodcastKey,
  (builder, cfg) => cfg.episodeSources?.length ? builder.in("source", cfg.episodeSources) : builder,
  (builder) => builder.order("published_at", { ascending: false }), 50,
  (episodes) => episodes.filter((episode) => episode.is_active !== false), (episodes) => episodes,
  () => manualEpisodes, (key, episodes) => { episodeState.hydratedLocalIds = episodes.map((episode) => episode.id); },
  () => { throw new Error("Bernstein must not resolve or create manual episode mappings"); },
  mergeEpisodes, async () => {}, () => {}, () => {}, false, console
);
await fetchGenstartEpisodes();
assert.deepEqual(queryTables, ["podcast_episodes"], "episode loading makes only the existing read query");
assert.ok(queryMethods.includes("select") && queryMethods.includes("eq") && queryMethods.includes("in:source:sheet_bernstein_cigaretetui_rss"),
  "the existing query is scoped to the exact podcast and RSS source");
assert.equal(episodeState.items.length, 23, "the loaded episode list contains all 23 titles");
assert.equal(episodeState.items.filter((episode) => episode.id === rssEpisodeId).length, 1);
assert.equal(episodeState.hydratedLocalIds.length, 22, "only episodes 2–23 use local rating hydration");
assert.equal(episodeState.hydratedLocalIds.includes(rssEpisodeId), false, "the canonical RSS episode never receives manual local rating state");
assert.equal(queryMethods.some((method) => /insert|upsert|update|delete|rpc/i.test(method)), false,
  "episode load performs no Supabase write or RPC");

// Rating summary keeps local manual ratings in the lock after the parent query resolves.
const localEpisode = manualEpisodes[1];
episodeState.userRatingsById[localEpisode.id] = 8;
episodeState.userRatingsById[rssEpisodeId] = 7;
episodeState.parentUserRatingsById = { [rssEpisodeId]: 7 };
episodeState.parentUserRatingsResolvedFor = "user-1";
episodeState.parentEpisodesById = { [rssEpisodeId]: rssEpisode };
const ratingState = {
  authUser: { id: "user-1" },
  manualCanonicalEpisodeMappings: new Map(),
  profileEpisodeRatings: { episodeMetaById: {} }
};
const getPodcastEpisodeUserRatingSummary = new Function(
  "state", "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeKey", "normalizeText",
  "getGenstartEpisodeById", "episodeMatchesPodcastSourceBoundary", "parseNumber",
  `${sourceFunction("getPodcastEpisodeUserRatingSummary", "fetchEpisodeStatsForIds")}\nreturn getPodcastEpisodeUserRatingSummary;`
)(
  ratingState, () => episodeState, lookupConfig, getEpisodeKey, normalizeText,
  () => null, () => true, parseNumber
);
assert.deepEqual(getPodcastEpisodeUserRatingSummary("bernstein cigaretetui"), { count: 2, average: 7.5 },
  "parent-rating lock includes locally rated manual episodes alongside canonical RSS ratings");
assert.match(app, /manualEpisodeRatingPersistence === "local"\s*\|\|\s*\(await ensureManualCatalogueEpisodeMapping\(episode\)\)/u,
  "manual rating save bypasses automatic Supabase mapping only for the explicit local policy");

// Exercise the actual episode row renderer and responsive styles at required widths.
const renderStart = app.indexOf("function renderPodcastEpisodeOverviewRows(podcast)");
const renderEnd = app.indexOf("\nfunction ensureManualPodcastEpisodeState", renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, "episode row renderer exists");
const renderEpisodeRows = new Function(
  "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeWorkspaceEpisodes", "getEpisodeKey",
  "getAppleSeasonEpisodeNumber", "formatEpisodeDate", "getEpisodeStat", "getEpisodeUserRating",
  "parseNumber", "escapeHtml", "formatEpisodeOverviewScore", "formatUserRatingCount",
  "formatCompactRating", "formatEpisodeOverviewOwnScore",
  `${app.slice(renderStart, renderEnd)}\nreturn renderPodcastEpisodeOverviewRows;`
)(
  () => episodeState, lookupConfig, () => episodeState.items, getEpisodeKey,
  () => null, () => "", () => null, () => null, parseNumber,
  (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  (value) => `${value ?? "—"} <small>/10</small>`, () => "", (value) => String(value),
  (value) => value === null ? "Vurder" : `${value} <small>/10</small>`
);
const renderedRows = renderEpisodeRows(podcast);
assert.equal((renderedRows.match(/<tr class=/g) || []).length, 23, "renderer displays all episodes");
assert.equal((renderedRows.match(/data-episode-overview-rating-id=/g) || []).length, 23,
  "every episode has its rating button");
assert.equal((renderedRows.match(new RegExp(`data-episode-overview-rating-id="${rssEpisodeId}"`, "g")) || []).length, 1,
  "only one rating button targets the canonical 1. cigaret UUID");

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(`<!doctype html><html><head><style>${baseCss}\n${desktopCss}\n${mobileCss}</style></head>
      <body><div id="podcastDetailSheet" class="is-episode-workspace"><main class="podcast-detail-sheet__content">
        <section class="podcast-detail-sheet__episode-overview"><div class="podcast-detail-sheet__episode-table-wrap">
          <table class="podcast-detail-sheet__episode-table"><thead><tr><th>#</th><th>Episode</th><th>Brugere</th><th>Din vurdering</th></tr></thead><tbody>${renderedRows}</tbody></table>
        </div></section><dialog id="ratingDialog"><p id="ratingTitle"></p><button id="closeRating" type="button">Luk</button></dialog>
      </main></div><script>
        document.querySelectorAll('[data-episode-overview-rating-id]').forEach((button) => button.addEventListener('click', () => {
          document.querySelector('#ratingTitle').textContent = button.getAttribute('aria-label');
          document.querySelector('#ratingDialog').showModal();
        }));
        document.querySelector('#closeRating').addEventListener('click', () => document.querySelector('#ratingDialog').close());
      </script></body></html>`);
    assert.equal(await page.locator("tbody tr").count(), 23, `${width}px displays every episode`);
    assert.equal(await page.locator("[data-episode-overview-rating-id]").count(), 23, `${width}px has every rating button`);
    assert.equal(await page.locator("html").evaluate((element) => element.scrollWidth), width,
      `${width}px has no horizontal document overflow`);
    await page.locator(`[data-episode-overview-rating-id="${manualEpisodes[22].id}"]`).click();
    assert.equal(await page.locator("#ratingDialog").evaluate((dialog) => dialog.open), true,
      `${width}px opens the episode rating dialog`);
    assert.match(await page.locator("#ratingTitle").textContent(), /23\. cigaret/u);
    await page.locator("#closeRating").click();
    assert.equal(await page.locator("#ratingDialog").evaluate((dialog) => dialog.open), false,
      `${width}px closes the episode rating dialog`);
    await page.close();
  }
} finally {
  await browser.close();
}

assert.match(await read("index.html"), /app\.js\?v=[^"'\s]+/u);
console.log("Bernstein episode config, identity, no-write, parent lock, and responsive regressions passed.");
