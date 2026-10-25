import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const desktopCss = await readFile(new URL("../desktop-home-mockup.css", import.meta.url), "utf8");
const siteCss = await readFile(new URL("../style.css", import.meta.url), "utf8");

function extractFunction(name) {
  let start = app.indexOf(`async function ${name}(`);
  if (start < 0) start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const boundaries = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)]
    .filter((index) => index >= 0);
  return app.slice(start, boundaries.length ? Math.min(...boundaries) : app.length);
}

const saveSource = extractFunction("saveActiveRating");
const deleteSource = extractFunction("deleteActiveRating");
const openSource = extractFunction("openRatingDialog");
const ratingSummarySource = extractFunction("getPodcastEpisodeUserRatingSummary");

assert.match(openSource, /await ensurePodcastRatingEditState\(podcast, \{ retry: true, force: true \}\)/u);
assert.match(openSource, /activeRatingRequestToken !== requestToken/u);
assert.match(saveSource, /await ensurePodcastRatingEditState\(podcast, \{ retry: true, force: true \}\)/u);
assert.match(deleteSource, /await ensurePodcastRatingEditState\(podcast, \{ retry: true, force: true \}\)/u);
assert.match(saveSource, /episodeParentRatingEditPendingKeys\.add\(ratingKey\)/u);
assert.match(deleteSource, /episodeParentRatingEditPendingKeys\.add\(deletedKey\)/u);
assert.match(extractFunction("saveActiveEpisodeRating"), /episodeParentRatingEditPendingKeys\.add\(parentRatingKey\)/u);
assert.match(extractFunction("deleteActiveEpisodeRating"), /episodeParentRatingEditPendingKeys\.add\(parentRatingKey\)/u);
assert.match(extractFunction("savePodcastDetailInlineRating"), /await ensurePodcastRatingEditState\(podcast, \{ retry: true, force: true \}\)/u);
assert.match(extractFunction("updatePodcastRatingControls"), /\.desktop-ranking-row__own, \.desktop-ranking-own-score, \.rate-button/u);
assert.match(extractFunction("applyPodcastRatingControlState"), /aria-label/u);
assert.match(desktopCss, /page-ranglister \.desktop-ranking-row__own\.is-episode-rating-locked/u);
assert.match(siteCss, /\.rate-button\.is-episode-rating-locked/u);

function createHarness({ ratingState, input = "8.3", userId = "user-a", onVerify } = {}) {
  const writes = [];
  const state = {
    ratingDialogMode: "podcast",
    authUser: { id: userId },
    activeRatingKey: "podcast-a",
    episodeParentRatingEditPendingKeys: new Set(),
    userRatingsByKey: { "podcast-a": 8.2 },
    userRatingPersistedKeyByCanonical: {}
  };
  const elements = {
    ratingInput: { value: input, disabled: false },
    ratingSaveButton: { disabled: false, textContent: "Gem vurdering" },
    ratingDeleteButton: { disabled: false, classList: { add() {} } }
  };
  const supabase = {
    from(table) {
      return {
        upsert(row) {
          writes.push({ operation: "upsert", table, row });
          return Promise.resolve({ error: null });
        },
        delete() {
          const query = {
            eq(column, value) {
              if (column === "user_id") query.userId = value;
              if (column === "podcast_key") query.podcastKey = value;
              return query;
            },
            then(resolve) {
              writes.push({ operation: "delete", table, userId: query.userId, podcastKey: query.podcastKey });
              resolve({ error: null });
            }
          };
          return query;
        }
      };
    }
  };
  state.supabase = supabase;
  const podcast = { id: "podcast-a", title: "Podcast A", key: "podcast-a" };
  const request = { userId, generation: 0 };
  const messages = [];
  const harness = new Function(
    "state", "elements", "podcast", "writes", "messages", "ratingState", "onVerify",
    "getPodcastRatingEditState", "resolvePodcastByStoredKey", "getPodcastKey", "podcastSupportsEpisodes",
    "getUserScopedRequestContext", "isCurrentUserScopedRequest", "ensurePodcastRatingEditState",
    "getUserRating", "normalizeRatingInputField", "normalizeText", "parseRatingInputValue",
    "getPodcastRatingControlDescription",
    "updateRatingDialogMessage", "setAuthBusy", "getPersistedUserRatingKey", "updateLocalCommunityStatForRating",
    "invalidateExplorePersonalSnapshot", "rebuildUserRanks", "render", "refreshOpenPodcastDetailSheet",
    "setAuthMessage", "closeRatingDialog", "refreshSupabaseState", "console", "formatRatingInputValue",
    "formatCompactRating", "updatePodcastRatingControls", "reconcileExistingEpisodeDerivedParentRating",
    `${saveSource}\n${deleteSource}\nreturn { saveActiveRating, deleteActiveRating };`
  )(
    state, elements, podcast, writes, messages, ratingState, onVerify,
    () => ratingState,
    () => podcast,
    (item) => item.id,
    () => true,
    () => request,
    (candidate) => candidate.userId === state.authUser?.id && candidate.generation === 0,
    async () => {
      await onVerify?.(state);
      return ratingState;
    },
    (key) => state.userRatingsByKey[key] ?? null,
    () => {},
    (value) => String(value).trim(),
    (value) => Number(String(value).replace(",", ".")),
    (item, state) => state.count > 0 ? `Beregnes fra ${state.count} episodevurderinger.` : item.title,
    (message, tone) => messages.push({ message, tone }),
    () => {},
    (key) => key,
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    () => Promise.resolve(),
    { error() {} },
    (value) => String(value).replace(".", ","),
    (value) => String(value).replace(".", ","),
    () => {},
    () => Promise.resolve()
  );
  return { state, elements, writes, messages, request, ratingState, ...harness };
}

