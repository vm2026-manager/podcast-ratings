import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mapEpisodes, parseFeed, runEpisodeImport, validateExpectedRssIdentity } from "../supabase/functions/import-podcast-episodes/core.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [app, dataText, proposal, css] = await Promise.all([
  readFile(path.join(root, "app.js"), "utf8"),
  readFile(path.join(root, "data/podcasts.json"), "utf8"),
  readFile(path.join(root, "docs/proposals/issue-89-dr-podimo-sheet-changes.md"), "utf8"),
  readFile(path.join(root, "style.css"), "utf8")
]);
const rows = JSON.parse(dataText).rows;
const rowById = Object.fromEntries(rows.map((row) => [row["Podcast-ID"], row]));
const reviewIds = [
  "rwanda verdens hurtigste folkemord",
  "sovjetunionen lenin og stalins danske agent"
];
const expectedScores = ["7,7", "5,9"];
reviewIds.forEach((id, index) => {
  assert.ok(rowById[id], `${id} remains in the canonical source catalogue`);
  assert.equal(String(rowById[id]["Vuring (1-10)"]), expectedScores[index], `${id} keeps its original editorial rating`);
});
assert.equal(rowById["kampen om historien"]?.["Vuring (1-10)"], "5,8", "the Podimo row keeps its existing score");
assert.equal(rowById["kampen om historien"]?.["Podcast-ID"], "kampen om historien", "the existing Podimo ID is unchanged");
assert.equal(rows.filter((row) => row["Podcast-ID"] === "kampen om historien dr").length, 0,
  "the staged DR ID does not collide with the sheet-backed catalogue");
assert.match(app, /"Podcast-ID": "kampen om historien dr"/u, "the new DR parent is local and additive");
assert.match(app, /"Kort beskrivelse": "DR’s historiske podcast om fortidens begivenheder og deres betydning\."/u,
  "the DR fallback short description exactly matches approved staging text");
assert.match(app, /"Lang beskrivelse": "Kampen om historien er DR’s historiske podcast om begivenheder, konflikter og personer, der har sat spor i historien\."/u,
  "the DR fallback long description exactly matches approved staging text");
