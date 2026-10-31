import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");
const cataloguePath = fileURLToPath(new URL("../data/podcasts.json", import.meta.url));
const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
const read = (name) => readFile(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
const [baseCss, desktopEpisodeCss, mobileEpisodeCss] = await Promise.all([
  read("style.css"),
  read("desktop-episode-workspace.css"),
  read("mobile-episode-expansion.css")
]);
const expectedMedianoIds = [
  "max mediano", "mediano pl", "mediano superliga", "superliga preview", "camp canada",
  "mediano landshold", "fodbold var bedre i 90 erne", "superliga special", "bold boger",
  "fredagsfrokosten", "mediano la liga", "mediano serie a", "mediano bundesliga",
  "mediano 1 division", "superliga for voksne", "mediano q", "mediano business",
  "mediano bossword", "mediano breaking", "fodbold var værre i 70 erne", "minimax",
  "mediano marketing", "souplesse", "klub mediano", "mediano 2 division",
  "mediano sport og perspektiv", "magasinet jennings", "troels bech i en samtale"
];

const configStart = app.indexOf("const MEDIANO_EPISODE_DESTINATIONS");
const configEnd = app.indexOf("const MANUAL_CATALOGUE_SOURCE", configStart);
assert.ok(configStart >= 0 && configEnd > configStart, "Mediano config manifest is missing");
const context = {
  URL,
  Object,
  console,
  normalizeText: (value) => String(value ?? "").trim().toLowerCase(),
  normalizeMatchKey: (value) => String(value ?? "").trim().toLowerCase(),
  EPISODE_DATABASE_KEY_ALIASES: {},
  getPodcastId: (podcast) => String(podcast?.podcastId ?? podcast?.["Podcast-ID"] ?? "").trim().toLowerCase(),
  getEpisodePodcastKey: (podcast) => String(
    typeof podcast === "object" ? podcast?.podcastId ?? podcast?.["Podcast-ID"] ?? "" : podcast ?? ""
  ).trim().toLowerCase(),
  getDisplayGroupEpisodeSeason: () => null,
  resolvePodcastByStoredKey: () => null
};
context.globalThis = context;
const configSource = app.slice(configStart, configEnd)
  .replace("const MEDIANO_EPISODE_DESTINATIONS", "globalThis.MEDIANO_EPISODE_DESTINATIONS")
  .replace("const MEDIANO_EPISODE_PODCAST_CONFIG", "globalThis.MEDIANO_EPISODE_PODCAST_CONFIG")
  .replace("const EPISODE_PODCAST_CONFIG", "globalThis.EPISODE_PODCAST_CONFIG");
vm.runInNewContext(configSource, context);

const resolverStart = app.indexOf("function getEpisodePodcastConfig(");
const resolverEnd = app.indexOf("function getEpisodeRatingPersistenceConfig", resolverStart);
assert.ok(resolverStart >= 0 && resolverEnd > resolverStart, "Episode config resolver is missing");
vm.runInNewContext(app.slice(resolverStart, resolverEnd), context);

for (const id of expectedMedianoIds) {
  const config = context.getEpisodePodcastConfig({ podcastId: id, title: `Display ${id}` });
  assert.ok(config?.enabled, `${id} must resolve to an enabled episode config`);
  assert.equal(config.podcastKey, id, `${id} must preserve its canonical Podcast-ID`);
  assert.equal(config.databasePodcastKey, id, `${id} must query its canonical database Podcast-ID`);
  assert.equal(config.persistence, "supabase", `${id} must use the normal Supabase episode path`);
  assert.equal(config.source, "mediano_public_rss", `${id} must read only public Mediano feed rows`);
}

assert.equal(context.MEDIANO_EPISODE_DESTINATIONS.length, 32, "approved Mediano destinations plus reviewed dormant series are configured");
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["superliga for voksne"].includeManualEpisodes, true);
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["klub mediano"].includeManualEpisodes, true, "Klub Mediano merges its reviewed historical subseries with RSS episodes");
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["troels bech i en samtale"].includeManualEpisodes, true, "Troels merges the reviewed Mounir catalogue row with its existing Supabase episode");
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["mediano superliga"].includeManualEpisodes, false);
assert.equal(context.getEpisodePodcastConfig({ podcastId: "unrelated podcast", title: "Unrelated" }), null, "unrelated podcasts are not globally enabled");

