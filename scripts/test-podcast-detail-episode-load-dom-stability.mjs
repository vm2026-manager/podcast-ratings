import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

const detailRenderer = extractFunction("renderPodcastDetailSheetContent");
const completionHandler = extractFunction("handlePodcastDetailEpisodeLoadCompletion");
const workspaceRenderer = extractFunction("renderPodcastEpisodeOverviewContent");

const episodeLoadCompletion = detailRenderer.slice(
  detailRenderer.indexOf("fetchGenstartEpisodes().then(() =>"),
  detailRenderer.indexOf("updatePodcastDetailRankingNavigation(dialog);")
);
assert.match(episodeLoadCompletion, /handlePodcastDetailEpisodeLoadCompletion\(dialog, podcast\);/u);
assert.doesNotMatch(
  episodeLoadCompletion,
  /refreshOpenPodcastDetailSheet\(\);/u,
  "episode-load completion must not rebuild the open detail sheet"
);
assert.doesNotMatch(completionHandler, /innerHTML|outerHTML|replaceChildren|renderPodcastDetailSheetContent/u);
assert.match(completionHandler, /state\.podcastDetailView === "episodes"/u);
assert.match(completionHandler, /updatePodcastEpisodeOverview\(dialog\);/u);
assert.match(workspaceRenderer, /fetchGenstartEpisodes\(\)\.then\(\(\) => updatePodcastEpisodeOverview\(dialog\)\)/u);

const createCompletionHandler = new Function(
  "state",
  "getPodcastKey",
  "updatePodcastEpisodeOverview",
  "updatePodcastDetailOwnRatingCell",
  `${completionHandler}; return handlePodcastDetailEpisodeLoadCompletion;`
);

for (const podcast of [
  { key: "shop21 dk bitcoin samfund frihed", kind: "generic-feed" },
  { key: "genstart", kind: "explicit-config" },
  { key: "empty-or-error", kind: "empty-or-error" }
]) {
  const stableDom = {
    mainCover: { id: `${podcast.kind}-main-cover` },
    recommendationContainer: { id: `${podcast.kind}-recommendations` }
  };
  const dialog = {
    isConnected: true,
    classList: { contains: () => false },
    stableDom
  };
  const updates = [];
  const ownUpdates = [];
  const handler = createCompletionHandler(
    { activePodcastDetailKey: podcast.key, podcastDetailView: "detail" },
    (value) => value.key,
    (...args) => updates.push(args),
    (...args) => ownUpdates.push(args)
  );

  const beforeMainCover = dialog.stableDom.mainCover;
  const beforeRecommendations = dialog.stableDom.recommendationContainer;
  handler(dialog, podcast);

  assert.strictEqual(dialog.stableDom.mainCover, beforeMainCover, `${podcast.kind}: main cover node remains stable`);
  assert.strictEqual(
    dialog.stableDom.recommendationContainer,
    beforeRecommendations,
    `${podcast.kind}: recommendation container remains stable`
  );
  assert.deepEqual(updates, [], `${podcast.kind}: detail completion does not rerender episode rows`);
  assert.deepEqual(ownUpdates, [[dialog, podcast]], `${podcast.kind}: detail completion updates only the own-rating cell`);
}

{
  const dialog = { isConnected: true, classList: { contains: () => false } };
  const updates = [];
  const handler = createCompletionHandler(
    { activePodcastDetailKey: "shop21 dk bitcoin samfund frihed", podcastDetailView: "episodes" },
    (podcast) => podcast.key,
    (...args) => updates.push(args),
    () => assert.fail("episode workspace must not replace the own-rating cell")
  );
  handler(dialog, { key: "shop21 dk bitcoin samfund frihed" });
  assert.deepEqual(updates, [[dialog]], "the open episode workspace receives its narrow row update");
}

console.log("Podcast detail episode-load DOM-stability regression checks passed.");