assert.match(app, /DR_EDITORIAL_REVIEW_PARENT_BY_PODCAST_ID\s*=\s*Object\.freeze\(\{[\s\S]*?"rwanda verdens hurtigste folkemord": "kampen om historien dr"[\s\S]*?"sovjetunionen lenin og stalins danske agent": "kampen om historien dr"/u);
assert.match(app, /function isDrEditorialReviewPodcast\(podcast\)[\s\S]*?state\.podcastById\[parentId\]/u,
  "routing depends on exact IDs and an available parent record");
assert.match(app, /function getRankingCandidates\(\)[\s\S]*?!isDrEditorialReviewPodcast\(podcast\)/u,
  "review records are suppressed from regular ranking candidates");
assert.match(app, /function getOrdinaryPodcastRows\(source = state\.podcasts\)[\s\S]*?return source\.filter\(\(podcast\) => !isDrEditorialReviewPodcast\(podcast\)\)/u,
  "review records are suppressed from other public catalogue lists");
assert.match(app, /data-dr-editorial-review-target=/u, "review links retain an explicit exact-ID target");
assert.match(app, /openPodcastDetailFromModal\(target, editorialReviewButton\)/u,
  "review navigation uses the existing modal history path");
assert.match(app, /getDrEditorialReviewMarkup\(podcast\)/u, "detail view renders the review context");
assert.match(css, /podcast-detail-sheet__dr-editorial-reviews[\s\S]*?focus-visible/u,
  "review links have responsive, keyboard-visible focus styles");
assert.match(proposal, /G123/u);
assert.match(proposal, /G440/u);
assert.match(proposal, /B448.*J448.*L448.*M448.*O448.*X448/u);
assert.match(proposal, /A1371:Y1371/u);
assert.match(proposal, /må aldrig bruges som mål/u);
assert.match(proposal, /Ved manglende ID, flere matches eller én eneste afvigelse: stop uden writes/u);
assert.match(proposal, /ejerens udtrykkelige bekræftelse den 12\.11\.2026 dokumenterer den fulde redaktionelle beslutning/u);
assert.match(proposal, /Adam Holm fortæller om historiske konflikter og begivenheder, der har formet den verden, vi lever i\./u);
assert.match(proposal, /I Styr på historien undersøger Adam Holm historiske konflikter og begivenheder og deres betydning for den verden, vi lever i i dag\./u);
assert.match(proposal, /eksakte ID-søgninger i `V1:V2960` fandt hver af de tre eksisterende ID'er præcis én gang/u);
assert.match(proposal, /asset-UUID er \*\*ikke\*\* Podimo-showets UUID/u);
assert.match(proposal, /Podimo-showets UUID verificeres positivt/u);

const drConfig = FEED_CONFIGS.kampen_om_historien_dr;
assert.equal(drConfig.podcast_key, "kampen om historien dr");
assert.equal(drConfig.expected_rss_channel_title, "Kampen om historien");
assert.equal(drConfig.expected_rss_unique_guids, true, "the feed identity check rejects any duplicate episode GUID before import");
assert.equal(drConfig.enabled, false, "DR feed import remains disabled pending owner approval");
const podimoConfig = FEED_CONFIGS.podimo_styr_pa_historien;
assert.equal(podimoConfig.podcast_key, "kampen om historien");
assert.equal(podimoConfig.enabled, false, "Podimo feed import remains disabled");
assert.equal(podimoConfig.sheet_podimo_identity_required, true);
assert.equal(Object.hasOwn(podimoConfig, "podcast_id"), false, "no unverified Podimo show UUID is guessed");

// #90 can automatically activate only newly added, attested ordinary RSS feeds.
// Both #89 identities already have protected code-owned feed entries; exercise
// the runtime merge with verified-looking Sheet rows to prove they stay inert.
function verifiedSheetRow({ podcastId, title, publisher, feedUrl, officialUrl, catalogueId }) {
  return {
    "Podcast-ID": podcastId, Titel: title, Udgiver: publisher, Feed: feedUrl,
    Link: officialUrl, catalogue_id: catalogueId,
    episodeFeedVerification: {
      version: 1, status: "verified", podcast_id: podcastId, catalogue_id: catalogueId,
      feed_url: feedUrl, official_url: officialUrl, publisher, channel_title: title,
      channel_link: officialUrl, self_url: feedUrl, channel_owner: publisher, unique_guid_count: 3
    }
  };
}
const drOfficialUrl = "https://www.dr.dk/lyd/p1/kampen-om-historien-3166339029000";
const drExactSheetRow = verifiedSheetRow({
  podcastId: "kampen om historien dr", title: "Kampen om historien", publisher: "DR",
  feedUrl: drConfig.feed_url, officialUrl: drOfficialUrl, catalogueId: "dr-kampen-om-historien"
});
const drRuntime = mergeSheetFeedConfigs([drExactSheetRow]);
assert.equal(drRuntime.configs.kampen_om_historien_dr.enabled, false,
  "#90 never enables the exact DR parent even with a complete verified-sheet attestation");
assert.equal(drRuntime.configs.kampen_om_historien_dr.feed_url, drConfig.feed_url,
  "the code-owned DR feed identity remains pinned");
assert.equal(drRuntime.audit.active_feeds.find((feed) => feed.podcast_key === "kampen om historien dr")?.enabled, false);
assert.equal(drRuntime.audit.feed_resolutions.some((entry) =>
  entry.podcast_key === "kampen om historien dr" && entry.origin === "auto_verified"), false,
"the DR parent is excluded from #90 auto_verified routing");
const drCandidateFeedUrl = "https://api.dr.dk/podcasts/v1/feeds/kampen-om-historien-candidate.xml";
const drCandidateRuntime = mergeSheetFeedConfigs([verifiedSheetRow({
  podcastId: "kampen om historien dr", title: "Kampen om historien", publisher: "DR",
  feedUrl: drCandidateFeedUrl, officialUrl: drOfficialUrl, catalogueId: "dr-kampen-om-historien"
})]);
assert.equal(drCandidateRuntime.configs.kampen_om_historien_dr.enabled, false,
  "a verified-looking alternate DR URL cannot activate or replace the protected import");
assert.equal(drCandidateRuntime.configs.kampen_om_historien_dr.feed_url, drConfig.feed_url);
assert.notEqual(drCandidateRuntime.audit.feed_resolutions.find((entry) =>
  entry.podcast_key === "kampen om historien dr")?.origin, "auto_verified");

const fakePodimoShowUrl = "https://open.podimo.com/podcast/00000000-0000-4000-8000-000000000001";
const podimoRuntime = mergeSheetFeedConfigs([verifiedSheetRow({
  podcastId: "kampen om historien", title: "Styr på historien", publisher: "Podimo",
  feedUrl: fakePodimoShowUrl, officialUrl: "https://podimo.com/dk/shows/styr-pa-historien",
  catalogueId: "podimo-styr-pa-historien"
})]);
assert.equal(podimoRuntime.configs.podimo_styr_pa_historien.enabled, false,
  "#90 cannot turn on Podimo from a Sheet UUID, even when its metadata looks attested");
assert.equal(podimoRuntime.configs.podimo_styr_pa_historien.feed_url, podimoConfig.feed_url);
assert.equal(Object.hasOwn(podimoRuntime.configs.podimo_styr_pa_historien, "podcast_id"), false,
  "a Sheet-provided Podimo UUID is never copied into the protected importer");
assert.equal(podimoRuntime.audit.feed_resolutions.some((entry) =>
  entry.podcast_key === "kampen om historien" && entry.origin === "auto_verified"), false,
"Podimo remains outside #90's ordinary-RSS activation path");
const sampleRss = `<rss version="2.0"><channel><title>Kampen om historien</title><item><guid>dr-guid-001</guid><title>Historisk afsnit</title><pubDate>Tue, 10 Nov 2026 08:00:00 GMT</pubDate><itunes:duration>01:00:00</itunes:duration><enclosure url="https://dr.example/episode.mp3" type="audio/mpeg" /></item><item><guid>dr-guid-001</guid><title>Dublet</title><pubDate>Tue, 10 Nov 2026 08:00:00 GMT</pubDate></item><item><guid>dr-guid-002</guid><title>Trailer: Kampen om historien</title><pubDate>Tue, 10 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
const parsedFeed = parseFeed(sampleRss);
const uniqueFeed = { ...parsedFeed, items: parsedFeed.items.filter((_, index) => index !== 1) };
assert.doesNotThrow(() => validateExpectedRssIdentity(uniqueFeed, drConfig), "the configured DR channel identity accepts its exact title and unique GUIDs");
assert.throws(() => validateExpectedRssIdentity({ ...uniqueFeed, channel: { ...uniqueFeed.channel, title: "Styr på historien" } }, drConfig),
  /RSS channel identity mismatch/u, "a similarly titled but different channel fails closed");
assert.throws(() => validateExpectedRssIdentity(parsedFeed, drConfig),
  /RSS duplicate GUID identity mismatch/u, "the DR feed fails identity validation if it repeats an episode GUID");
const mappedFeed = mapEpisodes(parsedFeed, drConfig, "2026-11-11T00:00:00.000Z");
assert.equal(mappedFeed.episodes.filter((episode) => episode.is_active).length, 1, "the DR import mapping preserves one unique rateable full episode");
assert.equal(mappedFeed.episodes[0].podcast_key, "kampen om historien dr");
assert.equal(mappedFeed.errors.filter((entry) => entry.errors.some((message) => /Duplicate GUID/u.test(message))).length, 1,
  "duplicate source GUIDs cannot produce duplicate episode identities");
assert.equal(mappedFeed.episodes.some((episode) => episode.title.includes("Rwanda")), false,
  "an unverified legacy review episode is not synthesized from the current feed");
assert.equal(mappedFeed.episodes.find((episode) => episode.title.startsWith("Trailer"))?.metadata.exclusion_reason, "teaser_or_trailer",
  "the ordinary feed mapper retains its teaser exclusion rule");
for (const feedKey of ["kampen_om_historien_dr", "podimo_styr_pa_historien"]) {
  let repositoryCalls = 0;
  await assert.rejects(runEpisodeImport({
    feedKey,
    repository: new Proxy({}, { get() { repositoryCalls += 1; return async () => { repositoryCalls += 1; }; } }),
    fetchText: async () => { throw new Error("disabled config must not fetch"); },
    fetchPodimo: async () => { throw new Error("disabled config must not fetch"); }
  }), (error) => error.status === 403 && /disabled/u.test(error.message));
  assert.equal(repositoryCalls, 0, `${feedKey} rejects before any production repository write`);
}

const mime = new Map([[".html", "text/html"], [".js", "text/javascript"], [".css", "text/css"], [".json", "application/json"], [".svg", "image/svg+xml"], [".png", "image/png"], [".jpg", "image/jpeg"], [".ico", "image/x-icon"]]);
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const filename = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) throw new Error("invalid path");
    const body = await readFile(filename);
    response.writeHead(200, { "content-type": mime.get(path.extname(filename)) || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(`http://127.0.0.1:${address.port}/`)) return route.continue();
    return route.abort();
  });
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "load" });
  await page.addScriptTag({ content: `
    window.__issue89OpenParent = async () => {
      const source = await fetch('/data/podcasts.json').then((response) => response.json());
      window.__issue89SourceRows = source.rows;
      applyPodcastDataRefresh(source.rows, [], {}, []);
      const parent = state.podcastById['kampen om historien dr'];
      if (!parent || parent.ratingValue != null) throw new Error('DR parent missing or has a score');
      openPodcastDetailSheet(parent, null, { allowDesktop: true });
      return {
        parentId: getPodcastId(parent),
        candidateIds: getRankingCandidates().map(getPodcastId),
        displayedIds: getPublicDisplayPodcasts().map(getPodcastId),
        directChildIds: ${JSON.stringify(reviewIds)}.map((id) => getPodcastId(state.podcastById[id])),
        fuzzyTitleControl: isDrEditorialReviewPodcast({ podcastId: "rwanda verdens hurtigste folkemord extra", title: "Rwanda - verdens hurtigste folkemord" }),
        parentExternalLink: document.querySelector(".podcast-detail-sheet__header-link")?.getAttribute("href"),
        parentSearchText: parent.searchText,
        editorialEpisodeReviews: parent.editorialEpisodeReviews
      };
    };
  ` });
  const fixture = await page.evaluate(() => window.__issue89OpenParent());
  assert.equal(fixture.parentId, "kampen om historien dr");
  for (const id of reviewIds) {
    assert.ok(!fixture.candidateIds.includes(id), `${id} is hidden from regular rankings`);
    assert.ok(!fixture.displayedIds.includes(id), `${id} is hidden from public catalogue lists`);
  }
  assert.deepEqual(fixture.directChildIds, reviewIds, "the original review IDs still resolve directly");
  assert.equal(fixture.fuzzyTitleControl, false, "similar titles never inherit a DR destination without an exact ID");
  assert.equal(fixture.parentExternalLink, "https://www.dr.dk/lyd/p1/kampen-om-historien-3166339029000", "the parent profile keeps the official DR link");
  assert.deepEqual(fixture.editorialEpisodeReviews.map((review) => [review.podcastId, review.ratingValue]), [
    [reviewIds[0], 7.7], [reviewIds[1], 5.9]
  ], "the DR parent stores the two original scores separately and has no aggregated rating");
  assert.ok(fixture.parentSearchText.includes("rwanda - verdens hurtigste folkemord"), "searching a reviewed episode title can find its parent podcast");

  const generatedSheetParent = await page.evaluate(() => {
    const generatedDrRow = {
      "Podcast-ID": "kampen om historien dr",
      Titel: "Kampen om historien",
      Genre: "Historie",
      Udgiver: "DR",
      Link: "https://www.dr.dk/lyd/p1/kampen-om-historien-3166339029000",
      Feed: "https://api.dr.dk/podcasts/v1/feeds/kampen-om-historien-3.xml?format=podcast",
      Billedlink: "https://api.dr.dk/podcasts/v1/images/urn:dr:podcast:image:69b92600196d91f77288ecdc.jpg"
    };
    applyPodcastDataRefresh([...window.__issue89SourceRows, generatedDrRow], [], {}, []);
    const parents = state.podcasts.filter((podcast) => getPodcastId(podcast) === "kampen om historien dr");
    return {
      count: parents.length,
      id: getPodcastId(state.podcastById["kampen om historien dr"]),
      title: state.podcastById["kampen om historien dr"]?.title,
      attachedReviews: state.podcastById["kampen om historien dr"]?.editorialEpisodeReviews?.length
    };
  });
  assert.deepEqual(generatedSheetParent, {
    count: 1,
    id: "kampen om historien dr",
    title: "Kampen om historien",
    attachedReviews: 2
  }, "an exact-ID Sheet-generated DR row replaces the local fallback without duplication or review loss");

  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => openPodcastDetailSheet(state.podcastById["kampen om historien dr"], null, { allowDesktop: true }));
    const layout = await page.evaluate(() => {
      const dialog = document.querySelector("#podcastDetailSheet");
      const content = dialog.querySelector("[data-podcast-detail-content]");
      const section = content.querySelector(".podcast-detail-sheet__dr-editorial-reviews");
      return {
        title: content.querySelector("h2")?.textContent,
        reviewCount: section?.querySelectorAll("[data-dr-editorial-review-target]").length,
        ratings: [...section.querySelectorAll(".podcast-detail-sheet__dr-editorial-review-score")].map((node) => node.textContent.trim()),
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        sectionWidth: section?.getBoundingClientRect().width,
        contentWidth: content.clientWidth
      };
    });
    assert.equal(layout.title, "Kampen om historien");
    assert.equal(layout.reviewCount, 2, `both reviews are visible at ${width}px`);
    assert.deepEqual(layout.ratings, ["7,7/10", "5,9/10"], `source scores remain distinct at ${width}px`);
    assert.ok(layout.scrollWidth <= layout.viewportWidth, `no horizontal viewport overflow at ${width}px`);
    assert.ok(layout.sectionWidth <= layout.contentWidth, `review section fits the detail view at ${width}px`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => openPodcastDetailSheet(state.podcastById["kampen om historien dr"], null, { allowDesktop: true }));
  const firstReview = page.locator("[data-dr-editorial-review-target='rwanda verdens hurtigste folkemord']");
  await firstReview.focus();
  assert.equal(await firstReview.evaluate((node) => node === document.activeElement), true, "review navigation is keyboard focusable");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: rowById[reviewIds[0]].Titel, exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await page.locator("[data-dr-editorial-review-context]").count(), 0,
    "child profile remains a normal directly addressable review record");
  assert.equal(await page.locator(".podcast-detail-sheet__dr-review-context").count(), 1,
    "child profile links back to its DR parent");
  const backToParent = page.locator(".podcast-detail-sheet__dr-review-context button");
  await backToParent.click();
  await page.getByRole("heading", { name: "Kampen om historien" }).waitFor({ timeout: 5000 });
  assert.equal(await page.locator("[data-podcast-detail-modal-back]").isVisible(), true,
    "modal navigation exposes its back control");

  const touchContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const touchPage = await touchContext.newPage();
  await touchPage.route("**/*", (route) => route.request().url().startsWith(`http://127.0.0.1:${address.port}/`) ? route.continue() : route.abort());
  await touchPage.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "load" });
  await touchPage.addScriptTag({ content: `
    window.__issue89OpenParent = async () => {
      const source = await fetch('/data/podcasts.json').then((response) => response.json());
      applyPodcastDataRefresh(source.rows, [], {}, []);
      openPodcastDetailSheet(state.podcastById['kampen om historien dr'], null, { allowDesktop: true });
    };
  ` });
  await touchPage.evaluate(() => window.__issue89OpenParent());
  await touchPage.locator("[data-dr-editorial-review-target='sovjetunionen lenin og stalins danske agent']").tap();
  await touchPage.getByRole("heading", { name: rowById[reviewIds[1]].Titel, exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await touchPage.locator(".podcast-detail-sheet__dr-review-context button").count(), 1,
    "touch navigation keeps the parent link available on mobile");
  await touchPage.evaluate(() => {
    window.scrollTo(0, Math.max(200, document.body.scrollHeight - window.innerHeight));
    window.__issue89PageScrollBeforeOpen = window.scrollY;
  });
  await touchPage.locator("[data-podcast-detail-close]").last().tap();
  await touchPage.waitForFunction(() => document.querySelector("#podcastDetailSheet")?.getAttribute("aria-hidden") === "true", null, { timeout: 5000 });
  assert.equal(await touchPage.evaluate(() => document.body.classList.contains("has-dialog-open")), false,
    "closing the overlay releases the page scroll lock");
  assert.equal(await touchPage.evaluate(() => window.scrollY), await touchPage.evaluate(() => window.__issue89PageScrollBeforeOpen),
    "closing the overlay restores the page scroll position");
  await touchContext.close();
  await context.close();
  console.log("Issue #89 DR/Podimo separation, disabled feeds, original IDs/scores, responsive detail UI and navigation: PASS");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
