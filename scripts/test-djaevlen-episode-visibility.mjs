import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const [app, catalogue, registry, css, desktopCss, mobileCss] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8").then((text) => JSON.parse(text).rows),
  readFile(new URL("../data/auto-discovered-djaevlen.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../style.css", import.meta.url), "utf8"),
  readFile(new URL("../desktop-episode-workspace.css", import.meta.url), "utf8"),
  readFile(new URL("../mobile-episode-expansion.css", import.meta.url), "utf8")
]);

function extractFunction(name, nextNames = []) {
  const starts = [`function ${name}(`, `async function ${name}(`]
    .map((prefix) => app.indexOf(prefix))
    .filter((index) => index >= 0);
  const start = Math.min(...starts);
  assert.ok(Number.isFinite(start), `${name} exists`);
  const ends = ["function ", "async function "]
    .flatMap((prefix) => {
      const values = [];
      let cursor = start + 1;
      while (true) {
        const index = app.indexOf(`\n${prefix}`, cursor);
        if (index < 0) break;
        if (nextNames.some((next) => app.startsWith(`\n${prefix}${next}(`, index))) values.push(index);
        cursor = index + 2;
      }
      return values;
    })
    .sort((a, b) => a - b);
  const nearestAnyFunction = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)]
    .filter((index) => index >= 0).sort((a, b) => a - b)[0];
  const end = ends[0] ?? nearestAnyFunction ?? app.length;
  return app.slice(start, end);
}

const normalizeText = (value) => String(value ?? "").trim();
const normalizeMatchKey = (value) => normalizeText(value).toLocaleLowerCase("da-DK");
const configDeclarationStart = app.indexOf("const EPISODE_PODCAST_CONFIG = {");
const configDeclarationEnd = app.indexOf("\n};", configDeclarationStart) + 3;
assert.ok(configDeclarationStart >= 0 && configDeclarationEnd > configDeclarationStart);
const configs = new Function("MEDIANO_EPISODE_PODCAST_CONFIG", `${app.slice(configDeclarationStart, configDeclarationEnd).replace("const EPISODE_PODCAST_CONFIG =", "return")}\n`)({});
const canonical = (id) => catalogue.find((row) => row["Podcast-ID"] === id);
const isdalen = canonical("djaevlen-auto-v1-1139735b");
const dræberurten = canonical("dræberurten");
assert.ok(isdalen, "canonical Kvinden i Isdalen catalogue row exists");
assert.ok(dræberurten, "canonical Dræberurten catalogue row exists");
assert.equal(registry.records.find((record) => record.title === "Kvinden i Isdalen")?.podcast_id, isdalen["Podcast-ID"]);
assert.equal(registry.records.find((record) => record.title === "Dræberurten")?.podcast_id, "dræberurten");

const getPodcastId = (podcast) => normalizeText(podcast?.["Podcast-ID"] ?? podcast?.podcastId ?? podcast?.id);
const getEpisodePodcastKey = (value) => typeof value === "object" ? getPodcastId(value) : normalizeText(value);
const resolvePodcastByStoredKey = (key) => catalogue.find((row) => row["Podcast-ID"] === key) ?? null;
const getConfig = new Function(
  "normalizeText", "normalizeMatchKey", "getPodcastId", "getEpisodePodcastKey", "getDisplayGroupEpisodeSeason",
  "EPISODE_PODCAST_CONFIG", "EPISODE_DATABASE_KEY_ALIASES", "resolvePodcastByStoredKey",
  `${extractFunction("getEpisodePodcastConfig", ["podcastHasEpisodeConfiguration"])}\nreturn getEpisodePodcastConfig;`
)(normalizeText, normalizeMatchKey, getPodcastId, getEpisodePodcastKey, () => null, configs, {}, resolvePodcastByStoredKey);
const supportsEpisodes = new Function(
  "podcastHasEpisodeConfiguration", extractFunction("podcastSupportsEpisodes", ["getEpisodePodcastDisplayName"]) + "\nreturn podcastSupportsEpisodes;"
)(() => true);

for (const [label, row] of [["Kvinden i Isdalen", isdalen], ["Dræberurten", dræberurten]]) {
  const config = getConfig(row);
  assert.equal(config.enabled, true, `${label} enables its episode view`);
  assert.equal(config.persistence, "supabase", `${label} uses the existing Supabase read/rating path`);
  assert.equal(config.databasePodcastKey, row["Podcast-ID"], `${label} keeps its canonical database podcast key`);
  assert.deepEqual(config.episodeSources, ["dr_lyd_djaevlen_full"], `${label} reads only the full DR Lyd import`);
  assert.equal(config.includeManualEpisodes, false, `${label} does not synthesize manual catalogue episodes`);
  assert.equal(supportsEpisodes(row), true, `${label} is available to logged-out and logged-in detail UI`);
}
assert.equal(getConfig({ ...isdalen, manualEpisodes: ["Manual A", "Manual B"] }).includeManualEpisodes, false,
  "an explicit false protects manual episode identities on a canonical auto-discovered child");

