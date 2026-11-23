import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { validatePodcastIdentityContinuity } from "./podcast-identity-integrity.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url)));
const oldId = "borgen unplugged";
const currentId = "borgen unplugged 2 0";
const title = "Borgen Unplugged";
const byId = (id) => catalogue.rows.find((row) => row["Podcast-ID"] === id);
assert.equal(byId(oldId)?.catalogue_id, "catalogue-v1-9db52a31");
assert.equal(byId(currentId)?.catalogue_id, "catalogue-v1-689d27f8");
assert.equal(byId(currentId)?.Feed, "https://feeds.soundcloud.com/users/soundcloud:users:154832827/sounds.rss");

const stagedCatalogue = {
  ...catalogue,
  rows: catalogue.rows.map((row) => {
    // An older catalogue cache may predate the archive marker.
    if (row["Podcast-ID"] === oldId) return { ...row, Uaktuel: "" };
    if (row["Podcast-ID"] === currentId) return { ...row, Titel: title };
    return row;
  })
};
const clusters = JSON.parse(await readFile(new URL("../data/explore-clusters.json", import.meta.url)));
const stagedClusters = {
  ...clusters,
  clusters: clusters.clusters.map((cluster) => cluster.id === "christiansborg-magt-spin"
    ? { ...cluster, podcastIds: [...new Set([...cluster.podcastIds, oldId])] }
    : cluster)
};
assert.ok(stagedClusters.clusters.find((cluster) => cluster.id === "christiansborg-magt-spin")
  .podcastIds.includes(currentId));
