import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { chromium } from "playwright";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../style.css", import.meta.url), "utf8");
const desktopCss = await readFile(new URL("../desktop-episode-workspace.css", import.meta.url), "utf8");
const mobileCss = await readFile(new URL("../mobile-episode-expansion.css", import.meta.url), "utf8");
const gate = await readFile(new URL("./critical-regression-gate.mjs", import.meta.url), "utf8");
const startOf = (marker) => app.indexOf(marker);
const section = (start, end) => {
  const startIndex = startOf(start);
  const endIndex = startOf(end);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `Missing app section: ${start}`);
  return app.slice(startIndex, endIndex);
};

assert.match(gate, /Der var engang et mål.*test-der-var-engang-et-mal-episodes\.mjs/s,
  "the critical regression gate must run this focused identity/visibility test");

const coverRegistrations = JSON.parse(await readFile(new URL("../data/manual-podcast-cover-registrations.json", import.meta.url), "utf8"));
const coverManifest = JSON.parse(await readFile(new URL("../data/podcast-cover-manifest.json", import.meta.url), "utf8"));
const seriesCoverRegistration = coverRegistrations.registrations.filter((entry) => entry.podcastId === "der var engang et mal");
assert.equal(seriesCoverRegistration.length, 1, "the exact canonical series has one owner-approved cover registration");
assert.equal(seriesCoverRegistration[0].sourcePath, "assets/podcast-covers/manual-inbox/der_var_engang_et_mal_editorial.png");
assert.equal(seriesCoverRegistration[0].sourceSha256, "9807a7db699e0ba8b1b8b78ef27bd66d89a5d039711a9d3f7a352e387d960177");
assert.match(seriesCoverRegistration[0].evidence, /not an official Mediano cover/u);
const seriesCoverManifest = coverManifest.podcasts.filter((entry) => entry.podcastId === "der var engang et mal");
assert.equal(seriesCoverManifest.length, 1, "the canonical series resolves one exact-ID cover manifest entry");
assert.equal(seriesCoverManifest[0].stableKey, "der_var_engang_et_mal_user_editorial");
assert.equal(seriesCoverManifest[0].manualIntakeSourcePath, seriesCoverRegistration[0].sourcePath);
assert.equal(seriesCoverManifest[0].manualIntakeSourceChecksum, seriesCoverRegistration[0].sourceSha256);
assert.equal(seriesCoverManifest[0].variants["1400"].path, "data/covers/1400/der_var_engang_et_mal_user_editorial.png");
const historicalPeterCover = coverManifest.podcasts.find((entry) =>
  entry.appPodcastKey === "der var engang et mal af peter møller mod farum"
);
assert.match(historicalPeterCover?.originalImageUrl || "", /sparekassen-kronjylland\.jpg/u,
  "the old episode row retains its historical sponsor image reference without applying it to the series");

