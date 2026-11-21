import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { FRIHEDSBREVET_SOURCE_REGISTRY } from "./audit-frihedsbrevet-sources.mjs";
import { isValidFriMadsArticleSidecar } from "./update-fri-mads-article-sidecar.mjs";

const [app, siteCss, mobileCss, desktopCss, sidecarText, catalogText, fixtureText] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../style.css", import.meta.url), "utf8"),
  readFile(new URL("../mobile-episode-expansion.css", import.meta.url), "utf8"),
  readFile(new URL("../desktop-episode-workspace.css", import.meta.url), "utf8"),
  readFile(new URL("../data/fri-mads-articles.json", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"),
  readFile(new URL("./fixtures/fri-mads-article-preview.json", import.meta.url), "utf8")
]);

const sidecar = JSON.parse(sidecarText);
const catalog = JSON.parse(catalogText);
const fixture = JSON.parse(fixtureText);
const sourceSnapshot = JSON.stringify({ sidecar, catalog, fixture });

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is present in app.js`);
  const declarationStart = app.slice(Math.max(0, start - 6), start) === "async " ? start - 6 : start;
  const boundaries = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)]
    .filter((index) => index >= 0);
  return app.slice(declarationStart, boundaries.length ? Math.min(...boundaries) : app.length);
}

const functionNames = [
  "escapeHtml", "isFriMadsMetadataPodcast", "isValidFriMadsArticleSidecar",
  "getFriMadsEpisodeIdentityFields", "isFriMadsReleaseAlreadyEpisode",
  "isFriMadsRateableArticleEpisode",
  "getEpisodeWorkspaceEpisodes", "getEpisodeWorkspaceSummary",
  "renderPodcastEpisodeOverviewRows", "renderPodcastEpisodeOverview",
  "bindPodcastEpisodeOverviewEvents", "scheduleEpisodeWorkspaceSearch", "resetPodcastEpisodeOverviewScroll",
  "updatePodcastEpisodeOverview", "getFriMadsArticleSidecar",
  "renderPodcastDetailSheetContent", "renderPodcastEpisodeOverviewContent",
  "isRateablePodcastEpisode"
];
const sources = Object.fromEntries(functionNames.map((name) => [name, extractFunction(name)]));
const podcast = {
  podcastId: "fri mads", catalogueId: "catalogue-v1-d94fc39e",
  title: "Fri Mads", link: "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/"
};
const borgenu = {
  podcastId: "borgenudenfilter", catalogueId: "catalogue-v1-b00626fa",
  title: "BorgenUdenFilter", link: "https://feeds.simplecast.com/OvoXT1qQ"
};

const episodeState = {
  items: [], friMadsArticleItems: [], searchTerm: "", loading: false, error: "",
  workspaceVisibleCount: 100, totalCount: 5, hasMore: false,
  searchHasMore: false, searchTotalCount: null
};
const episodesByKey = new Map([
  ["fri mads", episodeState],
  ["borgenudenfilter", {
    items: [{ id: "borgen-episode-uuid-1", title: "BorgenUdenFilter #12: Testafsnit", published_at: "2026-10-01T10:00:00Z" }],
    friMadsArticleItems: [], searchTerm: "", loading: false, error: "", workspaceVisibleCount: 100,
    totalCount: 1, hasMore: false, searchHasMore: false, searchTotalCount: null
  }]
]);
const configs = new Map([
  ["fri mads", null],
  ["borgenudenfilter", { dataSource: "rss", searchPlaceholder: "Søg i BorgenUdenFilter-episoder" }]
]);
const context = {
  getPodcastEpisodeState: (item) => episodesByKey.get(item.podcastId),
  getEpisodePodcastConfig: (item) => configs.get(item.podcastId),
  normalizeText: (value) => String(value || "").trim().toLocaleLowerCase("da-DK"),
  normalizeComparable: (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("da-DK"),
  getVisibleGenstartEpisodes: () => [],
  getDerVarEngangEpisodeOverviewRows: (_item, rows) => rows,
  getAppleSeasonEpisodeNumber: () => null,
  EPISODE_WORKSPACE_PAGE_SIZE: 20,
  podcastHasManualEpisodeList: () => false,
  escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]),
  formatEpisodeDate: (value) => value ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value)) : "",
  getEpisodeKey: (episode) => episode?.id || episode?.external_guid || "",
  getEpisodeStat: (id) => id ? { averageRating: 8.4, ratingCount: 12 } : null,
  getEpisodeUserRating: (id) => id ? 8 : null,
  parseNumber: (value) => value == null || value === "" ? null : Number(value),
  formatEpisodeOverviewScore: (value) => value == null ? "—" : String(value),
  formatUserRatingCount: (value) => `${value} vurderinger`,
  getOfficialMedianoEpisodeSourceUrl: () => "",
  formatCompactRating: (value) => String(value),
  isManualEpisodeRatingAvailable: (episode) => Boolean(episode?.id),
  formatEpisodeOverviewOwnScore: (value) => value == null ? "Vurder" : String(value),
  normalizeTextForSearch: (value) => String(value || "").trim().toLocaleLowerCase("da-DK"),
  document: globalThis.document,
  window: globalThis.window,
  state: { podcastDetailView: "episodes", podcastByKey: { "fri mads": podcast }, activePodcastDetailKey: "fri mads" },
  getPodcastKey: (item) => item.podcastId,
  renderPodcastDetailSheetContent: () => {},
  getGenstartEpisodeById: () => null,
  getPodcastManualEpisodes: () => [],
  getEpisodeKeyForRating: () => "",
  openEpisodeRatingDialog: () => {},
  searchGenstartEpisodes: async () => {},
  fetchGenstartEpisodes: async () => {}
};
const runtimeFactory = new Function("context", `${[
  sources.isFriMadsMetadataPodcast, sources.isValidFriMadsArticleSidecar,
  sources.getFriMadsEpisodeIdentityFields, sources.isFriMadsReleaseAlreadyEpisode,
  sources.isFriMadsRateableArticleEpisode, sources.getEpisodeWorkspaceEpisodes,
  sources.getEpisodeWorkspaceSummary, sources.renderPodcastEpisodeOverviewRows,
  sources.renderPodcastEpisodeOverview
].join("\n")}\nconst {${Object.keys(context).join(",")}} = context; return { getEpisodeWorkspaceEpisodes, getEpisodeWorkspaceSummary, renderPodcastEpisodeOverviewRows, renderPodcastEpisodeOverview, isFriMadsReleaseAlreadyEpisode, isFriMadsRateableArticleEpisode };`);
const runtime = runtimeFactory(context);

function setFriMadsItems(items) {
  episodeState.friMadsArticleItems = items.map((release) => ({
    title: release.title, published_at: release.publishedDate, releaseNumber: release.releaseNumber,
    releaseId: release.releaseId, canonicalUrl: release.canonicalUrl, contentKind: "article",
    metadataOnly: true, playable: false, rateable: false, accessType: "paid"
  }));
}

assert.equal(isValidFriMadsArticleSidecar(sidecar), true, "the checked-in public metadata sidecar validates");
assert.equal(sidecar.podcastId, "fri mads");
assert.equal(sidecar.catalogueId, "catalogue-v1-d94fc39e");
assert.equal(sidecar.sourceOverview, "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/");
assert.equal(sidecar.accessType, "paid");
assert.equal(sidecar.contentKind, "article");
assert.equal(sidecar.metadataOnly, true);
assert.equal(sidecar.playable, false);
assert.equal(sidecar.rateable, false);
assert.equal(sidecar.audioUrl, null);
assert.deepEqual(sidecar.items.map((item) => item.releaseNumber), [172, 171, 170, 169, 168]);
assert.equal(sidecar.items[0].title, "Fri Mads #172: Alle elsker Mette");
assert.equal(sidecar.items[0].publishedDate, "2026-11-08");
assert.equal(sidecar.items[0].canonicalUrl, "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/");
assert.equal(sidecar.items.some((item) => item.releaseNumber === 173), false, "synthetic #173 never appears");
assert.ok(sidecar.items.every((item) => item.fixtureOnly !== true && !("articleText" in item)));

assert.equal(FRIHEDSBREVET_SOURCE_REGISTRY.length, 36);
assert.ok(catalog.rows.length >= 1376, "catalogue growth remains allowed above the verified minimum baseline");
assert.equal(FRIHEDSBREVET_SOURCE_REGISTRY.filter((identity) => catalog.rows.some((row) =>
  row["Podcast-ID"] === identity.podcastId && row.catalogue_id === identity.catalogueId)).length, 36,
"all exact Frihedsbrevet Podcast-ID/catalogue_id pairs still exist");
assert.deepEqual(catalog.rows.filter((row) => row["Podcast-ID"] === "fri mads").map((row) => ({
  podcastId: row["Podcast-ID"], catalogueId: row.catalogue_id, link: row.Link,
  accessEvidenceUrl: row.accessEvidenceUrl, accessType: row.accessType
})), [{
  podcastId: "fri mads", catalogueId: "catalogue-v1-d94fc39e",
  link: "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/",
  accessEvidenceUrl: "https://frihedsbrevet.dk/fri-mads-140-verden-af-i-gaar/", accessType: "paid"
}], "Fri Mads identity, approved profile link, historical #140 and paid access stay unchanged");

const originalRows = catalog.rows.map((row) => ({ id: row["Podcast-ID"], catalogueId: row.catalogue_id }));
setFriMadsItems(sidecar.items);
const friMarkup = runtime.renderPodcastEpisodeOverview(podcast);
const borgenuMarkup = runtime.renderPodcastEpisodeOverview(borgenu);
for (const [label, markup] of [["Fri Mads", friMarkup], ["BorgenUdenFilter", borgenuMarkup]]) {
  assert.match(markup, /<h2 class="podcast-detail-sheet__episode-workspace-title">Episoder<\/h2>/u, `${label} uses the common workspace heading`);
  assert.match(markup, /data-podcast-episode-overview-back/u, `${label} has the common back control`);
  assert.match(markup, /data-episode-workspace-search/u, `${label} has the common search field`);
  assert.equal((markup.match(/<th\b/gu) || []).length, 4, `${label} has all four common rating/date columns`);
  assert.equal((markup.match(/<col\s*\/>/gu) || []).length, 4, `${label} shares four-column table structure`);
}
assert.match(friMarkup, /Udgivelsesdato/u);
assert.match(friMarkup, /Brugernes vurdering/u);
assert.match(friMarkup, /Din vurdering/u);
assert.match(friMarkup, /Søg i Fri Mads-udgivelser/u);
assert.doesNotMatch(friMarkup, /episode-table--fri-mads-metadata|Fri Mads-artikler|fri-mads-article-preview|#173|fri-mads-173-|<audio\b|<video\b|duration|varighed/iu);
assert.equal((friMarkup.match(/data-fri-mads-release-id=/gu) || []).length, 5);
for (const release of sidecar.items) {
  assert.ok(friMarkup.includes(release.title), `common episode list includes ${release.releaseId}`);
  assert.ok(friMarkup.includes(release.canonicalUrl), `verified permalink retained for ${release.releaseId}`);
}
assert.equal((friMarkup.match(/class="podcast-detail-sheet__episode-rating-unavailable"/gu) || []).length, 10,
  "both rating columns show unavailable state for all five metadata-only rows");
assert.doesNotMatch(friMarkup, /Betalt adgang\s*&middot;\s*abonnement kan kr&aelig;ves/u,
  "Fri Mads rows omit the redundant payment warning while paid access remains in the sidecar");
assert.doesNotMatch(friMarkup, /data-episode-overview-rating-id|class="podcast-detail-sheet__episode-own-score/u,
  "metadata-only publications have no rating controls or identity attributes");
assert.match(borgenuMarkup, /data-episode-overview-rating-id="borgen-episode-uuid-1"/u,
  "real episode rating controls remain present for ordinary podcasts");

episodeState.searchTerm = "172";
assert.deepEqual(runtime.getEpisodeWorkspaceEpisodes(podcast).map((item) => item.releaseNumber), [172]);
episodeState.searchTerm = "ingen sådan udgivelse";
assert.deepEqual(runtime.getEpisodeWorkspaceEpisodes(podcast), []);
assert.match(runtime.renderPodcastEpisodeOverviewRows(podcast), /Ingen udgivelser matcher din s&oslash;gning/u);
episodeState.searchTerm = "";
assert.equal(runtime.getEpisodeWorkspaceEpisodes(podcast).length, 5, "clearing search restores all five releases");
episodeState.friMadsMetadataError = true;
const failedSourceRows = runtime.renderPodcastEpisodeOverviewRows(podcast);
assert.match(failedSourceRows, /Udgivelserne kunne ikke hentes/u, "source failures render a fail-closed state");
assert.doesNotMatch(failedSourceRows, /data-fri-mads-release-id/u, "source failures never retain stale article rows");
episodeState.friMadsMetadataError = false;

const matchingExistingEpisode = { external_guid: sidecar.items[0].canonicalUrl };
const titleOnlyCollision = { title: sidecar.items[0].title, external_guid: "different-guid" };
episodeState.items = [titleOnlyCollision];
assert.equal(runtime.getEpisodeWorkspaceEpisodes(podcast).length, 6, "title-only similarity does not suppress a distinct source identity");
episodeState.items = [matchingExistingEpisode];
assert.equal(runtime.isFriMadsReleaseAlreadyEpisode(sidecar.items[0], episodeState.items), true, "duplicate detection uses exact source identity");
const exactMatchWorkspace = runtime.getEpisodeWorkspaceEpisodes(podcast);
assert.equal(exactMatchWorkspace.length, 5, "the existing episode remains alongside four non-duplicate article records");
assert.equal(exactMatchWorkspace.filter((item) => item.contentKind === "article").length, 4,
  "the exact official permalink is suppressed from metadata articles");
episodeState.items = [];

const rateableRelease = sidecar.items[0];
const importedArticle = {
  id: "550e8400-e29b-41d4-a716-446655440000", podcast_key: "fri mads",
  source: "fri_mads_official_article", external_guid: rateableRelease.canonicalUrl,
  external_episode_id: null, title: rateableRelease.title, description: null,
  published_at: `${rateableRelease.publishedDate}T00:00:00.000Z`, duration_seconds: null,
  episode_url: rateableRelease.canonicalUrl, audio_url: null, image_url: null, is_active: true,
  metadata: {
    format: "fri_mads_article_json", catalogue_id: "catalogue-v1-d94fc39e",
    source_overview: sidecar.sourceOverview, release_id: rateableRelease.releaseId,
    release_number: rateableRelease.releaseNumber, canonical_url: rateableRelease.canonicalUrl,
    content_kind: "article", metadata_only: true, playable: false, rateable: true,
    access_type: "paid"
  }
};
episodeState.items = [importedArticle];
setFriMadsItems(sidecar.items);
assert.equal(runtime.isFriMadsRateableArticleEpisode(podcast, importedArticle), true,
  "only an exact imported URL identity with a database UUID is eligible for episode ratings");
const importedRowsMarkup = runtime.renderPodcastEpisodeOverviewRows(podcast);
assert.match(importedRowsMarkup, /data-episode-overview-rating-id="550e8400-e29b-41d4-a716-446655440000"/u,
  "verified imported articles use the normal episode rating control");
assert.match(importedRowsMarkup, /Lyt hos Frihedsbrevet/u);
assert.match(importedRowsMarkup, /Fri Mads #172: Alle elsker Mette/u);
assert.equal((importedRowsMarkup.match(/data-episode-overview-rating-id=/gu) || []).length, 1,
  "sidecar-only releases remain unrated until an imported UUID exists");

const invalidImportedArticle = {
  ...importedArticle,
  metadata: { ...importedArticle.metadata, catalogue_id: "wrong-catalogue" }
};
episodeState.items = [invalidImportedArticle];
assert.equal(runtime.isFriMadsRateableArticleEpisode(podcast, invalidImportedArticle), false,
  "a row with mismatched catalogue identity fails closed");
const invalidRowsMarkup = runtime.renderPodcastEpisodeOverviewRows(podcast);
assert.doesNotMatch(invalidRowsMarkup, /data-episode-overview-rating-id=/u,
  "invalid source identity never gets a rating action");
assert.match(invalidRowsMarkup, /episode-rating-unavailable/u);
episodeState.items = [];

const wrongIdentity = { ...podcast, podcastId: "friis diplomatpost" };
assert.equal(context.isFriMadsMetadataPodcast?.(wrongIdentity) ?? new Function(`${sources.isFriMadsMetadataPodcast}; return isFriMadsMetadataPodcast`)()(wrongIdentity), false);
const detailSource = sources.renderPodcastDetailSheetContent;
const overviewContentSource = sources.renderPodcastEpisodeOverviewContent;
const overviewSource = sources.renderPodcastEpisodeOverview;
const fetchSource = sources.getFriMadsArticleSidecar;
assert.match(detailSource, /isFriMadsMetadataPodcast\(podcast\)/u);
assert.match(detailSource, /hasFriMadsPublications \? "Se episoder"/u,
  "only the exact Fri Mads profile uses the publication label");
assert.doesNotMatch(detailSource, /fri-mads-article-preview|hydrateFriMadsArticleMetadataPreview/u, "no separate article block remains");
assert.match(overviewContentSource, /content\.innerHTML = renderPodcastEpisodeOverview\(podcast\)/u,
  "Fri Mads enters the same episode workspace renderer as other podcasts");
assert.match(overviewContentSource, /getFriMadsArticleSidecar\(\)/u);
assert.match(overviewContentSource, /currentState\.friMadsArticleItems = validSidecar \? sidecar\.items\.map/u);
assert.match(fetchSource, /data\/fri-mads-articles\.json/u);
assert.match(fetchSource, /sidecarUrl\.origin !== window\.location\.origin/u);
assert.match(fetchSource, /credentials:\s*"same-origin"/u);
assert.match(fetchSource, /redirect:\s*"error"/u);
assert.match(sources.isRateablePodcastEpisode, /metadata\.rateable !== false/u);

const invalidSidecar = structuredClone(sidecar);
invalidSidecar.items[0].canonicalUrl = "https://example.org/fri-mads-172/";
assert.equal(isValidFriMadsArticleSidecar(invalidSidecar), false, "unverified links fail closed");
assert.deepEqual(catalog.rows.map((row) => ({ id: row["Podcast-ID"], catalogueId: row.catalogue_id })), originalRows);
assert.equal(JSON.stringify({ sidecar, catalog, fixture }), sourceSnapshot, "rendering does not mutate sidecar, fixture or catalogue data");

// Browser checks run the same extracted renderer, event binding, search and update functions used by app.js.
const browserSources = [
  sources.escapeHtml,
  "function isFriMadsMetadataPodcast(podcast){return podcast?.podcastId === 'fri mads' && podcast?.catalogueId === 'catalogue-v1-d94fc39e' && podcast?.link === 'https://frihedsbrevet.dk/nyhedsbrev/fri-mads/';}",
  sources.isValidFriMadsArticleSidecar,
  sources.getFriMadsEpisodeIdentityFields,
  sources.isFriMadsReleaseAlreadyEpisode,
  sources.isFriMadsRateableArticleEpisode,
  sources.getEpisodeWorkspaceEpisodes,
  sources.getEpisodeWorkspaceSummary,
  sources.renderPodcastEpisodeOverviewRows,
  sources.renderPodcastEpisodeOverview,
  sources.scheduleEpisodeWorkspaceSearch,
  sources.bindPodcastEpisodeOverviewEvents,
  sources.resetPodcastEpisodeOverviewScroll,
  sources.updatePodcastEpisodeOverview,
  sources.getFriMadsArticleSidecar
].join("\n");
assert.equal((browserSources.match(/let friMadsArticleSidecarPromise\s*=/gu) || []).length, 1,
  "sidecar cache declaration is extracted together with its loader function");
let sidecarRequests = 0;
let profileRestored = false;
const browserScript = `
const EPISODE_WORKSPACE_PAGE_SIZE=20;
const state={podcastDetailView:'episodes',activePodcastDetailKey:'fri mads',podcastByKey:{'fri mads':${JSON.stringify(podcast)}}};
const podcast=state.podcastByKey['fri mads'];
const episodeState={items:[],friMadsArticleItems:[],searchTerm:'',loading:false,error:'',workspaceVisibleCount:20,totalCount:5,hasMore:false,searchHasMore:false,searchTotalCount:null};
const configs={'fri mads':null};
function getPodcastEpisodeState(){return episodeState;}
function getEpisodePodcastConfig(item){return configs[item.podcastId]||null;}
function normalizeText(value){return String(value||'').trim().toLocaleLowerCase('da-DK');}
function normalizeComparable(value){return String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/gu,'').toLocaleLowerCase('da-DK');}
function getVisibleGenstartEpisodes(){return [];}
function getDerVarEngangEpisodeOverviewRows(_item,rows){return rows;}
function getAppleSeasonEpisodeNumber(){return null;}
function getEpisodeKey(item){return item?.id||item?.external_guid||'';}
function getEpisodeStat(id){return id?{averageRating:8.4,ratingCount:12}:null;}
function getEpisodeUserRating(id){return id?8:null;}
function parseNumber(value){return value==null||value===''?null:Number(value);}
function formatEpisodeDate(value){return value?new Intl.DateTimeFormat('da-DK',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value.length===10?value+'T00:00:00Z':value)):'';}
function formatEpisodeOverviewScore(value){return value==null?'—':String(value);}
function formatUserRatingCount(value){return value+' vurderinger';}
function getOfficialMedianoEpisodeSourceUrl(){return '';}
function formatCompactRating(value){return String(value);}
function isManualEpisodeRatingAvailable(item){return Boolean(item?.id);}
function formatEpisodeOverviewOwnScore(value){return value==null?'Vurder':String(value);}
function podcastHasManualEpisodeList(){return false;}
function scheduleGenstartEpisodeSearch(){}
function renderPodcastDetailSheetContent(){window.__profileRestored=true;}
function getPodcastKey(item){return item.podcastId;}
function getGenstartEpisodeById(id){return episodeState.items.find(item=>item.id===id)||null;}
function getPodcastManualEpisodes(){return [];}
function openEpisodeRatingDialog(){window.__ratingDialogOpened=true;}
function getEpisodeWorkspaceSummary(p){const n=getEpisodeWorkspaceEpisodes(p).length;return n+' episoder';}
${browserSources}
window.__episodeState=episodeState;window.__podcast=podcast;
window.__loadImportedArticle=()=>{episodeState.items=[${JSON.stringify(importedArticle)}];updatePodcastEpisodeOverview(document.querySelector('#podcastDetailSheet'),{resetScroll:true});};
window.openEpisodes=async()=>{
  episodeState.friMadsMetadataLoading=true; episodeState.friMadsMetadataError=false; episodeState.friMadsArticleItems=[];
  document.querySelector('[data-podcast-detail-content]').innerHTML=renderPodcastEpisodeOverview(podcast);
  document.querySelector('#podcastDetailSheet').classList.add('is-episode-workspace');
  resetPodcastEpisodeOverviewScroll(document.querySelector('#podcastDetailSheet'));
  bindPodcastEpisodeOverviewEvents(document.querySelector('#podcastDetailSheet'),podcast);
  const data=await getFriMadsArticleSidecar();
  episodeState.friMadsMetadataLoading=false;episodeState.friMadsMetadataError=!data;
  episodeState.friMadsArticleItems=episodeState.friMadsMetadataError?[]:data.items.map(release=>({...release,published_at:release.publishedDate,contentKind:'article',metadataOnly:true,playable:false,rateable:false,accessType:'paid'}));
  updatePodcastEpisodeOverview(document.querySelector('#podcastDetailSheet'),{resetScroll:true});
};
document.querySelector('[data-podcast-episodes-open]').addEventListener('click',window.openEpisodes);
`;
const markup = runtime.renderPodcastEpisodeOverview(podcast);
const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${siteCss}\n${mobileCss}\n${desktopCss}</style></head><body class="page-podcast">
<div id="podcastDetailSheet"><main class="podcast-detail-sheet__content" data-podcast-detail-content style="box-sizing:border-box;width:100%;height:600px;max-height:80vh;overflow-y:auto;">
<a class="podcast-detail-sheet__header-link" href="https://frihedsbrevet.dk/nyhedsbrev/fri-mads/" target="_blank" rel="noopener noreferrer">Fri Mads hos Frihedsbrevet</a><h2>Fri Mads</h2>
<button type="button" class="podcast-detail-sheet__episode-entry-button" data-podcast-episodes-open>Se episoder</button></main></div>
<script>${browserScript}</script></body></html>`;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/data/fri-mads-articles.json") {
    sidecarRequests += 1;
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(sidecarText);
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const contextBrowser = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const page = await contextBrowser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator(".fri-mads-article-preview,[data-fri-mads-article-preview]").count(), 0, "no detached article section appears");
  await page.locator("[data-podcast-episodes-open]").click();
  try {
    await page.waitForSelector("tr[data-fri-mads-release-id]", { timeout: 5000 });
  } catch {
    throw new Error(`episode rows did not load; page errors: ${errors.join(" | ")}; state: ${JSON.stringify(await page.evaluate(() => window.__episodeState))}`);
  }
  assert.equal(sidecarRequests, 1);
  assert.deepEqual(await page.locator("[data-podcast-episode-overview] thead th").allTextContents(), ["Udgivelsesdato", "Episode", "Brugernes vurdering", "Din vurdering"]);
  assert.equal(await page.locator("[data-podcast-episode-overview] colgroup col").count(), 4);
  assert.equal(await page.locator("tr[data-fri-mads-release-id]").count(), 5);
  assert.equal(await page.locator("tr[data-fri-mads-release-id] [role=status]").count(), 10);
  assert.equal(await page.locator("tr[data-fri-mads-release-id] [data-episode-overview-rating-id],tr[data-fri-mads-release-id] button").count(), 0);
  assert.equal(await page.locator("audio,video").count(), 0);
  assert.equal(await page.locator(".fri-mads-episode-access").count(), 0);
  assert.equal(await page.getByText("Betalt adgang · abonnement kan kræves").count(), 0);
  assert.equal(await page.locator('a:has-text("Lyt hos Frihedsbrevet")').count(), 5);

  const search = page.locator("[data-episode-workspace-search]");
  await search.focus();
  await search.fill("172");
  await page.waitForFunction(() => document.querySelectorAll("tr[data-fri-mads-release-id]").length === 1);
  assert.match(await page.locator("tr[data-fri-mads-release-id]").innerText(), /#172/u);
  assert.equal(await page.evaluate(() => document.activeElement?.matches("[data-episode-workspace-search]")), true,
    "search retains focus through the normal workspace re-render");
  await search.fill("no matching release");
  await page.waitForSelector("text=Ingen udgivelser matcher din søgning");
  assert.equal(await page.locator("tr[data-fri-mads-release-id]").count(), 0);
  await search.fill("");
  await page.waitForFunction(() => document.querySelectorAll("tr[data-fri-mads-release-id]").length === 5);
  assert.equal(await page.evaluate(() => document.activeElement?.matches("[data-episode-workspace-search]")), true);

  await page.evaluate(() => window.__loadImportedArticle());
  const rateableRow = page.locator('tr[data-fri-mads-release-id="fri-mads:172:https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/"]');
  assert.equal(await rateableRow.locator("[data-episode-overview-rating-id]").count(), 1,
    "an exact imported episode UUID enables the standard rating action");
  assert.equal(await rateableRow.locator("[role=status]").count(), 0);
  assert.equal(await page.locator("tr[data-fri-mads-release-id] [data-episode-overview-rating-id]").count(), 1,
    "the four sidecar-only releases remain non-rateable");
  await rateableRow.locator("[data-episode-overview-rating-id]").click();
  assert.equal(await page.evaluate(() => window.__ratingDialogOpened), true,
    "the episode rating action invokes the existing rating dialog");
  await page.evaluate(() => { window.__ratingDialogOpened = false; window.__episodeState.items = []; updatePodcastEpisodeOverview(document.querySelector('#podcastDetailSheet'),{resetScroll:true}); });

  for (const width of [320, 375, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 769 ? 760 : 900 });
    const sizes = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      doc: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      content: document.querySelector("[data-podcast-detail-content]").scrollWidth,
      contentClient: document.querySelector("[data-podcast-detail-content]").clientWidth,
      count: document.querySelectorAll("tr[data-fri-mads-release-id]").length,
      titlesFit: [...document.querySelectorAll(".episode-title")].every((node) => node.scrollWidth <= node.clientWidth + 1)
    }));
    assert.ok(sizes.doc <= sizes.viewport && sizes.body <= sizes.viewport, `${width}px has no horizontal document overflow: ${JSON.stringify(sizes)}`);
    assert.ok(sizes.content <= sizes.contentClient + 1, `${width}px detail pane has no horizontal overflow: ${JSON.stringify(sizes)}`);
    assert.equal(sizes.count, 5);
    assert.equal(sizes.titlesFit, true, `${width}px titles fit or wrap`);
  }

  await page.setViewportSize({ width: 390, height: 760 });
  const mobilePane = page.locator("[data-podcast-detail-content]");
  await mobilePane.evaluate((node) => node.scrollTo(0, node.scrollHeight));
  assert.ok(await mobilePane.evaluate((node) => node.scrollTop > 0), "the shared mobile detail workspace scrolls");
  const link = page.locator('a:has-text("Lyt hos Frihedsbrevet")').first();
  await page.keyboard.press("Tab");
  await link.focus();
  assert.notEqual(await link.evaluate((node) => getComputedStyle(node).outlineStyle), "none", "release link keeps visible keyboard focus");
  const expectedHref = await link.getAttribute("href");
  const popupPromise = page.waitForEvent("popup");
  await link.tap();
  const popup = await popupPromise;
  assert.equal(popup.url(), expectedHref, "touch activates the exact official article link");
  const back = page.locator("[data-podcast-episode-overview-back]");
  await back.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("#podcastDetailSheet")?.classList.contains("is-episode-workspace"));
  assert.equal(await page.evaluate(() => window.__profileRestored), true, "back action restores the profile view");
  assert.deepEqual(errors, [], `no browser errors: ${errors.join(" | ")}`);
  await contextBrowser.close();

  const borgenPage = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await borgenPage.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${siteCss}\n${mobileCss}\n${desktopCss}</style><div id="podcastDetailSheet" class="is-episode-workspace"><div data-podcast-detail-content>${borgenuMarkup}</div></div>`);
  assert.deepEqual(await borgenPage.locator("thead th").allTextContents(), ["Udgivelsesdato", "Episode", "Brugernes vurdering", "Din vurdering"]);
  assert.equal(await borgenPage.locator("[data-episode-overview-rating-id='borgen-episode-uuid-1']").count(), 1,
    "ordinary podcast rating control remains active");
  for (const width of [320, 375, 390, 768, 1280, 1440]) {
    await borgenPage.setViewportSize({ width, height: width < 769 ? 760 : 900 });
    const dimensions = await borgenPage.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport, `BorgenUdenFilter remains overflow-free at ${width}px`);
  }
  await borgenPage.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

assert.equal(JSON.stringify({ sidecar, catalog, fixture }), sourceSnapshot, "the UI preview performs no catalogue, episode or rating mutation");
console.log("Fri Mads shares the BorgenUdenFilter episode workspace, including functional search, four columns, unavailable rating states, navigation and 320–1440px browser checks.");