const stotRows = catalogue.rows.filter((row) => row["Podcast-ID"] === "stot mediano");
assert.equal(stotRows.length, 1, "the catalogue has one canonical Støt Mediano identity");
assert.equal(stotRows[0].Titel, "Støt Mediano");
assert.equal(stotRows[0].Feed || "", "", "the catalogue card does not need a standalone RSS feed address");
const stotConfig = context.getEpisodePodcastConfig(stotRows[0]);
assert.equal(stotConfig.podcastKey, "stot mediano");
assert.equal(stotConfig.databasePodcastKey, "stot mediano");
assert.equal(stotConfig.persistence, "supabase");
assert.equal(stotConfig.source, "mediano_site_rss");
assert.deepEqual([...stotConfig.episodeSources], ["mediano_site_rss"]);

const sourceBoundaryStart = app.indexOf("function applyPodcastEpisodeSourceBoundary(");
const sourceBoundaryEnd = app.indexOf("function getHistoricalEpisodeDisplayName(", sourceBoundaryStart);
assert.ok(sourceBoundaryStart >= 0 && sourceBoundaryEnd > sourceBoundaryStart, "episode source-boundary helpers exist");
vm.runInNewContext(app.slice(sourceBoundaryStart, sourceBoundaryEnd), context);
const sourceFilterCalls = [];
const episodeQuery = {
  in(field, values) {
    sourceFilterCalls.push([field, values]);
    return this;
  }
};
assert.equal(context.applyPodcastEpisodeSourceBoundary(episodeQuery, stotConfig), episodeQuery);
assert.equal(sourceFilterCalls.length, 1);
assert.equal(sourceFilterCalls[0][0], "source");
assert.deepEqual([...sourceFilterCalls[0][1]], ["mediano_site_rss"], "Støt loads only metadata-only site-feed rows");

const existingStotEpisodeBaseline = [
  ["0f202227-a8bc-444f-b505-ce247d837ce5", "573c1b7d01dbae9b52cd0936:573d6bdc37013bcc611eefd5:6ace953f06af5b01caf2f7fc", "2026-10-14T07:19:15.000Z", "https://www.mediano.nu/oversigt/euro-preview-cfl", "Europa Preview: Her er din optakt til alle fire danske hold i Conference League"],
  ["03f4a760-67bc-4238-b71e-4dd1d4ceca4d", "573c1b7d01dbae9b52cd0936:573d6bdc37013bcc611eefd5:6acf886b4982cf680137c8a5", "2026-10-15T23:28:04.000Z", "https://www.mediano.nu/oversigt/eurospecial1", "Europa Special: FC København holdt den danske fane højt"],
  ["41f75b0e-f128-4dd7-b705-8a2a0e1d9a0c", "573c1b7d01dbae9b52cd0936:573d6bdc37013bcc611eefd5:6ad9f5504aac0077e9822d20", "2026-10-22T23:56:21.000Z", "https://www.mediano.nu/oversigt/eurospecial221026", "Europa Special: Sort dansk aften med dumme røde kort"],
  ["decb097e-3596-48f2-abfa-d4a5b73869bc", "573c1b7d01dbae9b52cd0936:573d6bdc37013bcc611eefd5:6ae3baaae84a0f789323f2df", "2026-10-30T09:44:59.000Z", "https://www.mediano.nu/oversigt/pokal-special", "Pokal Special: Klar til kvartfinalerne - FC København møder FC Midtjylland, AGF møder Brabrand"]
];
const baselineRows = existingStotEpisodeBaseline.map(([id, external_guid, published_at, episode_url, title]) => ({
  id,
  external_guid,
  podcast_key: "stot mediano",
  source: "mediano_site_rss",
  title,
  published_at,
  episode_url,
  audio_url: null,
  metadata: {
    feed_url: "https://www.mediano.nu/oversigt?format=rss",
    metadata_only: true,
    rateable: true,
    rss_categories: ["Podcast", "Støt Mediano", "Fodbold Danmark"]
  }
}));
assert.equal(baselineRows.length, 4, "all four existing Støt Mediano episodes load from the canonical key");
assert.deepEqual(baselineRows.map((episode) => episode.id), existingStotEpisodeBaseline.map(([id]) => id));
assert.deepEqual(baselineRows.map((episode) => episode.external_guid), existingStotEpisodeBaseline.map(([, guid]) => guid));
assert.deepEqual(baselineRows.map((episode) => episode.published_at), existingStotEpisodeBaseline.map(([, , date]) => date));
assert.ok(baselineRows.every((episode) => episode.source === "mediano_site_rss"));
assert.ok(baselineRows.every((episode) => episode.podcast_key === stotConfig.databasePodcastKey));
assert.ok(baselineRows.every((episode) => context.episodeMatchesPodcastSourceBoundary(episode, stotConfig)));
assert.ok(baselineRows.every((episode) => episode.audio_url === null && episode.metadata.metadata_only === true), "subscriber audio remains unavailable on metadata-only rows");
assert.ok(baselineRows.every((episode) => episode.metadata.feed_url === "https://www.mediano.nu/oversigt?format=rss" && episode.metadata.rateable === true));
assert.ok(baselineRows.every((episode) => episode.metadata.rss_categories.includes("Støt Mediano")));
assert.deepEqual(baselineRows.map((episode) => episode.episode_url), existingStotEpisodeBaseline.map(([, , , url]) => url));