const context = {
  Object,
  URL,
  normalizeText: (value) => String(value ?? "").trim(),
  normalizeMatchKey: (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().trim(),
  getPodcastId: (podcast) => String(podcast?.["Podcast-ID"] || podcast?.podcastId || "").toLowerCase(),
  getLocalEpisodePodcastKey: (podcast) => String(podcast?.["Podcast-ID"] || podcast?.podcastId || "").toLowerCase(),
  getLegacyPodcastKey: () => "",
  resolvePodcastByStoredKey: () => null,
  MINIMUM_RATEABLE_EPISODE_COUNT: 2,
  MANUAL_CATALOGUE_SOURCE: "manual_catalogue_v1",
  parseNumber: (value) => value == null || value === "" ? null : Number(value),
  EPISODE_PODCAST_CONFIG: { "der var engang et mal": { dataSource: "supabase" } },
  getEpisodePodcastState: () => ({ items: [] }),
  getEpisodeWorkspaceEpisodes: () => context.episodeState,
  getEpisodeKey: (episode) => episode.id,
  getEpisodePodcastConfig: () => ({ dataSource: "supabase" }),
  getEpisodeStat: () => null,
  getEpisodeUserRating: () => null,
  getAppleSeasonEpisodeNumber: () => null,
  formatEpisodeDate: (value) => value,
  parseNumber: (value) => value == null || value === "" ? null : Number(value),
  escapeHtml: (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
  formatEpisodeOverviewScore: (value) => value === null ? "—" : String(value),
  formatUserRatingCount: (value) => `${value} vurderinger`,
  formatCompactRating: (value) => String(value),
  formatEpisodeOverviewOwnScore: (value) => value === null ? "Vurder" : String(value),
  episodeState: []
};
context.globalThis = context;
vm.runInNewContext(section("function normalizeComparable(", "function normalizeCatalogueIdentityPart("), context);

const episodesStart = startOf("const DER_VAR_ENGANG_ET_MAL_MANUAL_EPISODES");
const episodesEnd = startOf("const LOCAL_CANONICAL_CATALOGUE_ROWS");
assert.ok(episodesStart >= 0 && episodesEnd > episodesStart, "the exact Mediano source episode list is present");
vm.runInNewContext(app.slice(episodesStart, episodesEnd)
  .replace("const DER_VAR_ENGANG_ET_MAL_MANUAL_EPISODES", "globalThis.DER_VAR_ENGANG_ET_MAL_MANUAL_EPISODES"), context);

const patchStart = startOf("const LOCAL_CANONICAL_CATALOGUE_ROW_PATCHES");
const patchEnd = startOf("const MEDIANO_EPISODE_DESTINATIONS");
assert.ok(patchStart >= 0 && patchEnd > patchStart, "local catalogue patches are present");
vm.runInNewContext(app.slice(patchStart, patchEnd)
  .replace("const LOCAL_CANONICAL_CATALOGUE_ROW_PATCHES", "globalThis.LOCAL_CANONICAL_CATALOGUE_ROW_PATCHES"), context);
const seriesPatch = context.LOCAL_CANONICAL_CATALOGUE_ROW_PATCHES["der var engang et mal"];
assert.ok(seriesPatch, "the exact canonical Podcast-ID has a local episode patch");
assert.equal(context.LOCAL_CANONICAL_CATALOGUE_ROW_PATCHES["stot mediano"], undefined,
  "the umbrella Støt Mediano identity receives no episode patch");

vm.runInNewContext(section("function parseManualEpisodeEntries(", "function getManualEpisodeEditorialRating("), context);
vm.runInNewContext(section("function getOfficialMedianoEpisodeSourceUrl(", "function podcastHasManualEpisodeList("), context);
const sheetPeter = [{ title: "Der var engang et mål...af Peter Møller mod Farum" }];
const mergedEntries = context.mergeManualEpisodeEntries(seriesPatch.manualEpisodes, sheetPeter);
const expectedTitles = [
  "Der var engang et mål...af Andrés Iniesta på Stamford Bridge",
  "Der var engang et mål...af Carlos Alberto i VM-finalen",
  "Der var engang et mål...af Peter Møller mod Farum",
  "Der var engang et mål...af David Beckham mod Grækenland",
  "Der var engang et mål...der afgjorde en tysk mesterskabsgyser"
];
assert.deepEqual(Array.from(mergedEntries, (entry) => entry.title), expectedTitles,
  "the canonical sheet row and local fallback produce exactly the five verified episodes once, in release order");
assert.equal(mergedEntries[2].title, sheetPeter[0].title, "Peter Møller remains the same single catalogue episode");
assert.equal(mergedEntries[2].manualEpisodeKey || "", "", "Peter's existing manual key is not rewritten");
assert.equal(new Set(mergedEntries.map((entry) => context.normalizeMatchKey(entry.title))).size, 5,
  "episode titles are unique across catalogue and fallback sources");

const datedEntries = context.parseManualEpisodeEntries(mergedEntries);
assert.deepEqual(Array.from(datedEntries, ({ publishedAt }) => publishedAt), [
  "2025-06-29", "2025-07-06", "2025-07-13", "2025-07-20", "2025-07-27"
], "all five episode dates are ordered and verified from their official pages");
const sources = datedEntries.map((entry) => context.getOfficialMedianoEpisodeSourceUrl(entry.sourceUrl));
assert.equal(sources.filter(Boolean).length, 4, "each new episode has an official Mediano source URL");
assert.equal(sources[2], "", "Peter's historic episode source is not replaced by the patch");
assert.equal(context.getOfficialMedianoEpisodeSourceUrl("javascript:alert(1)"), "",
  "unsafe source protocols are rejected");
assert.equal(context.getOfficialMedianoEpisodeSourceUrl("https://example.com/oversigt/a"), "",
  "non-Mediano sources are rejected");
assert.ok(datedEntries.slice(0, 2).concat(datedEntries.slice(3)).every((entry) => entry.manualEpisodeKey),
  "all four new episodes have immutable, ID-safe manual episode keys");
assert.ok(datedEntries.slice(0, 2).concat(datedEntries.slice(3)).every((entry) => !entry.editorialRating),
  "none of the new episodes inherits Peter's editorial rating");

const configStart = startOf("const MEDIANO_EPISODE_DESTINATIONS");
const configEnd = startOf("const MANUAL_CATALOGUE_SOURCE");
assert.ok(configStart >= 0 && configEnd > configStart);
vm.runInNewContext(app.slice(configStart, configEnd)
  .replace("const MEDIANO_EPISODE_DESTINATIONS", "globalThis.MEDIANO_EPISODE_DESTINATIONS")
  .replace("const MEDIANO_EPISODE_PODCAST_CONFIG", "globalThis.MEDIANO_EPISODE_PODCAST_CONFIG")
  .replace("const EPISODE_PODCAST_CONFIG", "globalThis.EPISODE_PODCAST_CONFIG"), context);
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["der var engang et mal"].includeManualEpisodes, true);
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["der var engang et mal"]
  .manualEpisodeCanonicalIds["der var engang et mal af peter møller mod farum"],
"283fbea9-a29c-5104-803a-f39f2bb8b312", "Peter's historical UUID is explicitly pinned");
assert.equal(context.EPISODE_PODCAST_CONFIG["der var engang et mal"]
  .manualEpisodeCanonicalIds["der var engang et mal af peter møller mod farum"],
"283fbea9-a29c-5104-803a-f39f2bb8b312", "the runtime episode config carries Peter's historical UUID");
for (const key of ["stot mediano", "mediano superliga", "mediano business", "fodboldministeriet"]) {
  assert.notEqual(context.MEDIANO_EPISODE_PODCAST_CONFIG[key]?.includeManualEpisodes, true,
    `${key} must not receive this series' manually curated episodes`);
}

