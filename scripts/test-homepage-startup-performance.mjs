import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(
  fileURLToPath(new URL("../app.js", import.meta.url)),
  "utf8"
);

function extractFunction(name) {
  const start = app.search(new RegExp(`(?:async\\s+)?function ${name}\\(`));
  assert.ok(start >= 0, `${name} must exist`);
  const next = app.slice(start + 1).search(/\n(?:async\s+)?function\s/u);
  return app.slice(start, next < 0 ? app.length : start + 1 + next);
}

const visibilitySource = extractFunction("isHomeHeroCoverInitiallyVisible");
const isVisible = new Function(
  "window",
  `${visibilitySource}\nreturn isHomeHeroCoverInitiallyVisible;`
)({ innerWidth: 1280, innerHeight: 900 });
const rect = (values) => ({ getBoundingClientRect: () => values });
assert.equal(
  isVisible(rect({ left: 500, right: 700, top: 100, bottom: 400, width: 200, height: 300 })),
  true,
  "an in-viewport desktop hero card can receive eager image loading"
);
for (const outside of [
  { left: 1300, right: 1500, top: 100, bottom: 400, width: 200, height: 300 },
  { left: 500, right: 700, top: 950, bottom: 1250, width: 200, height: 300 },
  { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }
]) {
  assert.equal(
    isVisible(rect(outside)),
    false,
    "off-screen and hidden carousel covers retain lazy loading"
  );
}
assert.match(
  extractFunction("setHomeHeroCover"),
  /image\.loading = prioritizeImage \? "eager" : "lazy"/u,
  "only initially visible hero images bypass native lazy-loading"
);
assert.match(
  extractFunction("setHomeHeroCover"),
  /image\.fetchPriority = prioritizeImage && cover\.dataset\.homeHeroSlot === "0" \? "high" : "auto"/u,
  "only the first visible cover receives high fetch priority"
);

const heroCacheSource = extractFunction("getHomeHeroPodcasts");
const heroState = {
  podcasts: [],
  podcastDisplayGroups: [],
  podcastDetailPublicItemByPodcastKey: {},
  podcastDisplayGroupById: {}
};
let topPoolCalls = 0;
const cachedHeroSelection = new Function(
  "state",
  "HOME_HERO_COVER_COUNT",
  "HOME_HERO_POOL_LIMIT",
  "getExploreHourBucket",
  "getPodcastlistenTopPodcasts",
  "selectRotatingItems",
  `let cachedHomeHeroPodcasts = null;\n${heroCacheSource}\nreturn getHomeHeroPodcasts;`
)(
  heroState,
  12,
  150,
  () => "hour-1",
  () => {
    topPoolCalls += 1;
    return ["podcast-a", "podcast-b"];
  },
  (items, count, options) => ({ items, count, options })
);
const firstHeroSelection = cachedHeroSelection("hour-1");
assert.equal(cachedHeroSelection("hour-1"), firstHeroSelection);
assert.equal(topPoolCalls, 1, "unchanged homepage data does not repeat the expensive top-podcast sort");
cachedHeroSelection("hour-2");
assert.equal(topPoolCalls, 2, "a new rotation hour recomputes the selected hero covers");
heroState.podcasts = [];
cachedHeroSelection("hour-2");
assert.equal(topPoolCalls, 3, "a refreshed catalogue invalidates the hero selection cache");

const criticalSnapshotSources = [
  extractFunction("readCriticalJsonSnapshot"),
  extractFunction("writeCriticalJsonSnapshot"),
  extractFunction("loadCriticalJsonSnapshot")
].join("\n");

function makeSnapshotLoader({ fetchImpl, cachedResponse = null, putImpl, cachesAvailable = true }) {
  const warnings = [];
  let putCalls = 0;
  let lastSnapshot = cachedResponse?.clone() || null;
  const cache = {
    async match() {
      return lastSnapshot?.clone() || null;
    },
    async put(request, response) {
      putCalls += 1;
      if (putImpl) await putImpl(request, response);
      lastSnapshot = response.clone();
    }
  };
  const window = {
    location: { href: "https://podcastlisten.dk/" },
    ...(cachesAvailable ? { caches: { open: async () => cache } } : {})
  };
  const loader = new Function(
    "window",
    "fetch",
    "Request",
    "Response",
    "URL",
    "CRITICAL_CATALOGUE_CACHE_NAME",
    "console",
    `${criticalSnapshotSources}\nreturn loadCriticalJsonSnapshot;`
  )(
    window,
    fetchImpl,
    Request,
    Response,
    URL,
    "podcastlisten-critical-catalogue-v1",
    { warn: (...args) => warnings.push(args) }
  );
  return {
    loader,
    warnings,
    async getSnapshot() { return lastSnapshot?.clone() || null; },
    get putCalls() { return putCalls; }
  };
}