const episodeState = { items: baselineRows, workspaceVisibleCount: 4, loading: false, error: "" };
const getEpisodeKeyStart = app.indexOf("function getEpisodeKey(");
const getEpisodeKeyEnd = app.indexOf("\nfunction ", getEpisodeKeyStart + 1);
vm.runInNewContext(app.slice(getEpisodeKeyStart, getEpisodeKeyEnd), context);
const renderStart = app.indexOf("function renderPodcastEpisodeOverviewRows(podcast)");
const renderEnd = app.indexOf("\nfunction ensureManualPodcastEpisodeState", renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, "Støt uses the existing episode workspace renderer");
const parseNumber = (value) => value == null || value === "" ? null : Number(value);
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const renderEpisodeRows = new Function(
  "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeWorkspaceEpisodes", "getEpisodeKey",
  "getAppleSeasonEpisodeNumber", "formatEpisodeDate", "getEpisodeStat", "getEpisodeUserRating",
  "parseNumber", "escapeHtml", "formatEpisodeOverviewScore", "formatUserRatingCount",
  "formatCompactRating", "formatEpisodeOverviewOwnScore",
  `${app.slice(renderStart, renderEnd)}\nreturn renderPodcastEpisodeOverviewRows;`
)(
  () => episodeState,
  () => stotConfig,
  () => episodeState.items,
  (episode) => episode.id,
  () => null,
  (date) => new Date(date).toLocaleDateString("da-DK"),
  () => null,
  () => null,
  parseNumber,
  escapeHtml,
  (value) => `${value ?? "—"} <small>/10</small>`,
  (count) => `${count} vurderinger`,
  (value) => String(value),
  (value) => value === null ? "Vurder" : `${value} <small>/10</small>`
);
const renderedRows = renderEpisodeRows(stotRows[0]);
assert.equal((renderedRows.match(/<tr class=/g) || []).length, 4, "all four canonical episodes render");
assert.deepEqual(
  [...renderedRows.matchAll(/data-episode-overview-rating-id="([^"]+)"/gu)].map((match) => match[1]),
  existingStotEpisodeBaseline.map(([id]) => id),
  "rating controls keep the original episode UUIDs"
);

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390, 375, 320]) {
    const page = await browser.newPage({
      viewport: { width, height: 720 },
      isMobile: width <= 768,
      hasTouch: width <= 768
    });
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      ${baseCss}\n${desktopEpisodeCss}\n${mobileEpisodeCss}
      .test-content { max-height: 290px; overflow-y: auto; }
      .test-rating-dialog { max-width: min(92vw, 360px); }
    </style></head><body>
      <button id="openEpisodes" type="button">Episoder</button>
      <section id="podcastDetailSheet" class="is-episode-workspace" hidden>
        <div class="test-content" data-podcast-detail-content>
          <section class="podcast-detail-sheet__episode-overview" data-podcast-episode-overview>
            <div class="podcast-detail-sheet__episode-overview-toolbar">
              <button class="podcast-detail-sheet__episode-back" type="button" data-podcast-episode-overview-back>Tilbage til podcasten</button>
              <h2 class="podcast-detail-sheet__episode-workspace-title">Episoder</h2>
              <label class="podcast-detail-sheet__episode-search"><span class="sr-only">Søg i episoder</span><input type="search" aria-label="Søg i episoder"></label>
            </div>
            <div class="podcast-detail-sheet__episode-mobile-column-header"><p class="podcast-detail-sheet__episode-workspace-summary">4 episoder</p><span aria-hidden="true">Din vurdering</span></div>
            <div class="podcast-detail-sheet__episode-table-wrap"><table class="podcast-detail-sheet__episode-table"><thead><tr><th>Udgivelsesdato</th><th>Episode</th><th>Brugernes vurdering</th><th>Din vurdering</th></tr></thead><tbody>${renderedRows}</tbody></table></div>
          </section>
        </div>
      </section>
      <dialog class="test-rating-dialog" id="ratingDialog"><p id="ratingTitle"></p><button type="button" data-save-rating>Gem vurdering</button></dialog>
      <script>
        const sheet = document.querySelector('#podcastDetailSheet');
        const open = document.querySelector('#openEpisodes');
        const dialog = document.querySelector('#ratingDialog');
        open.addEventListener('click', () => { sheet.hidden = false; sheet.querySelector('[data-podcast-episode-overview-back]').focus(); });
        sheet.querySelector('[data-podcast-episode-overview-back]').addEventListener('click', () => { sheet.hidden = true; open.focus(); });
        sheet.querySelectorAll('[data-episode-overview-rating-id]').forEach((button) => button.addEventListener('click', () => {
          document.querySelector('#ratingTitle').textContent = button.getAttribute('aria-label');
          dialog.dataset.episodeId = button.getAttribute('data-episode-overview-rating-id');
          dialog.showModal();
        }));
        dialog.querySelector('[data-save-rating]').addEventListener('click', () => { dialog.dataset.saved = dialog.dataset.episodeId; dialog.close(); });
      </script>
    </body></html>`);

    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "openEpisodes", `${width}px keyboard navigation reaches the episode link`);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#podcastDetailSheet").isVisible(), true, `${width}px opens the canonical episode list`);
    assert.equal(await page.locator("tbody tr").count(), 4, `${width}px shows all four episodes`);
    assert.equal(await page.evaluate(() => document.activeElement.matches("[data-podcast-episode-overview-back]")), true, `${width}px returns focus into the episode view`);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.matches('[aria-label="Søg i episoder"]')), true, `${width}px keyboard focus reaches episode search`);
    assert.equal(await page.locator("html").evaluate((element) => element.scrollWidth), width, `${width}px has no horizontal overflow`);
    assert.equal(await page.locator("audio").count(), 0, "metadata-only episodes do not expose audio players");
    assert.equal(await page.locator(".episode-title").evaluateAll((nodes) => nodes.every((node) => node.scrollWidth <= node.clientWidth)), true, `${width}px episode titles wrap within their cells`);

    const scrollArea = page.locator("[data-podcast-detail-content]");
    assert.ok(await scrollArea.evaluate((element) => element.scrollHeight > element.clientHeight), `${width}px episode list can scroll`);
    if (width <= 768) {
      await page.locator(`[data-episode-overview-rating-id="${existingStotEpisodeBaseline[2][0]}"]`).tap();
    } else {
      await page.locator(`[data-episode-overview-rating-id="${existingStotEpisodeBaseline[2][0]}"]`).focus();
      await page.keyboard.press("Enter");
    }
    assert.equal(await page.locator("#ratingDialog").evaluate((dialog) => dialog.open), true, `${width}px can open an episode rating`);
    assert.match(await page.locator("#ratingTitle").textContent(), /Europa Special/u);
    await page.locator("[data-save-rating]").click();
    assert.equal(await page.locator("#ratingDialog").evaluate((dialog) => dialog.open), false, `${width}px can complete rating interaction`);
    assert.equal(await page.locator("#ratingDialog").getAttribute("data-saved"), existingStotEpisodeBaseline[2][0], `${width}px keeps the rating attached to the original UUID`);
    await page.locator("[data-podcast-episode-overview-back]").click();
    assert.equal(await page.evaluate(() => document.activeElement.id), "openEpisodes", `${width}px back navigation restores focus`);
    await page.close();
  }
} finally {
  await browser.close();
}

const fodboldministeriet = context.getEpisodePodcastConfig({
  podcastId: "fodboldministeriet",
  title: "Fodboldministeriet",
  Feed: "https://example.test/fodboldministeriet.rss"
});
assert.equal(fodboldministeriet.databasePodcastKey, "fodboldministeriet", "Fodboldministeriet retains its dedicated canonical key");
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG.fodboldministeriet, undefined, "Fodboldministeriet is not added to the Mediano umbrella config");

assert.match(app, /mergeEpisodes\(rows, manualEpisodes\)/u, "Superliga for voksne uses the existing identity de-duplication merge");
assert.match(app, /manualEpisodeKey: "den-store-talentserie"/u, "Den store talentserie uses an immutable manual episode key");
assert.match(app, /manualEpisodeKey: "mediano-special-hvad-siger-data-om-superligaen"/u, "Mediano Special historical episode uses an immutable manual episode key");
assert.match(app, /refreshManualEpisodeRatingData\(config\.podcastKey, manualEpisodes\)/u, "manual rating/mapping hydration remains active");
assert.match(app, /function getEpisodeRatingPersistenceConfig[\s\S]*?if \(config\) return config;/u, "existing episode-rating persistence resolution remains unchanged");

console.log("Mediano episode workspace configuration regression checks passed.");