const futureChild = { "Podcast-ID": "djaevlen-auto-v1-cafebabe", title: "Future verified child", Hovedserie: "Djævlen i detaljen" };
assert.equal(getConfig(futureChild)?.episodeSources?.[0], "dr_lyd_djaevlen_full",
  "future records with the immutable auto-discovery ID format receive support without a new allowlist edit");
assert.equal(getConfig({ ...futureChild, Hovedserie: "Other series" }), null,
  "a generated-looking ID outside Djævlen stays disabled");
assert.equal(getConfig({ ...futureChild, "Podcast-ID": "djaevlen-auto-v1-not-a-hash" }), null,
  "malformed generated IDs stay disabled");
for (const row of catalogue.filter((item) => item.Hovedserie === "Djævlen i detaljen")) {
  if (row["Podcast-ID"] === "dræberurten" || /^djaevlen-auto-v1-[a-f0-9]{8}$/i.test(row["Podcast-ID"] || "")) continue;
  assert.equal(getConfig(row), null, `historical/manual Djævlen row ${row["Podcast-ID"]} stays disabled`);
}
const bakspejl = { "Podcast-ID": "existing-bakspejl-child", title: "Existing Bakspejl child", Hovedserie: "Bakspejl", manualEpisodes: ["A", "B"] };
assert.equal(getConfig(bakspejl)?.includeManualEpisodes, true, "existing Bakspejl automatic episode configuration is preserved");
assert.equal(getConfig({ "Podcast-ID": "unrelated-id", title: "Kvinden i Isdalen", Hovedserie: "Other series" }), null,
  "a matching title alone cannot enable episode support");
assert.equal(getConfig({ ...isdalen, "Podcast-ID": "other-id" }), null,
  "changing the canonical ID cannot inherit the verified child episode route");
assert.equal(configs["bernstein cigaretetui"].includeManualEpisodes, true,
  "an existing explicit episode configuration is retained");

const sourceBoundary = new Function(`${extractFunction("applyPodcastEpisodeSourceBoundary", ["episodeMatchesPodcastSourceBoundary"])}\nreturn applyPodcastEpisodeSourceBoundary;`)();
const requestedSources = [];
const boundaryProbe = { in(column, values) { requestedSources.push([column, values]); return this; } };
assert.strictEqual(sourceBoundary(boundaryProbe, getConfig(isdalen)), boundaryProbe);
assert.deepEqual(requestedSources, [["source", ["dr_lyd_djaevlen_full"]]], "read query applies the exact full-feed source boundary");