const manualBuilder = section("function getPodcastManualEpisodes(", "function resolveManualCatalogueEpisodeFromLocalRow(");
const mapPodcastSource = section("function mapPodcast(row, index)", "function isUsefulPodcast(");
assert.match(mapPodcastSource, /manualEpisodeEntries,\s*manualEpisodeEditorialRatings/u,
  "the canonical catalogue mapper retains complete manual episode metadata beside its title search index");
assert.match(manualBuilder, /podcast\?\.manualEpisodeEntries\s*\|\|/u,
  "the manual episode fallback consumes preserved metadata from mapped catalogue rows");
vm.runInNewContext(section("function getManualEpisodeEditorialRating(", "function parseManualEpisodeTitles("), context);
assert.equal(context.EPISODE_PODCAST_CONFIG["der var engang et mal"]
  .manualEpisodeCanonicalIds[context.normalizeMatchKey(expectedTitles[2])],
"283fbea9-a29c-5104-803a-f39f2bb8b312", `the normalized title key matches the runtime config: ${context.normalizeMatchKey(expectedTitles[2])}`);
assert.equal(context.getManualEpisodeCanonicalId({ "Podcast-ID": "der var engang et mal" }, expectedTitles[2]),
  "283fbea9-a29c-5104-803a-f39f2bb8b312", "the runtime canonical-ID resolver retains Peter's existing ID");
vm.runInNewContext(section("function hashStringToEightHex(", "function getPodcastManualEpisodes("), context);
vm.runInNewContext(manualBuilder, context);
const manualEpisodes = context.getPodcastManualEpisodes({
  "Podcast-ID": "der var engang et mal",
  manualEpisodeEntries: mergedEntries,
  manualEpisodeEditorialRatings: { "der var engang et mal af peter møller mod farum": 7.3 }
});
assert.equal(manualEpisodes.length, 5);
assert.equal(manualEpisodes[2].id, "283fbea9-a29c-5104-803a-f39f2bb8b312",
  "Peter Møller's existing episode UUID remains intact");
