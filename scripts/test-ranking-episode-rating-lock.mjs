import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
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
assert.match(extractFunction("applyPodcastRatingControlState"), /removeAttribute\("aria-disabled"\)/u);
assert.match(extractFunction("applyPodcastRatingControlState"), /is-rating-checking/u);
assert.match(extractFunction("applyPodcastRatingControlState"), /is-rating-check-error/u);
assert.match(extractFunction("applyPodcastRatingControlState"), /ratingState\.resolved && ratingState\.count > 0/u,
  "only a resolved episode-derived rating may apply the ranking lock");
assert.match(extractFunction("applyPodcastRatingControlState"), /Tjekker…/u,
  "unresolved checks must be visibly temporary instead of showing an empty locked score");
assert.match(extractFunction("getPodcastRatingControlDescription"), /mislykkedes[\s\S]*prøve igen/u,
  "a failed check must explain how to retry from the control");
assert.match(extractFunction("setEpisodeDerivedRatingDialog"), /ratingSaveButton/u);
assert.match(extractFunction("setEpisodeDerivedRatingDialog"), /episodevurderinger/u);
assert.match(extractFunction("resetRatingDialogMode"), /rating-dialog--episode-derived/u);
assert.match(app, /event\.key === "Tab"[\s\S]*rating-dialog--episode-derived/u);
assert.match(html, /id="ratingDialogEpisodeSummary"[\s\S]*id="ratingDialogEpisodeScore"[\s\S]*id="ratingDialogEpisodeExplanation"/u);
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
  const derivedViews = [];
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