async function openRatingHarness({ initialState, finalState, userId = "user-a", onVerify } = {}) {
  const state = { authUser: { id: userId }, activeRatingKey: null, activeRatingRequestToken: 0 };
  const classes = new Set(["is-hidden"]);
  const elements = {
    ratingDialog: {
      classList: { remove: (value) => classes.delete(value) },
      setAttribute() {},
      querySelector: () => ({ focus() {} })
    },
    ratingDialogTitle: {},
    ratingDialogMeta: {},
    ratingInput: { value: "", disabled: false, focus() {}, select() {} },
    ratingSaveButton: { textContent: "", disabled: false },
    ratingDeleteButton: { disabled: false, classList: { toggle() {} } }
  };
  const messages = [];
  const request = { userId, generation: 0 };
  const run = new Function(
    "state", "elements", "messages", "request", "initialState", "finalState", "onVerify",
    "resetRatingDialogMode", "isLoggedIn", "getPodcastKey", "showAuthPrompt", "setAuthMessage",
    "getUserScopedRequestContext", "getPodcastRatingEditState", "getUserRating", "formatRatingInputValue",
    "podcastSupportsEpisodes", "updateRatingDialogMessage", "document", "window",
    "ensurePodcastRatingEditState", "isCurrentUserScopedRequest", "getPodcastRatingControlDescription",
    "reconcileExistingEpisodeDerivedParentRating", "updatePodcastRatingControls",
    `${openSource}; return openRatingDialog;`
  )(
    state, elements, messages, request, initialState, finalState, onVerify,
    () => {},
    () => true,
    (podcast) => podcast.id,
    () => {},
    () => {},
    () => request,
    () => initialState,
    () => 8.3,
    (value) => String(value).replace(".", ","),
    () => true,
    (message, tone) => messages.push({ message, tone }),
    { body: { classList: { add() {} } } },
    { setTimeout: (callback) => callback() },
    async () => {
      await onVerify?.(state);
      return finalState;
    },
    (candidate) => candidate.userId === state.authUser?.id && candidate.generation === 0,
    (_podcast, ratingState) => `Beregnet fra ${ratingState.count} episodevurderinger.`,
    () => Promise.resolve(),
    () => {}
  );
  await run({ id: "podcast-a", title: "Podcast A" });
  return { state, elements, messages };
}

// The rating returned by the episode summary remains authoritative even when
// the user's parent row contains a divergent 8.3 value.
{
  const h = createHarness({ ratingState: { resolved: true, count: 2, average: 8.2 } });
  await h.saveActiveRating();
  assert.equal(h.writes.length, 0, "derived 8.2 blocks an attempted parent write of 8.3");
  assert.equal(h.elements.ratingInput.value, "8,2");
  assert.equal(h.elements.ratingSaveButton.disabled, true);
  assert.match(h.messages.at(-1).message, /beregnes fra 2 episodevurderinger/iu);
}