const sourceRows = [
  { id: "190c03fb-ef6d-4315-b958-ef0c0cb57dc1", podcast_key: isdalen["Podcast-ID"], title: "Kvinden i Isdalen 1:5 - Et brændt lig", external_guid: "16122702642", source: "dr_lyd_djaevlen_full", is_active: true, duration_seconds: 1481 },
  { id: "6a9b97bb-8f33-4435-88c5-91b755c02c14", podcast_key: isdalen["Podcast-ID"], title: "Kvinden i Isdalen 2:5 - De mange ansigter", external_guid: "16122702643", source: "dr_lyd_djaevlen_full", is_active: true, duration_seconds: 1363 },
  { id: "teaser", podcast_key: isdalen["Podcast-ID"], title: "Teaser: Kvinden i Isdalen", external_guid: "16122692742", source: "sheet_danmarks_vaerste_massemorder_rss", is_active: false, duration_seconds: 171 }
];
const getPodcastEpisodeState = (() => {
  const states = new Map();
  return (value) => {
    const key = typeof value === "object" ? getPodcastId(value) : normalizeText(value);
    if (!states.has(key)) states.set(key, {
      items: [], loading: false, loadingMore: false, error: "", remoteLoadedCount: 0,
      totalCount: null, hasMore: false, fetchedAt: 0, eligibilityResolved: false,
      searchResults: [], searchTerm: "", userRatingsById: {}, statsById: {}, workspaceVisibleCount: 30
    });
    return states.get(key);
  };
})();
const queryAudit = [];
let queryResult = { data: sourceRows.filter((row) => row.podcast_key === isdalen["Podcast-ID"] && row.source === "dr_lyd_djaevlen_full" && row.is_active), error: null, count: 2 };
const supabase = {
  from(table) { queryAudit.push(["from", table]); return this; },
  select(fields, options) { queryAudit.push(["select", fields, options]); return this; },
  eq(column, value) { queryAudit.push(["eq", column, value]); return this; },
  in(column, values) { queryAudit.push(["in", column, values]); this.allowedSources = values; return this; },
  order(column, options) { queryAudit.push(["order", column, options]); return this; },
  range() { return Promise.resolve(queryResult); }
};
const state = { activePodcastDetailKey: isdalen["Podcast-ID"], supabase, podcastEpisodesByKey: {}, manualCanonicalEpisodeMappings: new Map() };
const isRateable = new Function("normalizeText", `${extractFunction("isRateablePodcastEpisode", ["getRateablePodcastEpisodes"])}\nreturn isRateablePodcastEpisode;`)(normalizeText);
const getRateable = new Function("isRateablePodcastEpisode", `${extractFunction("getRateablePodcastEpisodes", ["getDefaultEpisodePodcastKey"])}\nreturn getRateablePodcastEpisodes;`)(isRateable);
const order = (query) => query.order("published_at", { ascending: false });
const fetchEpisodes = new Function(
  "state", "normalizeText", "getEpisodePodcastConfig", "getPodcastEpisodeState", "getEpisodeDatabasePodcastKey",
  "applyPodcastEpisodeSourceBoundary", "orderPodcastEpisodes", "EPISODE_PAGE_SIZE", "getRateablePodcastEpisodes",
  "filterEpisodesToConfigSeason", "getConfiguredManualEpisodes", "hydrateLocalEpisodeRatingState",
  "refreshManualEpisodeRatingData", "mergeEpisodes", "fetchEpisodeRatingMetaForEpisodes", "updateGenstartEpisodeSection",
  "updateOpenPodcastDetailScores", "updateOpenEpisodeDetailScores", "console",
  `${extractFunction("fetchGenstartEpisodes", ["searchGenstartEpisodes"])}\nreturn fetchGenstartEpisodes;`
)(state, normalizeText, getConfig, getPodcastEpisodeState, (config) => config.databasePodcastKey, sourceBoundary,
  order, 50, getRateable, (rows) => rows, () => [], () => {}, async () => {}, (left, right) => [...left, ...right],
  async () => {}, () => {}, () => {}, () => {}, { error() {} });
await fetchEpisodes();
assert.deepEqual(getPodcastEpisodeState(isdalen).items.map((episode) => episode.id), [sourceRows[0].id, sourceRows[1].id],
  "active full episodes load while inactive RSS teasers remain non-rateable");
assert.ok(queryAudit.some((entry) => entry[0] === "eq" && entry[1] === "podcast_key" && entry[2] === isdalen["Podcast-ID"]));
assert.ok(queryAudit.some((entry) => entry[0] === "in" && entry[1] === "source" && entry[2][0] === "dr_lyd_djaevlen_full"));
assert.equal(queryAudit.some((entry) => /insert|upsert|update|delete|rpc/i.test(entry[0])), false,
  "episode discovery view executes no database writes");
const loadedState = getPodcastEpisodeState(isdalen);
queryResult = { data: [], error: null, count: 0 };
await fetchEpisodes();
assert.deepEqual(loadedState.items, [], "an empty response produces an empty episode view without synthetic rows");
assert.equal(loadedState.error, "", "an empty response is not presented as a failure");
queryResult = { data: null, error: new Error("read failed"), count: null };
await fetchEpisodes();
assert.equal(loadedState.error, "Episoderne kunne ikke hentes lige nu.", "query failures reach the established visible error state");