async function openRatingHarness({
  initialState, finalState, userId = "user-a", onVerify, deferVerification = false,
  podcastId = "podcast-a", getUserRating = () => 8.3, supportsEpisodes = true
} = {}) {
  const state = { authUser: { id: userId }, activeRatingKey: null, activeRatingRequestToken: 0 };
  const classes = new Set(["is-hidden"]);
  const derivedViews = [];
  const timers = [];
  const focusCalls = [];
  const selectCalls = [];
  let activeElement = null;
  let resolveVerification;
  const documentProxy = {
    get activeElement() { return activeElement; },
    body: { classList: { add() {} } }
  };
  const elements = {
    ratingDialog: {
      classList: {
        add: (value) => classes.add(value),
        remove: (value) => classes.delete(value),
        contains: (value) => classes.has(value)
      },
      setAttribute() {},
      querySelector: () => ({ focus() {} })
    },
    ratingDialogTitle: {},
    ratingDialogMeta: {},
    ratingInput: {
      value: "", disabled: false,
      focus(options) { focusCalls.push(options); activeElement = this; },
      select() { selectCalls.push(this.value); }
    },
    ratingSaveButton: { textContent: "", disabled: false },
    ratingDeleteButton: { disabled: false, classList: { toggle() {} } },
    ratingCancelButton: { textContent: "", focus() {} },
    ratingCloseButton: { focus() {}, classList: { add() {}, remove() {} } },
    ratingDialogEpisodeSummary: { classList: { add() {}, remove() {} } },
    ratingDialogEpisodeScore: { textContent: "" },
    ratingDialogEpisodeExplanation: { textContent: "" },
    ratingDialogMessage: { classList: { add() {}, remove() {} } }
  };
  const messages = [];
  const request = { userId, generation: 0 };
  const run = new Function(
    "state", "elements", "messages", "request", "initialState", "finalState", "onVerify",
    "resetRatingDialogMode", "isLoggedIn", "getPodcastKey", "showAuthPrompt", "setAuthMessage",
    "getUserScopedRequestContext", "getPodcastRatingEditState", "getUserRating", "formatRatingInputValue",
    "podcastSupportsEpisodes", "updateRatingDialogMessage", "document", "window",
    "ensurePodcastRatingEditState", "isCurrentUserScopedRequest", "getPodcastRatingControlDescription",
    "reconcileExistingEpisodeDerivedParentRating", "updatePodcastRatingControls", "setEpisodeDerivedRatingDialog",
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
    getUserRating,
    (value) => String(value).replace(".", ","),
    () => supportsEpisodes,
    (message, tone) => messages.push({ message, tone }),
    documentProxy,
    { setTimeout: (callback) => timers.push(callback) },
    async () => {
      if (deferVerification) {
        await new Promise((resolve) => { resolveVerification = resolve; });
      }
      await onVerify?.(state);
      return finalState;
    },
    (candidate) => candidate.userId === state.authUser?.id && candidate.generation === 0,
    (_podcast, ratingState) => `Beregnet fra ${ratingState.count} episodevurderinger.`,
    () => Promise.resolve(),
    () => {},
    (_podcast, ratingState, status) => derivedViews.push({ ratingState, status })
  );
  const runPromise = run({ id: podcastId, title: `Podcast ${podcastId}` });
  if (!deferVerification) await runPromise;
  return {
    state, elements, messages, derivedViews, timers, focusCalls, selectCalls,
    get activeElement() { return activeElement; },
    runPromise,
    releaseVerification: () => resolveVerification?.()
  };
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
  assert.deepEqual(locked.derivedViews.map((view) => view.status), ["loading", "ready"]);
  assert.equal(locked.derivedViews.at(-1).ratingState.average, 8.2,
    "the verified score shown in the read-only view is the episode-derived 8.2");

  const editable = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null }
  });
  assert.equal(editable.elements.ratingInput.value, "8,3");
  assert.equal(editable.elements.ratingInput.disabled, false);
  assert.equal(editable.elements.ratingSaveButton.disabled, false);
  assert.equal(editable.focusCalls.length, 1, "the verified direct editor receives focus immediately");
  assert.equal(editable.activeElement, editable.elements.ratingInput, "focus lands on the rating input after verification");
  assert.deepEqual(editable.selectCalls, ["8,3"], "the existing score is selected for replacement");
  editable.timers[0]();
  assert.equal(editable.elements.ratingInput.value, "8,3", "the delayed opening timer preserves the current score");
  assert.deepEqual(editable.selectCalls, ["8,3"], "the timer does not select the score a second time");

  const emptyEditable = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null },
    getUserRating: () => null
  });
  assert.equal(emptyEditable.elements.ratingInput.value, "");
  assert.equal(emptyEditable.focusCalls.length, 1, "an empty editor is ready for immediate typing");
  assert.equal(emptyEditable.activeElement, emptyEditable.elements.ratingInput);
  assert.equal(emptyEditable.selectCalls.length, 0, "an empty field is not selected");

  const editableWithoutEpisodes = await openRatingHarness({
    initialState: { resolved: true, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null },
    supportsEpisodes: false
  });
  editableWithoutEpisodes.timers[0]();
  assert.equal(editableWithoutEpisodes.focusCalls.length, 1, "a normal editable dialog focuses after opening");
  assert.deepEqual(editableWithoutEpisodes.selectCalls, ["8,3"]);

  const delayedOpeningTimer = await openRatingHarness({
    initialState: { resolved: true, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null },
    supportsEpisodes: false
  });
  delayedOpeningTimer.elements.ratingInput.value = "7,4";
  delayedOpeningTimer.timers[0]();
  assert.equal(delayedOpeningTimer.elements.ratingInput.value, "7,4", "the delayed timer preserves an in-progress score");
  assert.equal(delayedOpeningTimer.focusCalls.length, 0, "the delayed timer leaves the user's active editing state alone");

  const typedDuringVerification = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null },
    deferVerification: true
  });
  typedDuringVerification.elements.ratingInput.value = "7,9";
  typedDuringVerification.elements.ratingInput.focus();
  typedDuringVerification.releaseVerification();
  await typedDuringVerification.runPromise;
  assert.equal(typedDuringVerification.elements.ratingInput.value, "7,9", "verification preserves text entered while pending");
  assert.deepEqual(typedDuringVerification.selectCalls, [], "verification never selects text the user has started entering");

  const closedDuringVerification = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null },
    deferVerification: true
  });
  closedDuringVerification.elements.ratingDialog.classList.add("is-hidden");
  closedDuringVerification.state.activeRatingRequestToken += 1;
  closedDuringVerification.state.activeRatingKey = null;
  closedDuringVerification.releaseVerification();
  await closedDuringVerification.runPromise;
  assert.equal(closedDuringVerification.focusCalls.length, 0, "late verification cannot focus a closed dialog");

  const switchedPodcastDuringVerification = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null },
    deferVerification: true
  });
  switchedPodcastDuringVerification.state.activeRatingRequestToken += 1;
  switchedPodcastDuringVerification.state.activeRatingKey = "podcast-b";
  switchedPodcastDuringVerification.releaseVerification();
  await switchedPodcastDuringVerification.runPromise;
  assert.equal(switchedPodcastDuringVerification.focusCalls.length, 0, "late verification cannot focus another podcast's dialog");

  const failed = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: false, count: 0, average: null, error: "Databasefejl" }
  });
  assert.equal(failed.elements.ratingInput.disabled, true);
  assert.equal(failed.elements.ratingSaveButton.disabled, true);
  assert.match(failed.derivedViews.at(-1).ratingState.error, /Databasefejl/u);
  assert.deepEqual(failed.derivedViews.map((view) => view.status), ["loading", "error"]);

  const switched = await openRatingHarness({
    initialState: { resolved: false, count: 0, average: null },
    finalState: { resolved: true, count: 0, average: null },
    onVerify: (state) => { state.authUser = { id: "user-b" }; }
  });
  assert.equal(switched.elements.ratingInput.disabled, true, "a late response cannot unlock after a user switch");
  assert.equal(switched.focusCalls.length, 0, "a late response after a user switch cannot move focus");
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