assert.equal(manualEpisodes[2].source, "manual_catalogue_v1");
assert.equal(manualEpisodes[2].manual_episode_key,
  "manual-catalogue-v1:283fbea9-a29c-5104-803a-f39f2bb8b312",
  "Peter's existing manual mapping key remains unchanged");
assert.equal(manualEpisodes[2].editorial_rating, 7.3,
  "Peter's existing editorial score remains unchanged");
assert.equal(manualEpisodes[0].published_at, "2025-06-29");
assert.equal(manualEpisodes[0].episode_url, "https://www.mediano.nu/oversigt/2025/6/27/der-var-engang-et-mlaf-andres-iniesta-p-stamford-bridge");
assert.ok(manualEpisodes.every((episode) => !("external_guid" in episode) && !("audio_url" in episode)),
  "fallback rows do not invent RSS GUIDs or playback links");
assert.equal(new Set(manualEpisodes.map((episode) => episode.id)).size, 5,
  "the five manual IDs are unique");

const remotePeter = {
  id: "283fbea9-a29c-5104-803a-f39f2bb8b312",
  external_guid: "manual_catalogue_v1:283fbea9-a29c-5104-803a-f39f2bb8b312",
  podcast_key: "der var engang et mal",
  title: expectedTitles[2],
  published_at: null,
  episode_url: "https://historic.example/peter-moller",
  editorial_rating: null,
  dataSource: "supabase"
};
const mergeEpisodes = new Function(
  "getEpisodeKey", "parseNumber", `${section("function mergeEpisodes(", "function formatEpisodeDate(")}\nreturn mergeEpisodes;`
)((episode) => episode.id, context.parseNumber);
const mergedRuntimeEpisodes = mergeEpisodes([remotePeter], manualEpisodes);
assert.equal(mergedRuntimeEpisodes.length, 5,
  "one Supabase episode plus five manual catalogue entries, including Peter's duplicate, produce five rows");
assert.equal(new Set(mergedRuntimeEpisodes.map((episode) => episode.id)).size, 5,
  "the merged episode identities remain unique");
const mergedPeter = mergedRuntimeEpisodes.find((episode) => episode.id === remotePeter.id);
assert.equal(mergedPeter.external_guid, remotePeter.external_guid, "Peter's existing GUID remains unchanged");
assert.equal(mergedPeter.published_at, null, "the view correction does not mutate Peter's Supabase publication date");
assert.equal(mergedPeter.editorial_rating, 7.3, "the existing editorial score survives the duplicate merge");

const displayConfig = {
  podcastKey: "der var engang et mal",
  manualEpisodeMappingPolicy: "require_existing"
};
const getTestEpisodePodcastConfig = (podcast) => podcast?.["Podcast-ID"] === "der var engang et mal"
  ? displayConfig
  : { podcastKey: "another podcast", dataSource: "supabase" };
const getTestConfiguredManualEpisodes = () => manualEpisodes;
const getTestEpisodeKey = (episode) => episode.id;
const getTestEpisodeState = () => ({ items: mergedRuntimeEpisodes, searchTerm: "", workspaceVisibleCount: 100 });
const getTestComparable = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
const overviewStart = startOf("function getDerVarEngangEpisodeOverviewRows(");
const overviewEnd = startOf("function filterEpisodesToConfigSeason(");
assert.ok(overviewStart >= 0 && overviewEnd > overviewStart, "the display-only chronology helper is present");
const overviewFunctions = new Function(
  "getEpisodePodcastConfig", "getConfiguredManualEpisodes", "getEpisodeKey", "getPodcastEpisodeState",
  "normalizeText", "getAppleSeasonEpisodeNumber", "normalizeComparable", "getVisibleGenstartEpisodes",
  "EPISODE_WORKSPACE_PAGE_SIZE",
  `${app.slice(overviewStart, overviewEnd)}\nreturn { getDerVarEngangEpisodeOverviewRows, getEpisodeWorkspaceEpisodes };`
)(getTestEpisodePodcastConfig, getTestConfiguredManualEpisodes, getTestEpisodeKey, getTestEpisodeState,
  context.normalizeText, () => null, getTestComparable, () => mergedRuntimeEpisodes, 100);
