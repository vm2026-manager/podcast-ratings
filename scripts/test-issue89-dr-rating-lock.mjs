import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [app, dataText] = await Promise.all([
  readFile(path.join(root, "app.js"), "utf8"),
  readFile(path.join(root, "data/podcasts.json"), "utf8")
]);
const rows = JSON.parse(dataText).rows;
const drReviewIds = [
  "rwanda verdens hurtigste folkemord",
  "sovjetunionen lenin og stalins danske agent"
];
const reviewRows = Object.fromEntries(rows.filter((row) => drReviewIds.includes(row["Podcast-ID"]))
  .map((row) => [row["Podcast-ID"], row]));
assert.equal(String(reviewRows[drReviewIds[0]]?.["Vuring (1-10)"].replace(",", ".")), "7.7");
assert.equal(String(reviewRows[drReviewIds[1]]?.["Vuring (1-10)"].replace(",", ".")), "5.9");
assert.match(app, /"kampen om historien dr":\s*\{[\s\S]*?databasePodcastKey: "kampen om historien dr"[\s\S]*?ownRatingMode: "episode-derived"/u,
  "the exact DR parent ID resolves to its own episode database key and the shared derived-rating model");
assert.match(app, /"magten":\s*\{[\s\S]*?ownRatingMode: "episode-derived"/u,
  "DR and Magten use the same configured rating model");
assert.match(app, /episodeConfig\?\.ownRatingMode === "episode-derived"[\s\S]*?return;\s*\}/u,
  "episode-derived rating synchronization does not write or mutate the direct podcast rating");

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const filename = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) throw new Error("invalid path");
    const body = await readFile(filename);
    const mime = path.extname(filename) === ".js" ? "text/javascript" :
      path.extname(filename) === ".css" ? "text/css" :
      path.extname(filename) === ".json" ? "application/json" : "text/html";
    response.writeHead(200, { "content-type": mime });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true });

const fixtureScript = `
  (() => {
    const fixture = window.__issue89RatingFixture = {
      importedEpisodes: [], episodeRatings: [], userRatings: new Map(), writes: [], queries: [], failEpisodeQuery: false
    };
    fixture.fakeSupabase = {
      from(table) {
        const query = { table, filters: [], operation: "select", payload: null };
        query.select = () => query;
        query.eq = (column, value) => { query.filters.push([column, value]); return query; };
        query.upsert = (payload) => {
          fixture.writes.push({ table, operation: "upsert", payload: structuredClone(payload) });
          if (table === "user_ratings") fixture.userRatings.set(payload.user_id + "|" + payload.podcast_key, payload.rating);
          return Promise.resolve({ error: null });
        };
        query.delete = () => { query.operation = "delete"; return query; };
        query.then = (resolve, reject) => {
          fixture.queries.push({ table, filters: structuredClone(query.filters) });
          if (table === "episode_ratings") {
            if (fixture.failEpisodeQuery) return Promise.resolve({ data: null, error: new Error("offline") }).then(resolve, reject);
            const filters = Object.fromEntries(query.filters);
            const data = fixture.episodeRatings.filter((row) =>
              row.user_id === filters.user_id &&
              row.podcast_episodes.podcast_key === filters["podcast_episodes.podcast_key"] &&
              row.podcast_episodes.is_active === filters["podcast_episodes.is_active"]
            );
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          }
          if (table === "user_ratings" && query.operation === "delete") {
            const filters = Object.fromEntries(query.filters);
            fixture.writes.push({ table, operation: "delete", filters });
            fixture.userRatings.delete(filters.user_id + "|" + filters.podcast_key);
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        };
        return query;
      }
    };
    window.refreshSupabaseStatePreservingCurrentUserState = async () => {};
    window.refreshSupabaseState = async () => {};
    window.__issue89Setup = async (userId, directRating, podcastId = "kampen om historien dr") => {
      const source = await fetch("/data/podcasts.json").then((response) => response.json());
      state.podcastEpisodesByKey = {};
      state.authUser = { id: userId };
      state.userScopedRequestGeneration = (state.userScopedRequestGeneration || 0) + 1;
      state.supabase = fixture.fakeSupabase;
      state.userRatingsByKey[podcastId] = directRating;
      fixture.userRatings.set(userId + "|" + podcastId, directRating);
      applyPodcastDataRefresh(source.rows, [], {}, []);
      const parent = state.podcastById[podcastId];
      if (!parent || podcastId === "kampen om historien dr" && parent.ratingValue != null) throw new Error("podcast parent identity/score is wrong");
      await fetchPodcastEpisodeParentRatings(parent, { force: true });
      return {
        id: getPodcastId(parent),
        databaseKey: getEpisodeDatabasePodcastKey(parent),
        editorialReviewScores: ${JSON.stringify(drReviewIds)}.map((id) => state.podcastById[id]?.ratingValue),
        ratingState: getPodcastDetailEpisodeRatingState(parent)
      };
    };
    window.__issue89RateFixtureEpisode = (userId, episodeId, rating, podcastId = "kampen om historien dr") => {
      fixture.episodeRatings.push({
        user_id: userId,
        episode_id: episodeId,
        rating,
        podcast_episodes: { podcast_key: podcastId, is_active: true, source: "dr", description: "", metadata: {} }
      });
    };
  })();
`;