// Exercise the production row renderer and stylesheet at phone and desktop widths.
const episodeState = loadedState;
episodeState.items = sourceRows.slice(0, 2);
episodeState.workspaceVisibleCount = 30;
const renderRowsStart = app.indexOf("function renderPodcastEpisodeOverviewRows(podcast)");
const renderRowsEnd = app.indexOf("\nfunction ensureManualPodcastEpisodeState", renderRowsStart);
assert.ok(renderRowsStart >= 0 && renderRowsEnd > renderRowsStart, "episode-row renderer exists");
const renderRows = new Function(
  "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeWorkspaceEpisodes", "getEpisodeKey",
  "getAppleSeasonEpisodeNumber", "formatEpisodeDate", "getEpisodeStat", "getEpisodeUserRating", "parseNumber",
  "escapeHtml", "formatEpisodeOverviewScore", "formatUserRatingCount", "formatCompactRating", "formatEpisodeOverviewOwnScore",
  "getOfficialMedianoEpisodeSourceUrl", "isManualEpisodeRatingAvailable",
  `${app.slice(renderRowsStart, renderRowsEnd)}\nreturn renderPodcastEpisodeOverviewRows;`
)(getPodcastEpisodeState, getConfig, () => episodeState.items, (episode) => episode.id, () => null, () => "",
  () => null, () => null, Number, (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  (value) => `${value ?? "—"} <small>/10</small>`, () => "", String, (value) => value === null ? "Vurder" : `${value} <small>/10</small>`,
  () => "", () => true);
const rows = renderRows(isdalen);
assert.equal((rows.match(/<tr class=/g) || []).length, 2, "both verified episodes have stable rating rows");
assert.equal((rows.match(/data-episode-overview-rating-id=/g) || []).length, 2, "both episodes expose rating controls");
assert.doesNotMatch(rows, /teaser/i, "inactive teaser titles are absent from the rateable table");

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 375, 390, 1440]) {
    const mobile = width < 768;
    const page = await browser.newPage({ viewport: { width, height: 760 }, isMobile: mobile, hasTouch: mobile });
    await page.setContent(`<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${desktopCss}\n${mobileCss}
      .test-sheet{height:min(620px,90vh);width:min(900px,94vw);overflow:hidden;border:1px solid} .test-content{height:100%;overflow:auto}
      .test-rating{max-width:min(92vw,360px)} .test-cover{width:72px;height:72px}
    </style></head><body><button id="open" type="button">Vurder episoder</button>
      <section id="sheet" class="test-sheet is-episode-workspace" hidden><main class="test-content" data-podcast-detail-content>
        <section class="podcast-detail-sheet__episode-overview" data-podcast-episode-overview>
          <div class="podcast-detail-sheet__episode-overview-toolbar"><button type="button" data-back>Tilbage</button><h2>Episoder</h2></div>
          <div class="podcast-detail-sheet__episode-mobile-column-header"><p>2 episoder</p><span>Din vurdering</span></div>
          <div class="podcast-detail-sheet__episode-table-wrap"><table class="podcast-detail-sheet__episode-table"><thead><tr><th>Udgivelse</th><th>Episode</th><th>Brugere</th><th>Din vurdering</th></tr></thead><tbody>${rows}</tbody></table></div>
        </section></main></section><dialog id="rating" class="test-rating"><p id="rating-title"></p><button type="button" id="save">Gem vurdering</button><button type="button" id="close">Luk</button></dialog>
      <script>
        const open=document.querySelector('#open'), sheet=document.querySelector('#sheet'), rating=document.querySelector('#rating');
        open.addEventListener('click',()=>{sheet.hidden=false; sheet.querySelector('[data-back]').focus()});
        sheet.querySelector('[data-back]').addEventListener('click',()=>{sheet.hidden=true;open.focus()});
        sheet.querySelectorAll('[data-episode-overview-rating-id]').forEach(button=>button.addEventListener('click',()=>{rating.dataset.episodeId=button.dataset.episodeOverviewRatingId;document.querySelector('#rating-title').textContent=button.getAttribute('aria-label');rating.showModal()}));
        document.querySelector('#save').addEventListener('click',()=>{rating.dataset.saved=rating.dataset.episodeId;rating.close()});
        document.querySelector('#close').addEventListener('click',()=>rating.close());
      </script></body></html>`);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "open", `${width}px keyboard reaches episode entry`);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#sheet").isVisible(), true, `${width}px episode entry opens`);
    assert.equal(await page.locator("tbody tr").count(), 2, `${width}px shows both episodes`);
    assert.equal(await page.evaluate(() => document.activeElement.matches("[data-back]")), true, `${width}px moves focus into detail view`);
    assert.equal(await page.locator("html").evaluate((node) => node.scrollWidth), width, `${width}px has no horizontal overflow`);
    assert.ok(await page.locator("[data-podcast-detail-content]").evaluate((node) => node.scrollHeight >= node.clientHeight), `${width}px episode panel remains scrollable`);
    const firstRating = page.locator(`[data-episode-overview-rating-id="${sourceRows[0].id}"]`);
    if (mobile) await firstRating.tap();
    else { await firstRating.focus(); await page.keyboard.press("Enter"); }
    assert.equal(await page.locator("#rating").evaluate((node) => node.open), true, `${width}px can open episode rating overlay`);
    assert.match(await page.locator("#rating-title").textContent(), /Kvinden i Isdalen 1:5/u);
    await page.locator("#save").click();
    assert.equal(await page.locator("#rating").evaluate((node) => node.open), false, `${width}px can complete episode rating interaction`);
    assert.equal(await page.locator("#rating").getAttribute("data-saved"), sourceRows[0].id, `${width}px retains the canonical episode UUID while rating`);
    await page.locator("[data-back]").click();
    assert.equal(await page.evaluate(() => document.activeElement.id), "open", `${width}px back navigation restores focus`);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log("Djævlen episode visibility, source, identity, teaser, and responsive interaction regressions passed.");