// Opening the shared dialog starts locked. Only the current, successful check
// decides whether it becomes a read-only episode average or a direct editor.
{
  const locked = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 2, average: 8.2 }
  });
  assert.equal(locked.elements.ratingInput.value, "8,2");
  assert.equal(locked.elements.ratingInput.disabled, true);
  assert.equal(locked.elements.ratingSaveButton.disabled, true);
  assert.match(locked.messages.at(-1).message, /Beregnet fra 2 episodevurderinger/u);

  const editable = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null }
  });
  assert.equal(editable.elements.ratingInput.value, "8,3");
  assert.equal(editable.elements.ratingInput.disabled, false);
  assert.equal(editable.elements.ratingSaveButton.disabled, false);

  const failed = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: false, count: 0, average: null, error: "Databasefejl" }
  });
  assert.equal(failed.elements.ratingInput.disabled, true);
  assert.equal(failed.elements.ratingSaveButton.disabled, true);
  assert.match(failed.messages.at(-1).message, /Databasefejl/u);

  const switched = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null },
    onVerify: (state) => { state.authUser = { id: "user-b" }; }
  });
  assert.equal(switched.elements.ratingInput.disabled, true, "a late response cannot unlock after a user switch");
}

// Without episode ratings direct create/update/delete remains available.
{
  const h = createHarness({ ratingState: { resolved: true, count: 0, average: null } });
  await h.saveActiveRating();
  assert.deepEqual(h.writes[0], {
    operation: "upsert",
    table: "user_ratings",
    row: { user_id: "user-a", podcast_key: "podcast-a", rating: 8.3 }
  });

  const d = createHarness({ ratingState: { resolved: true, count: 0, average: null }, input: "" });
  await d.deleteActiveRating();
  assert.equal(d.writes.length, 1);
  assert.equal(d.writes[0].operation, "delete");
  assert.equal(d.writes[0].userId, "user-a");
}

// A final episode deletion returns the cached summary to zero and restores the
// direct editor. Failure and incomplete reads never grant write permission.
{
  const unlocked = createHarness({ ratingState: { resolved: true, count: 0, average: null } });
  await unlocked.saveActiveRating();
  assert.equal(unlocked.writes.length, 1, "removing the last episode rating re-enables direct rating");

  for (const failed of [
    { resolved: false, count: 0, average: null, error: "Episodevurderingerne kunne ikke hentes lige nu." },
    { resolved: false, count: 0, average: null }
  ]) {
    const h = createHarness({ ratingState: failed });
    await h.saveActiveRating();
    assert.equal(h.writes.length, 0, "unresolved or failed episode reads fail closed");
    assert.equal(h.elements.ratingSaveButton.disabled, true);
  }
}

// Logout/account switch during the episode read cannot use the returned state
// to write for the replacement account.
{
  const h = createHarness({
    ratingState: { resolved: true, count: 0, average: null },
    onVerify: (state) => { state.authUser = { id: "user-b" }; }
  });
  await h.saveActiveRating();
  assert.equal(h.writes.length, 0);
}

// Both direct save and direct delete recheck the same lock; concurrent writes
// share a canonical podcast key and cannot proceed while an episode change owns it.
{
  const h = createHarness({ ratingState: { resolved: true, count: 1, average: 7.5 }, input: "" });
  await h.deleteActiveRating();
  assert.equal(h.writes.length, 0, "parent delete cannot bypass an active episode-derived lock");

  let resumeVerification;
  const concurrent = createHarness({
    ratingState: { resolved: true, count: 0, average: null },
    onVerify: () => new Promise((resolve) => { resumeVerification = resolve; })
  });
  const firstSave = concurrent.saveActiveRating();
  await Promise.resolve();
  await concurrent.deleteActiveRating();
  resumeVerification();
  await firstSave;
  assert.equal(concurrent.writes.filter((write) => write.operation === "upsert").length, 1);
  assert.equal(concurrent.writes.filter((write) => write.operation === "delete").length, 0,
    "a simultaneous parent delete cannot race the first podcast write");
}