async function createPage({ width = 1280, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.on("pageerror", (error) => { throw error; });
  page.on("console", (message) => { if (message.type() === "error") void 0; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "load" });
  await page.addScriptTag({ content: fixtureScript });
  return { context, page };
}

try {
  const { context, page } = await createPage();

  // Before any imported episode exists, the direct rating remains editable.
  const initial = await page.evaluate(() => window.__issue89Setup("user-a", 8.4));
  assert.equal(initial.id, "kampen om historien dr", "the exact parent ID is used");
  assert.equal(initial.databaseKey, "kampen om historien dr", "episode rows are queried by the exact parent podcast_key");
  assert.deepEqual(initial.editorialReviewScores, [7.7, 5.9], "editorial review scores are not episode ratings or a parent total");
  assert.deepEqual(initial.ratingState, { resolved: true, error: "", count: 0, average: null });
  await page.evaluate(() => openPodcastDetailSheet(state.podcastById["kampen om historien dr"], null, { allowDesktop: true }));
  const editor = page.locator("[data-podcast-detail-inline-rating-input]");
  await editor.waitFor({ state: "visible" });
  await editor.fill("9.1");
  await editor.press("Enter");
  await page.waitForFunction(() => window.__issue89RatingFixture.userRatings.get("user-a|kampen om historien dr") === 9.1);
  assert.equal(await page.evaluate(() => state.userRatingsByKey["kampen om historien dr"]), 9.1,
    "a user with zero episode ratings can save a direct podcast rating");

  // Episode import alone does not lock direct rating; only this user's ratings do.
  const importOnly = await page.evaluate(async () => {
    const fixture = window.__issue89RatingFixture;
    fixture.importedEpisodes = ["dr-ep-1", "dr-ep-2"];
    await fetchPodcastEpisodeParentRatings(state.podcastById["kampen om historien dr"], { force: true });
    updatePodcastDetailOwnRatingCell(document.getElementById("podcastDetailSheet"), state.podcastById["kampen om historien dr"]);
    return getPodcastDetailEpisodeRatingState(state.podcastById["kampen om historien dr"]);
  });
  assert.deepEqual(importOnly, { resolved: true, error: "", count: 0, average: null },
    "having imported episodes without a personal episode rating still allows direct rating");

  // B has a saved direct rating. Add B's first two episode ratings, then resolve
  // the same parent query that Magten uses. Neither DB nor local direct rating may change.
  const secondUser = await page.evaluate(() => window.__issue89Setup("user-b", 8.6));
  assert.equal(secondUser.ratingState.count, 0, "another user's episode data cannot carry over to this user");
  await page.evaluate(() => window.__issue89RateFixtureEpisode("user-b", "dr-ep-1", 6.4));
  await page.evaluate(async () => fetchPodcastEpisodeParentRatings(state.podcastById["kampen om historien dr"], { force: true }));
  const oneEpisode = await page.evaluate(() => {
    const parent = state.podcastById["kampen om historien dr"];
    const ratingCell = document.querySelector(".podcast-detail-sheet__rating-cell--own");
    updatePodcastDetailOwnRatingCell(document.getElementById("podcastDetailSheet"), parent);
    return {
      state: getPodcastDetailEpisodeRatingState(parent),
      directRating: state.userRatingsByKey["kampen om historien dr"],
      storedRating: window.__issue89RatingFixture.userRatings.get("user-b|kampen om historien dr"),
      queryKey: window.__issue89RatingFixture.queries.at(-1).filters.find(([column]) => column === "podcast_episodes.podcast_key")?.[1],
      inputDisabled: ratingCell.querySelector("[data-podcast-detail-inline-rating-input]")?.disabled,
      saveButtonCount: ratingCell.querySelectorAll("[data-podcast-detail-inline-rating-save]").length
    };
  });
  assert.deepEqual(oneEpisode.state, { resolved: true, error: "", count: 1, average: 6.4 });
  assert.equal(oneEpisode.directRating, 8.6, "the direct rating in local state is preserved while locked");
  assert.equal(oneEpisode.storedRating, 8.6, "the stored direct rating is not overwritten by the episode rating");
  assert.equal(oneEpisode.queryKey, "kampen om historien dr", "the episode-rating lookup uses the exact DR parent key");
  assert.equal(oneEpisode.inputDisabled, true, "the direct editor is locked after the user's first episode rating");
  assert.equal(oneEpisode.saveButtonCount, 0, "locked markup exposes no direct save action");
  const writesBeforeLock = await page.evaluate(() => window.__issue89RatingFixture.writes.length);
  await page.evaluate(async () => {
    const input = { value: "9.8" };
    await savePodcastDetailInlineRating(
      document.getElementById("podcastDetailSheet"), state.podcastById["kampen om historien dr"], input, null
    );
    await synchronizeEpisodeDerivedParentRating("kampen om historien dr", 8.6, { refreshUi: false });
    await reconcileExistingEpisodeDerivedParentRating("kampen om historien dr");
  });
  assert.equal(await page.evaluate(() => window.__issue89RatingFixture.writes.length), writesBeforeLock,
    "verifying/locking episode-derived own rating performs no user_ratings database writes");
  assert.equal(await page.evaluate(() => state.userRatingsByKey["kampen om historien dr"]), 8.6,
    "episode synchronization never mutates the cached direct podcast rating");

  await page.evaluate(() => window.__issue89RateFixtureEpisode("user-b", "dr-ep-2", 7.6));
  const twoEpisodes = await page.evaluate(async () => {
    const parent = state.podcastById["kampen om historien dr"];
    await fetchPodcastEpisodeParentRatings(parent, { force: true });
    return getPodcastDetailEpisodeRatingState(parent);
  });
  assert.deepEqual(twoEpisodes, { resolved: true, error: "", count: 2, average: 7 },
    "the displayed own score is the average of this user's episode ratings");

  // User A is not locked by user B. Deleting B's last episode rating restores
  // B's original direct score without a restore/upsert/delete to user_ratings.
  const userAScope = await page.evaluate(async () => {
    state.authUser = { id: "user-a" };
    state.userScopedRequestGeneration += 1;
    state.userRatingsByKey["kampen om historien dr"] = window.__issue89RatingFixture.userRatings.get("user-a|kampen om historien dr");
    await fetchPodcastEpisodeParentRatings(state.podcastById["kampen om historien dr"], { force: true });
    updatePodcastDetailOwnRatingCell(document.getElementById("podcastDetailSheet"), state.podcastById["kampen om historien dr"]);
    return {
      ratingState: getPodcastDetailEpisodeRatingState(state.podcastById["kampen om historien dr"]),
      directRating: getUserRatingForPodcast(state.podcastById["kampen om historien dr"]),
      queryUser: window.__issue89RatingFixture.queries.at(-1).filters.find(([column]) => column === "user_id")?.[1],
      editable: canEditPodcastDetailInlineRating(state.podcastById["kampen om historien dr"])
    };
  });
  assert.equal(userAScope.ratingState.count, 0, "episode ratings from user B do not affect user A");
  assert.equal(userAScope.directRating, 9.1);
  assert.equal(userAScope.queryUser, "user-a");
  assert.equal(userAScope.editable, true, "user A can continue rating the podcast");

  const writesBeforeDelete = await page.evaluate(() => window.__issue89RatingFixture.writes.length);
  const unlocked = await page.evaluate(async () => {
    const fixture = window.__issue89RatingFixture;
    state.authUser = { id: "user-b" };
    state.userScopedRequestGeneration += 1;
    state.userRatingsByKey["kampen om historien dr"] = fixture.userRatings.get("user-b|kampen om historien dr");
    fixture.episodeRatings = fixture.episodeRatings.filter((row) => row.user_id !== "user-b");
    await fetchPodcastEpisodeParentRatings(state.podcastById["kampen om historien dr"], { force: true });
    updatePodcastDetailOwnRatingCell(document.getElementById("podcastDetailSheet"), state.podcastById["kampen om historien dr"]);
    return {
      ratingState: getPodcastDetailEpisodeRatingState(state.podcastById["kampen om historien dr"]),
      directRating: state.userRatingsByKey["kampen om historien dr"],
      storedRating: fixture.userRatings.get("user-b|kampen om historien dr"),
      editable: canEditPodcastDetailInlineRating(state.podcastById["kampen om historien dr"])
    };
  });
  assert.equal(unlocked.ratingState.count, 0, "removing the last episode rating clears the episode-derived lock");
  assert.equal(unlocked.directRating, 8.6, "the original direct score reappears from unchanged local state");
  assert.equal(unlocked.storedRating, 8.6, "the original direct score remains unchanged in storage");
  assert.equal(unlocked.editable, true, "the direct score can be edited again after the last episode rating is removed");
  assert.equal(await page.evaluate(() => window.__issue89RatingFixture.writes.length), writesBeforeDelete,
    "removing the last episode rating needs no parent-rating restore write");

  // Both loading and failure keep direct writes closed until the current user's
  // exact parent query has resolved.
  const safety = await page.evaluate(async () => {
    const fixture = window.__issue89RatingFixture;
    const parent = state.podcastById["kampen om historien dr"];
    const episodeState = getPodcastEpisodeState(parent);
    episodeState.parentUserRatingsResolvedFor = "";
    episodeState.parentUserRatingsLoading = true;
    const loadingCanEdit = canEditPodcastDetailInlineRating(parent);
    const writes = fixture.writes.length;
    await savePodcastDetailInlineRating(document.getElementById("podcastDetailSheet"), parent, { value: "9.9" }, null);
    const loadingWrites = fixture.writes.length - writes;
    episodeState.parentUserRatingsLoading = false;
    fixture.failEpisodeQuery = true;
    await fetchPodcastEpisodeParentRatings(parent, { force: true });
    updatePodcastDetailOwnRatingCell(document.getElementById("podcastDetailSheet"), parent);
    const failedCanEdit = canEditPodcastDetailInlineRating(parent);
    const beforeFailedSave = fixture.writes.length;
    await savePodcastDetailInlineRating(document.getElementById("podcastDetailSheet"), parent, { value: "9.9" }, null);
    return {
      loadingCanEdit,
      loadingWrites,
      failedCanEdit,
      failedWrites: fixture.writes.length - beforeFailedSave,
      directRating: state.userRatingsByKey["kampen om historien dr"],
      error: episodeState.parentUserRatingsError
    };
  });
  assert.equal(safety.loadingCanEdit, false, "unverified/loading scope cannot open writes");
  assert.equal(safety.loadingWrites, 0);
  assert.equal(safety.failedCanEdit, false, "a failed user-scoped query remains locked");
  assert.equal(safety.failedWrites, 0);
  assert.equal(safety.directRating, 8.6);
  assert.match(safety.error, /kunne ikke hentes/u);

  // Verify fit on requested mobile/tablet/desktop widths with the live detail modal.
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => {
      const episodeState = getPodcastEpisodeState("kampen om historien dr");
      episodeState.parentUserRatingsError = "";
      episodeState.parentUserRatingsResolvedFor = state.authUser.id;
      episodeState.parentUserRatingsById = {};
      openPodcastDetailSheet(state.podcastById["kampen om historien dr"], null, { allowDesktop: true });
    });
    await page.waitForFunction(() => document.querySelector("#podcastDetailSheet")?.getAttribute("aria-hidden") === "false");
    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      dialogWidth: document.querySelector("#podcastDetailSheet [data-podcast-detail-content]")?.getBoundingClientRect().width,
      directEditor: Boolean(document.querySelector("[data-podcast-detail-inline-rating-input]")),
      modalOpen: document.body.classList.contains("has-dialog-open")
    }));
    assert.ok(layout.scrollWidth <= layout.viewportWidth, `no horizontal overflow at ${width}px`);
    assert.ok(layout.dialogWidth <= width, `the detail modal fits at ${width}px`);
    assert.equal(layout.directEditor, true, `zero episode ratings retain direct editor at ${width}px`);
    assert.equal(layout.modalOpen, true, `detail modal is open at ${width}px`);
  }

  await context.close();

  // Run the same state transitions against Magten's exact database key. This
  // proves that the configuration is shared behavior, not a DR-only branch.
  const magtenPage = await createPage();
  const magten = await magtenPage.page.evaluate(() => window.__issue89Setup("magten-a", 8.2, "magten"));
  assert.equal(magten.id, "magten");
  assert.equal(magten.databaseKey, "magten");
  assert.equal(magten.ratingState.count, 0);
  await magtenPage.page.evaluate(() => openPodcastDetailSheet(state.podcastById.magten, null, { allowDesktop: true }));
  const magtenEditor = magtenPage.page.locator("[data-podcast-detail-inline-rating-input]");
  await magtenEditor.waitFor({ state: "visible" });
  await magtenEditor.fill("8.4");
  await magtenEditor.press("Enter");
  await magtenPage.page.waitForFunction(() => window.__issue89RatingFixture.userRatings.get("magten-a|magten") === 8.4);

  await magtenPage.page.evaluate(() => window.__issue89RateFixtureEpisode("magten-b", "magten-other-user-ep", 5.1, "magten"));
  const magtenOtherUser = await magtenPage.page.evaluate(async () => {
    await fetchPodcastEpisodeParentRatings(state.podcastById.magten, { force: true });
    return { own: getPodcastDetailEpisodeRatingState(state.podcastById.magten), editable: canEditPodcastDetailInlineRating(state.podcastById.magten) };
  });
  assert.equal(magtenOtherUser.own.count, 0, "another Magten user's episode rating does not lock this user");
  assert.equal(magtenOtherUser.editable, true);

  await magtenPage.page.evaluate(() => window.__issue89RateFixtureEpisode("magten-a", "magten-own-ep", 6.6, "magten"));
  const magtenLocked = await magtenPage.page.evaluate(async () => {
    const parent = state.podcastById.magten;
    await fetchPodcastEpisodeParentRatings(parent, { force: true });
    updatePodcastDetailOwnRatingCell(document.getElementById("podcastDetailSheet"), parent);
    const episodeState = getPodcastEpisodeState(parent);
    return {
      own: getPodcastDetailEpisodeRatingState(parent),
      displayedOwnRating: getUserRatingForPodcast(parent),
      direct: state.userRatingsByKey.magten,
      stored: window.__issue89RatingFixture.userRatings.get("magten-a|magten"),
      edit: canEditPodcastDetailInlineRating(parent),
      queryKey: window.__issue89RatingFixture.queries.at(-1).filters.find(([column]) => column === "podcast_episodes.podcast_key")?.[1],
      episodeState
    };
  });
  assert.deepEqual(magtenLocked.own, { resolved: true, error: "", count: 1, average: 6.6 });
  assert.equal(magtenLocked.displayedOwnRating, 6.6, "the episode average is surfaced as Magten's current user's score");
  assert.equal(magtenLocked.direct, 8.4);
  assert.equal(magtenLocked.stored, 8.4);
  assert.equal(magtenLocked.edit, false);
  assert.equal(magtenLocked.queryKey, "magten");
  const magtenWritesAtLock = await magtenPage.page.evaluate(() => window.__issue89RatingFixture.writes.length);
  await magtenPage.page.evaluate(async () => {
    await synchronizeEpisodeDerivedParentRating("magten", 8.4, { refreshUi: false });
    await reconcileExistingEpisodeDerivedParentRating("magten");
  });
  assert.equal(await magtenPage.page.evaluate(() => window.__issue89RatingFixture.writes.length), magtenWritesAtLock,
    "Magten episode locking also preserves direct-rating storage without upserts or deletes");

  const magtenUnlocked = await magtenPage.page.evaluate(async () => {
    window.__issue89RatingFixture.episodeRatings = window.__issue89RatingFixture.episodeRatings
      .filter((row) => row.user_id !== "magten-a");
    await fetchPodcastEpisodeParentRatings(state.podcastById.magten, { force: true });
    return {
      own: getPodcastDetailEpisodeRatingState(state.podcastById.magten),
      direct: getUserRatingForPodcast(state.podcastById.magten),
      editable: canEditPodcastDetailInlineRating(state.podcastById.magten)
    };
  });
  assert.equal(magtenUnlocked.own.count, 0);
  assert.equal(magtenUnlocked.direct, 8.4);
  assert.equal(magtenUnlocked.editable, true, "the last Magten episode rating can be removed and direct editing resumes");
  const magtenSafety = await magtenPage.page.evaluate(async () => {
    const parent = state.podcastById.magten;
    const episodeState = getPodcastEpisodeState(parent);
    episodeState.parentUserRatingsResolvedFor = "";
    episodeState.parentUserRatingsLoading = true;
    const loading = canEditPodcastDetailInlineRating(parent);
    episodeState.parentUserRatingsLoading = false;
    window.__issue89RatingFixture.failEpisodeQuery = true;
    await fetchPodcastEpisodeParentRatings(parent, { force: true });
    return { loading, error: canEditPodcastDetailInlineRating(parent), direct: state.userRatingsByKey.magten };
  });
  assert.deepEqual(magtenSafety, { loading: false, error: false, direct: 8.4 });
  await magtenPage.context.close();

  // Real coarse-pointer tap, keyboard activation and focus behavior on the
  // existing inline editor and modal; no new visual controls are introduced.
  const touch = await createPage({ width: 375, mobile: true });
  await touch.page.evaluate(() => window.__issue89Setup("user-a", 9.1));
  await touch.page.evaluate(() => openPodcastDetailSheet(state.podcastById["kampen om historien dr"], null, { allowDesktop: true }));
  const reveal = touch.page.locator("[data-podcast-detail-inline-rating-reveal]");
  await reveal.waitFor({ state: "visible" });
  await touch.page.touchscreen.tap(...await reveal.boundingBox().then(({ x, y, width, height }) => [x + width / 2, y + height / 2]));
  const focused = await touch.page.locator("[data-podcast-detail-inline-rating-input]").evaluate((input) => input === document.activeElement);
  assert.equal(focused, true, "touching the rating control focuses the input");
  const input = touch.page.locator("[data-podcast-detail-inline-rating-input]");
  await input.fill("9.2");
  await input.press("Enter");
  await touch.page.waitForFunction(() => window.__issue89RatingFixture.userRatings.get("user-a|kampen om historien dr") === 9.2);
  await touch.page.evaluate(() => {
    window.scrollTo(0, Math.max(200, document.body.scrollHeight - innerHeight));
    window.__issue89ScrollBefore = window.scrollY;
  });
  await touch.page.locator("[data-podcast-detail-close]").last().tap();
  await touch.page.waitForFunction(() => document.querySelector("#podcastDetailSheet")?.getAttribute("aria-hidden") === "true");
  assert.equal(await touch.page.evaluate(() => document.body.classList.contains("has-dialog-open")), false,
    "closing the modal releases the scroll lock");
  assert.equal(await touch.page.evaluate(() => window.scrollY), await touch.page.evaluate(() => window.__issue89ScrollBefore),
    "closing the modal restores scroll position");
  await touch.context.close();

  console.log("Issue #89 exact DR parent rating model, user scope, direct-rating preservation, failure lock, delete-unlock and responsive interaction: PASS");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