const seriesPodcast = { "Podcast-ID": "der var engang et mal" };
const displayRows = overviewFunctions.getEpisodeWorkspaceEpisodes(seriesPodcast);
assert.deepEqual(Array.from(displayRows, (episode) => episode.title), expectedTitles,
  "the overview sorts the five merged episodes by their verified catalogue dates");
assert.deepEqual(Array.from(displayRows, (episode) => episode._episodeOverviewPublishedAt || episode.published_at),
  ["2025-06-29", "2025-07-06", "2025-07-13", "2025-07-20", "2025-07-27"],
  "display dates use verified manual metadata, including Peter's NULL-dated Supabase row");
assert.equal(remotePeter.published_at, null, "display metadata never mutates the fetched Supabase object");
const anotherPodcastRows = [{ id: "second", published_at: "2025-01-01" }, { id: "first", published_at: null }];
assert.equal(overviewFunctions.getDerVarEngangEpisodeOverviewRows({ "Podcast-ID": "another podcast" }, anotherPodcastRows),
  anotherPodcastRows, "other podcasts keep their existing order and row objects");

context.episodeState = displayRows;
const rowRenderer = section("function renderPodcastEpisodeOverviewRows(", "function ensureManualPodcastEpisodeState(");
const renderPodcastEpisodeOverviewRows = new Function(
  "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeWorkspaceEpisodes", "getEpisodeKey",
  "getAppleSeasonEpisodeNumber", "formatEpisodeDate", "getEpisodeStat", "getEpisodeUserRating",
  "parseNumber", "escapeHtml", "formatEpisodeOverviewScore", "formatUserRatingCount", "EPISODE_WORKSPACE_PAGE_SIZE",
  "formatCompactRating", "formatEpisodeOverviewOwnScore", "getOfficialMedianoEpisodeSourceUrl", "isManualEpisodeRatingAvailable",
  `${rowRenderer}\nreturn renderPodcastEpisodeOverviewRows;`
)(
  () => ({ items: displayRows }), getTestEpisodePodcastConfig, () => displayRows,
  (episode) => episode.id, () => null, (value) => value, () => null, () => null,
  context.parseNumber, context.escapeHtml, context.formatEpisodeOverviewScore,
  context.formatUserRatingCount, 100, context.formatCompactRating, context.formatEpisodeOverviewOwnScore,
  context.getOfficialMedianoEpisodeSourceUrl, (episode) => episode.id === "283fbea9-a29c-5104-803a-f39f2bb8b312"
);
const rendered = renderPodcastEpisodeOverviewRows({ "Podcast-ID": "der var engang et mal" });
assert.equal((rendered.match(/data-episode-overview-rating-id=/gu) || []).length, 5,
  "all five episodes have individual rating controls");
assert.equal((rendered.match(/disabled aria-disabled="true"/gu) || []).length, 4,
  "the four new episodes visibly disable rating while their canonical mappings are absent");
assert.equal((rendered.match(/Afventer import/gu) || []).length, 4,
  "the unavailable rating controls explain that import is pending");
assert.equal((rendered.match(/class="podcast-detail-sheet__episode-source"/gu) || []).length, 4,
  "official source links appear for the four new episodes only");
for (const entry of datedEntries.filter((episode) => episode.sourceUrl)) {
  assert.ok(rendered.includes(`href="${entry.sourceUrl}"`), `official source URL is rendered: ${entry.sourceUrl}`);
}
for (const title of expectedTitles) assert.ok(rendered.includes(title), `episode is rendered: ${title}`);
for (const date of ["2025-06-29", "2025-07-06", "2025-07-13", "2025-07-20", "2025-07-27"]) {
  assert.ok(rendered.includes(`data-published-date="${date}"`), `verified date is rendered: ${date}`);
}
assert.deepEqual(Array.from(rendered.matchAll(/data-published-date="([^"]+)"/gu), (match) => match[1]),
  ["2025-06-29", "2025-07-06", "2025-07-13", "2025-07-20", "2025-07-27"],
  "rendered rows expose every verified release date in chronological order");