// Episode summaries select only the current user's cache. Episode IDs and
// canonical podcast keys are read-only inputs to the aggregate.
{
  const episodeSummaryState = { authUser: { id: "user-a" }, profileEpisodeRatings: { episodeMetaById: {} } };
  const summary = new Function(
    "state", "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeKey",
    "getAppleSeasonEpisodeNumber", "episodeMatchesPodcastSourceBoundary", "parseNumber",
    `${ratingSummarySource}; return getPodcastEpisodeUserRatingSummary;`
  )(
    episodeSummaryState,
    (podcastOrKey) => ({
      items: [{ id: "episode-a", podcast_key: "podcast-a" }, { id: "episode-b", podcast_key: "podcast-a" }],
      searchResults: [], parentEpisodesById: {}, parentUserRatingsResolvedFor: "user-a",
      parentUserRatingsById: { "episode-a": 8, "episode-b": 10 },
      userRatingsById: { "episode-a": episodeSummaryState.authUser.id === "user-a" ? 2 : 3, "episode-b": 4 }
    }),
    () => null,
    (episode) => episode.id,
    () => null,
    () => true,
    (value) => Number(value)
  );
  assert.deepEqual(summary("podcast-a"), { count: 2, average: 9 }, "the resolved current-user parent cache wins");
  episodeSummaryState.authUser.id = "user-b";
  assert.deepEqual(summary("podcast-a"), { count: 2, average: 3.5 }, "another user's cached parent ratings do not count");
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body class="page-ranglister"><main class="ranking-shell">
      <article class="desktop-ranking-row"><span>#1</span><span>Podcast A</span><span>9,1</span>
        <button id="locked" class="desktop-ranking-row__own is-episode-rating-locked" type="button"
          aria-disabled="true" aria-label="Din vurdering af Podcast A er 8,2 af 10 og beregnes fra 2 episodevurderinger. Redigér episodevurderinger for at ændre den. Åbn for forklaring."
          title="Din vurdering er beregnet fra episodevurderinger"><strong>8,2</strong></button></article>
      <p id="help" role="status" hidden></p>
    </main><script>
      document.querySelector('#locked').addEventListener('click', () => {
        const help = document.querySelector('#help'); help.hidden = false;
        help.textContent = 'Din vurdering beregnes fra episodevurderinger. Redigér episodevurderinger for at ændre den.';
      });
    </script></body></html>`);
  await page.addStyleTag({ content: siteCss });
  await page.addStyleTag({ content: desktopCss });
  await page.addStyleTag({ content: `
    * { box-sizing: border-box; }
    body { margin: 0; }
    .ranking-shell { width: 100%; padding: 8px; }
    .desktop-ranking-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 90px 120px; width: 100%; }
    .desktop-ranking-row__own { min-width: 0; }
    @media (max-width: 768px) {
      .desktop-ranking-row { display: grid; grid-template-columns: minmax(0, 1fr) 72px; gap: 8px; }
      .desktop-ranking-row > :nth-child(3) { display: none; }
      .desktop-ranking-row__own { grid-column: 2; grid-row: 1 / span 2; }
    }
  ` });

  for (const width of [1440, 320, 375, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await page.locator("#locked").boundingBox();
    assert.ok(before?.width > 0, `locked rating remains visible at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      `ranking lock creates no horizontal overflow at ${width}px`);
    assert.equal(await page.locator("#locked").getAttribute("aria-disabled"), "true");
    assert.match(await page.locator("#locked").getAttribute("aria-label"), /8,2 af 10[\s\S]*episodevurderinger[\s\S]*Åbn for forklaring/u);
    await page.locator("#locked").focus();
    assert.equal(await page.locator("#locked").evaluate((node) => node === document.activeElement), true,
      `locked rating remains keyboard-focusable at ${width}px`);
    await page.keyboard.press("Enter");
    assert.match(await page.locator("#help").textContent(), /beregnes fra episodevurderinger/u);
    const after = await page.locator("#locked").boundingBox();
    assert.equal(after?.width, before?.width, `locked styling does not alter control width at ${width}px`);
    assert.equal(after?.height, before?.height, `locked styling does not alter control height at ${width}px`);
    await page.locator("#help").evaluate((node) => { node.hidden = true; });
  }
} finally {
  await browser.close();
}

console.log("Ranking episode-rating lock and fail-closed regressions passed.");