const continuity = validatePodcastIdentityContinuity({
  previousRows: catalogue.rows,
  candidateRows: stagedCatalogue.rows,
  ratedPodcastKeys: [currentId]
});
assert.equal(continuity.ok, true, continuity.errors.join("\n"));
const server = spawn("python3", ["-u", "-m", "http.server", "0", "--bind", "127.0.0.1"], {
  cwd: root,
  stdio: ["ignore", "pipe", "ignore"]
});
let browser;
try {
  const [output] = await Promise.race([
    once(server.stdout, "data"),
    once(server, "exit").then(([code]) => { throw new Error(`Fixture server exited with ${code}`); })
  ]);
  const port = output.toString().match(/port (\d+)/)?.[1];
  assert.ok(port, "fixture server announced its port");
  const origin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch();
  for (const width of [320, 375, 390, 768, 1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 768 });
    try {
      await page.route(/^https?:/u, (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === "/data/podcasts.json") return route.fulfill({ json: stagedCatalogue });
        if (url.pathname === "/data/explore-clusters.json") return route.fulfill({ json: stagedClusters });
        return route.continue();
      });
      const open = async (hash, id) => {
        const url = new URL("/", origin);
        if (id) url.searchParams.set("podcast", id);
        url.hash = hash;
        await page.goto(url.href, { waitUntil: "domcontentloaded" });
        await page.waitForFunction((ids) => ids.every((key) => state.podcastById[key]), [oldId, currentId]);
      };
      async function checkWidth(label) {
        const layout = await page.evaluate(() => ({
          root: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth
        }));
        assert.ok(layout.root <= layout.viewport, `${width}px ${label}: ${JSON.stringify(layout)}`);
      }
      await open("forside");
      await checkWidth("forside");
      assert.equal(await page.evaluate(() => loadPodcastSimilarityProductData()), true);
      assert.equal(await page.evaluate(() => loadExploreClusterIntegration()), true);
      const identity = await page.evaluate(([oldKey, currentKey]) => {
        const old = state.podcastById[oldKey];
        const current = state.podcastById[currentKey];
        const selectBorgen = (items) => items.map(getPodcastId).filter((id) => id === oldKey || id === currentKey);
        const rank = getRankingCandidates().map(getPodcastId);
        const publicIds = getPublicDisplayPodcasts().map(getPodcastId);
        const withHistorical = (getItems) => {
          const flag = old.uaktuel;
          old.uaktuel = "";
          try { return getItems().map(getPodcastId).filter((id) => id !== oldKey); }
          finally { old.uaktuel = flag; }
        };
        const config = getEpisodePodcastConfig(current);
        const recommendations = (podcast) => getPodcastDetailRecommendations(podcast).map(({ item }) => getPodcastId(item.podcast));
        const ratingKey = getEpisodeParentRatingKey(currentKey);
        const oldRecommendationId = state.podcastSimilarityRecommendationIdByPodcastKey[oldKey];
        const currentRecommendationId = state.podcastSimilarityRecommendationIdByPodcastKey[currentKey];
        const previousProduct = state.podcastSimilarityProductByRecommendationId[currentRecommendationId];
        const staleCandidate = { existingId: oldKey, recommendationId: oldRecommendationId, title: old.title };
        state.podcastSimilarityProductByRecommendationId[currentRecommendationId] = {
          ...previousProduct,
          similarResults: [staleCandidate, ...previousProduct.similarResults],
          automaticSimilarResults: [staleCandidate, ...previousProduct.automaticSimilarResults],
          manualSupplementaryResults: [staleCandidate, ...previousProduct.manualSupplementaryResults]
        };
        const staleProductVisible = getValidatedPodcastSimilarityProduct(current).similar
          .some(({ podcast }) => getPodcastId(podcast) === oldKey);
        const staleExploreVisible = getExploreProductSimilarityItems({ podcast: current })
          .some(({ podcast }) => getPodcastId(podcast) === oldKey);
        const recommendationsWithStaleProduct = recommendations(current);
        state.podcastSimilarityProductByRecommendationId[currentRecommendationId] = previousProduct;

        const priorRatings = state.userRatingsByKey;
        const priorSaved = state.savedPodcastKeys;
        const priorUser = state.authUser;
        state.userRatingsByKey = { [oldKey]: 10, [currentKey]: 9, dkpol: 9, slotsholmen: 9 };
        state.savedPodcastKeys = new Set([oldKey]);
        state.authUser = { id: "borgen-public-discovery-test" };
        const profile = getExplorePreferenceProfile();
        const exploreSeeds = selectBorgen(getExploreSeedPodcasts().map(({ podcast }) => podcast));
        const clusterSections = getExploreClusterSections();
        const clusterVisible = clusterSections.some((section) =>
          section.seedPodcastIds.includes(oldKey) || selectBorgen(section.items.map(({ podcast }) => podcast)).includes(oldKey)
        );

        const snapshotKey = { dayKey: "test", fingerprint: "test" };
        const publicItems = [state.podcastById.dkpol, state.podcastById.slotsholmen, current]
          .map((podcast) => ({ podcast }));
        persistExplorePersonalSnapshot([
          { title: "Arkivseed", seedPodcastKey: oldKey, items: publicItems },
          { title: "Gyldig seed", seedPodcastKey: currentKey, items: [{ podcast: old }, ...publicItems] }
        ], snapshotKey);
        const snapshot = readExplorePersonalSnapshot(snapshotKey);
        state.userRatingsByKey = priorRatings;
        state.savedPodcastKeys = priorSaved;
        state.authUser = priorUser;
        return {
          titles: [old.title, current.title],
          scores: [old.ratingValue, current.ratingValue],
          ids: [old, current].map((item) => getPodcastId(findPodcastByCatalogueId(item.catalogueId))),
          ambiguous: Object.hasOwn(state.podcastByLegacyKey, oldKey),
          stored: [oldKey, currentKey].map((key) => getPodcastId(resolvePodcastByStoredKey(key))),
          search: selectBorgen(getHeaderSearchMatches("Borgen Unplugged").map(({ podcast }) => podcast)),
          ranking: selectBorgen(getRankingCandidates()),
          publicCards: selectBorgen(getPublicDisplayPodcasts()),
          explore: [matchesExploreFilters(old), matchesExploreFilters(current)],
          cluster: state.exploreClustersPayload.clusters.find((item) => item.id === "christiansborg-magt-spin")
            .podcastIds.filter((key) => key === oldKey || key === currentKey),
          productIdentities: [oldKey, currentKey].map((key) =>
            getPodcastId(state.podcastSimilarityPodcastByRecommendationId[
              state.podcastSimilarityRecommendationIdByPodcastKey[key]
            ])),
          unrelatedRankings: JSON.stringify(rank) === JSON.stringify(withHistorical(getRankingCandidates)),
          unrelatedCards: JSON.stringify(publicIds) === JSON.stringify(withHistorical(getPublicDisplayPodcasts)),
          episodeKeys: [old, oldKey, current, currentKey].map(getEpisodePodcastKey),
          config: [config.podcastKey, config.databasePodcastKey, config.displayName],
          oldHasEpisodes: Boolean(getEpisodePodcastConfig(old)),
          ratings: [resolveCanonicalPodcastId(oldKey), resolveCanonicalPodcastId(currentKey), ratingKey],
          recommendations: [recommendations(old), recommendationsWithStaleProduct, recommendations(state.podcastById.dkpol)],
          internalManualLinks: getCatalogueManualSupplementaryPodcasts(current).map(getPodcastId),
          staleProductVisible,
          staleExploreVisible,
          fallbackVisible: getPodcastDetailFallbackRecommendations(current, new Set(), new Set())
            .some(({ item }) => getPodcastId(item.podcast) === oldKey),
          exploreSeeds,
          ratingSeeds: selectBorgen(profile.ratingSeeds.map(({ podcast }) => podcast)),
          savedSeeds: selectBorgen(profile.savedSeeds.map(({ podcast }) => podcast)),
          clusterVisible,
          snapshot: snapshot?.map((section) => [section.title, selectBorgen(section.items.map(({ podcast }) => podcast))])
        };
      }, [oldId, currentId]);
      assert.deepEqual(identity.titles, [title, title]);
      assert.deepEqual(identity.scores, [8, 7.8]);
      assert.deepEqual(identity.ids, [oldId, currentId]);
      assert.deepEqual(identity.stored, [oldId, currentId]);
      assert.equal(identity.ambiguous, false);
      assert.deepEqual(identity.search, [currentId]);
      assert.deepEqual(identity.ranking, [currentId]);
      assert.deepEqual(identity.publicCards, [currentId]);
      assert.deepEqual(identity.explore, [false, true]);
      assert.deepEqual(identity.cluster, [currentId, oldId], "fixture includes a stale cluster entry");
      assert.deepEqual(identity.productIdentities, [oldId, currentId]);
      assert.equal(identity.unrelatedRankings, true);
      assert.equal(identity.unrelatedCards, true);
      assert.deepEqual(identity.episodeKeys, [oldId, oldId, currentId, currentId]);
      assert.deepEqual(identity.config, [currentId, currentId, title]);
      assert.equal(identity.oldHasEpisodes, false);
      assert.deepEqual(identity.ratings, [oldId, currentId, currentId]);
      assert.deepEqual(identity.recommendations[0], []);
      assert.ok(identity.recommendations[1].length > 0);
      assert.ok(identity.recommendations[2].includes(currentId));
      assert.ok(identity.recommendations.every((ids) => !ids.includes(oldId)));
      assert.ok(identity.internalManualLinks.includes(oldId));
      assert.equal(identity.staleProductVisible, false);
      assert.equal(identity.staleExploreVisible, false);
      assert.equal(identity.fallbackVisible, false);
      assert.deepEqual(identity.exploreSeeds, [currentId]);
      assert.deepEqual(identity.ratingSeeds, [currentId]);
      assert.deepEqual(identity.savedSeeds, []);
      assert.equal(identity.clusterVisible, false);
      assert.deepEqual(identity.snapshot, [["Gyldig seed", [currentId]]]);

      for (const route of ["ranglister", "udforsk"]) {
        await open(route);
        await checkWidth(route);
      }
      const titleHeading = page.locator("#podcastDetailTitle");
      const host = page.locator("#podcastDetailSheet .podcast-detail-sheet__meta");
      for (const [id, hostPattern] of [[oldId, /Thomas Qvortrup/], [currentId, /Martin Flink/]]) {
        await open("forside", id);
        await titleHeading.waitFor({ state: "visible" });
        assert.equal(await titleHeading.textContent(), title);
        assert.match(await host.first().textContent(), hostPattern);
        await checkWidth(id);
        if (id === oldId) assert.equal(await page.locator("[data-podcast-similarity-product]").count(), 0);
      }
      const relatedCards = page.locator("[data-podcast-similarity-podcast-key]");
      await relatedCards.first().waitFor({ state: "visible" });
      assert.equal(await page.locator('[data-podcast-similarity-podcast-key="borgen unplugged"]').count(), 0);
      const relatedId = await relatedCards.first().getAttribute("data-podcast-similarity-podcast-key");
      if (width <= 768) await relatedCards.first().tap();
      else await relatedCards.first().press("Enter");
      await page.waitForFunction((id) => state.activePodcastDetailKey === id, relatedId);
      await page.locator("[data-podcast-detail-modal-back]").click();
      await page.waitForFunction(() => state.activePodcastDetailKey === "borgen unplugged 2 0");
      const episodeButton = page.locator("[data-podcast-episodes-open]").first();
      if (width <= 768) await episodeButton.tap();
      else await episodeButton.press("Enter");
      const search = page.locator("[data-episode-workspace-search]");
      await search.waitFor({ state: "visible" });
      assert.equal(await search.getAttribute("placeholder"), "Søg i Borgen Unplugged-episoder");
      await checkWidth("episoder");
      await page.locator("[data-podcast-episode-overview-back]").click();
      await titleHeading.waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await titleHeading.waitFor({ state: "hidden" });
      console.log(`Borgen catalogue, routes and overlay at ${width}px passed`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  server.kill();
}