assert.equal((rendered.match(/Podcastlistens vurdering:/gu) || []).length, 1,
  "only Peter's existing editorial score is shown");
assert.ok(manualEpisodes.slice(0, 2).concat(manualEpisodes.slice(3)).every((episode) => episode.editorial_rating === null),
  "the four new episodes have no inherited editorial score");

const matchingIniesta = manualEpisodes.filter((episode) =>
  context.normalizeMatchKey(episode.title).includes(context.normalizeMatchKey("Iniesta"))
);
assert.equal(matchingIniesta.length, 1, "the individual episode title is searchable");

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 375, 390, 1440]) {
    const mobile = width < 768;
    const page = await browser.newPage({ viewport: { width, height: 760 }, isMobile: mobile, hasTouch: mobile });
    await page.setContent(`<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${desktopCss}\n${mobileCss}
      html,body{margin:0;max-width:100%;overflow-x:hidden}.fixture{height:90vh;overflow:auto}.fixture table{width:100%;table-layout:fixed}.fixture td{overflow-wrap:anywhere}
      </style></head><body><main class="fixture"><table class="podcast-detail-sheet__episode-table podcast-detail-sheet__episode-table--publication-date"><thead><tr><th>Udgivelsesdato</th><th>Episode</th><th>Brugere</th><th>Din vurdering</th></tr></thead><tbody>${rendered}</tbody></table><dialog id="rating"><p>Rating</p></dialog></main><script>
        let activationCount=0;
        document.querySelectorAll('[data-episode-overview-rating-id]').forEach(button=>button.addEventListener('click',()=>{activationCount++;document.querySelector('#rating').showModal()}));
        window.activationCount=()=>activationCount;
      </script></body></html>`);
    assert.equal(await page.locator("html").evaluate((node) => node.scrollWidth), width, `${width}px has no horizontal overflow`);
    assert.equal(await page.locator("[data-episode-overview-rating-id]:disabled").count(), 4, `${width}px disables the four unmapped ratings`);
    assert.equal(await page.locator("a.podcast-detail-sheet__episode-source").count(), 4, `${width}px retains all verified source links`);
    assert.ok(await page.locator(".fixture").evaluate((node) => node.scrollHeight >= node.clientHeight), `${width}px episode content can scroll`);
    const unavailable = page.locator(`[data-episode-overview-rating-id="${manualEpisodes[0].id}"]`);
    await unavailable.focus();
    assert.notEqual(await page.evaluate(() => document.activeElement?.dataset?.episodeOverviewRatingId), manualEpisodes[0].id,
      `${width}px keyboard focus skips disabled rating control`);
    if (mobile) {
      await unavailable.scrollIntoViewIfNeeded();
      const box = await unavailable.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    } else await unavailable.click({ force: true });
    assert.equal(await page.evaluate(() => window.activationCount()), 0, `${width}px click/touch cannot activate a disabled rating`);
    assert.equal(await page.locator("#rating").evaluate((node) => node.open), false, `${width}px unavailable rating never opens`);
    const available = page.locator(`[data-episode-overview-rating-id="${manualEpisodes[2].id}"]`);
    await available.focus();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.episodeOverviewRatingId), manualEpisodes[2].id,
      `${width}px existing Peter rating remains keyboard accessible`);
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.activationCount()), 1, `${width}px keyboard activation works for mapped episode`);
    assert.equal(await page.locator("#rating").evaluate((node) => node.open), true, `${width}px mapped rating opens normally`);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  status: "PASS",
  verifiedEpisodes: 5,
  displayedTitles: Array.from(displayRows, (episode) => episode.title),
  displayedDates: Array.from(displayRows, (episode) => episode._episodeOverviewPublishedAt || episode.published_at),
  officialSourceLinks: 4,
  preservedPeterId: mergedPeter.id,
  preservedPeterGuid: mergedPeter.external_guid,
  browserWidths: [320, 375, 390, 1440],
  ratingsCreated: 0
}, null, 2));