// Enter keeps using the shared save path; its synchronous pending-key gate
// accepts one write even if the same input produces duplicate key events.
{
  assert.match(app, /elements\.ratingInput\?\.addEventListener\("keydown", \(event\) => \{[\s\S]{0,180}event\.preventDefault\(\);\s*saveActiveRating\(\);/u);
  const h = createHarness({ ratingState: { resolved: true, count: 0, average: null } });
  await Promise.all([h.saveActiveRating(), h.saveActiveRating()]);
  assert.equal(h.writes.filter((write) => write.operation === "upsert").length, 1,
    "duplicate Enter submissions cannot create duplicate rating writes");
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
          aria-label="Din vurdering af Podcast A er 8,2 af 10 og beregnes fra 2 episodevurderinger. Redigér episodevurderinger for at ændre den. Åbn for forklaring."
          title="Din vurdering er beregnet fra episodevurderinger"><strong>8,2</strong></button></article>
      <p id="help" role="status" hidden></p>
      <div id="ratingDialog" class="rating-dialog rating-dialog--episode-derived is-hidden" aria-hidden="true">
        <div class="rating-dialog__backdrop"></div>
        <section class="rating-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="ratingDialogTitle">
          <h2 id="ratingDialogTitle">Hva så?!</h2><p class="rating-dialog__meta">Podcast</p>
          <section class="rating-dialog__episode-summary" aria-labelledby="ratingDialogEpisodeScoreLabel">
            <p id="ratingDialogEpisodeScoreLabel">Din beregnede vurdering</p>
            <p class="rating-dialog__episode-score">8,2 / 10</p>
            <p class="rating-dialog__episode-explanation" role="status" aria-live="polite">Beregnet fra 2 episodevurderinger. Vurderingen kan kun ændres ved at redigere dine episodevurderinger.</p>
          </section>
          <label class="rating-dialog__field is-hidden"><span>Vælg score</span><input id="ratingInput"></label>
          <p class="rating-dialog__hint is-hidden">Standardtekst</p>
          <p id="ratingDialogMessage" class="rating-dialog__message is-hidden"></p>
          <div class="rating-dialog__actions">
            <button id="ratingDeleteButton" class="is-hidden">Fjern vurdering</button>
            <button id="ratingCancelButton">Luk</button>
            <button id="ratingSaveButton" class="is-hidden">Opdater vurdering</button>
          </div>
        </section>
      </div>
    </main><script>
      document.querySelector('#locked').addEventListener('click', () => {
        const help = document.querySelector('#help'); help.hidden = false;
        help.textContent = 'Din vurdering beregnes fra episodevurderinger. Redigér episodevurderinger for at ændre den.';
      });
      document.addEventListener('keydown', event => {
        const dialog = document.querySelector('#ratingDialog');
        if (event.key === 'Tab' && !dialog.classList.contains('is-hidden') && dialog.classList.contains('rating-dialog--episode-derived')) {
          event.preventDefault(); document.querySelector('#ratingCancelButton').focus();
        }
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
    assert.equal(await page.locator("#locked").getAttribute("aria-disabled"), null,
      "an actionable control that opens an explanation is not marked aria-disabled");
    assert.match(await page.locator("#locked").getAttribute("aria-label"), /8,2 af 10[\s\S]*episodevurderinger[\s\S]*Åbn for forklaring/u);
    await page.locator("#locked").focus();
    assert.equal(await page.locator("#locked").evaluate((node) => node === document.activeElement), true,
      `locked rating remains keyboard-focusable at ${width}px`);
    await page.keyboard.press("Enter");
    assert.match(await page.locator("#help").textContent(), /beregnes fra episodevurderinger/u);
    await page.locator("#ratingDialog").evaluate((node) => node.classList.remove("is-hidden"));
    const visibleDialogButtons = page.locator("#ratingDialog button:visible");
    assert.equal(await visibleDialogButtons.count(), 1, "the information view exposes only the close action");
    assert.equal(await visibleDialogButtons.first().textContent(), "Luk");
    assert.equal(await page.locator("#ratingDialog input:visible").count(), 0);
    assert.equal(await page.locator("#ratingDialog .rating-dialog__hint:visible").count(), 0);
    assert.match(await page.locator(".rating-dialog__episode-explanation").textContent(), /2 episodevurderinger[\s\S]*redigere dine episodevurderinger/u);
    await page.locator("#ratingCancelButton").focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "ratingCancelButton",
      `keyboard focus stays on the only close action at ${width}px`);
    await page.locator("#ratingDialog").evaluate((node) => node.classList.add("is-hidden"));
    const after = await page.locator("#locked").boundingBox();
    assert.equal(after?.width, before?.width, `locked styling does not alter control width at ${width}px`);
    assert.equal(after?.height, before?.height, `locked styling does not alter control height at ${width}px`);
    await page.locator("#help").evaluate((node) => { node.hidden = true; });
  }
} finally {
  await browser.close();
}

console.log("Ranking episode-rating lock and fail-closed regressions passed.");
