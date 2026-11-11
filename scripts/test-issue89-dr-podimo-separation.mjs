import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mapEpisodes, parseFeed, runEpisodeImport, validateExpectedRssIdentity } from "../supabase/functions/import-podcast-episodes/core.ts";

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
assert.match(proposal, /bekræftede, at redaktionel score `5,8` tilhører Podimos/u);
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