const validCatalogue = { version: 1, podcasts: [{ "Podcast-ID": "bevar-denne" }] };
const oldCatalogue = { version: 1, podcasts: [{ "Podcast-ID": "sidste-kendte-gode" }] };
const validResponse = () => new Response(JSON.stringify(validCatalogue), {
  headers: { "content-type": "application/json" }
});

let releaseWrite;
let announceWrite;
const writeStarted = new Promise((resolve) => { announceWrite = resolve; });
let committedResponse = null;
const delayedCache = makeSnapshotLoader({
  fetchImpl: async (_url, options) => {
    assert.equal(options.cache, "no-cache", "the catalogue still revalidates after Sheets sync");
    return validResponse();
  },
  cachedResponse: new Response(JSON.stringify(oldCatalogue)),
  putImpl: (_request, response) => {
    announceWrite();
    return new Promise((resolve) => { releaseWrite = resolve; }).then(() => {
      committedResponse = response.clone();
    });
  }
});
const pendingWriteLoad = delayedCache.loader({
  url: "data/podcasts.json?v=test",
  cacheKey: "data/podcasts.json",
  label: "Podcastkataloget",
  validate: (payload) => payload?.version === 1 && Array.isArray(payload.podcasts)
});
const loadedBeforeCacheCommit = await Promise.race([
  pendingWriteLoad,
  new Promise((_, reject) => setTimeout(() => reject(new Error("render waited for CacheStorage.put")), 100))
]);
assert.deepEqual(loadedBeforeCacheCommit, validCatalogue);
await writeStarted;
assert.equal(delayedCache.putCalls, 1, "the validated snapshot is still written to CacheStorage");
assert.deepEqual(
  await (await delayedCache.getSnapshot()).json(),
  oldCatalogue,
  "the previous last-known-good snapshot remains intact until the new cache.put commits"
);
releaseWrite();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(committedResponse, "the asynchronous write eventually commits the new last-known-good snapshot");
assert.deepEqual(await (await delayedCache.getSnapshot()).json(), validCatalogue);

const offlineLoader = makeSnapshotLoader({
  fetchImpl: async () => { throw new TypeError("offline"); },
  cachedResponse: new Response(JSON.stringify(oldCatalogue))
});
assert.deepEqual(await offlineLoader.loader({
  url: "data/podcasts.json?v=test",
  cacheKey: "data/podcasts.json",
  label: "Podcastkataloget",
  validate: (payload) => payload?.version === 1 && Array.isArray(payload.podcasts)
}), oldCatalogue, "offline startup uses the last-known-good validated snapshot");

const invalidNetworkLoader = makeSnapshotLoader({
  fetchImpl: async () => new Response("{", { headers: { "content-type": "application/json" } }),
  cachedResponse: new Response(JSON.stringify(oldCatalogue))
});
assert.deepEqual(await invalidNetworkLoader.loader({
  url: "data/podcasts.json?v=test",
  cacheKey: "data/podcasts.json",
  label: "Podcastkataloget",
  validate: (payload) => payload?.version === 1 && Array.isArray(payload.podcasts)
}), oldCatalogue, "invalid network JSON never replaces the last-known-good catalogue");

const failedCacheLoader = makeSnapshotLoader({
  fetchImpl: async () => validResponse(),
  putImpl: async () => { throw new Error("quota exceeded"); }
});
assert.deepEqual(await failedCacheLoader.loader({
  url: "data/podcasts.json?v=test",
  cacheKey: "data/podcasts.json",
  label: "Podcastkataloget",
  validate: (payload) => payload?.version === 1 && Array.isArray(payload.podcasts)
}), validCatalogue, "a CacheStorage write failure does not block valid network data");

const unavailableSnapshotLoader = makeSnapshotLoader({
  fetchImpl: async () => { throw new TypeError("offline"); },
  cachesAvailable: false
});
await assert.rejects(unavailableSnapshotLoader.loader({
  url: "data/podcasts.json?v=test",
  cacheKey: "data/podcasts.json",
  label: "Podcastkataloget",
  validate: (payload) => payload?.version === 1 && Array.isArray(payload.podcasts)
}), /offline/u, "offline startup without a last-known-good snapshot fails safely");

console.log("Homepage startup cache, cover-priority, and hero-selection regressions passed.");
