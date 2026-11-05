import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");
const index = await readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
assert.match(index, /issue63-homepage-json-cache-v1=1/u, "new loader is deployed at a cache-busted app.js URL");

function extractFunction(name) {
  const start = app.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = app.slice(start + 1).search(/\n(?:async )?function /u);
  return app.slice(start, next === -1 ? app.length : start + 1 + next);
}

function compile(name, dependencies) {
  return new Function(...Object.keys(dependencies), `return (${extractFunction(name)});`)(
    ...Object.values(dependencies)
  );
}

const requests = [];
let cached = null;
const updates = [];
const readCriticalJsonSnapshot = async () => cached;
const writeCriticalJsonSnapshot = async (key, data) => updates.push({ key, data });
const quietConsole = { warn() {} };

let responseData = { rows: [{ "Podcast-ID": 1 }] };
let failNetwork = false;
let criticalFetch = async (url, options) => {
  requests.push({ url, options });
  if (failNetwork) throw new TypeError("offline");
  return { ok: true, json: async () => responseData };
};

const loadCriticalJsonSnapshot = compile("loadCriticalJsonSnapshot", {
  fetch: (...args) => criticalFetch(...args),
  writeCriticalJsonSnapshot,
  readCriticalJsonSnapshot,
  console: quietConsole
});
const validCatalogue = (data) => Array.isArray(data?.rows) && data.rows.length >= 1000;
const makeRows = (length) => ({ rows: Array.from({ length }, (_, index) => ({ "Podcast-ID": index + 1 })) });

responseData = makeRows(1000);
const fresh = await loadCriticalJsonSnapshot({
  url: "/data/podcasts.json?v=test",
  cacheKey: "/data/podcasts.json",
  label: "Podcastkataloget",
  validate: validCatalogue
});
assert.equal(fresh, responseData, "valid online catalogue is returned unchanged");
assert.equal(requests[0].options.cache, "no-cache", "catalogue requests revalidate the HTTP cache");
assert.equal(updates.length, 1, "valid online catalogue still updates the last-known-good snapshot");

cached = makeRows(1001);
failNetwork = true;
const offline = await loadCriticalJsonSnapshot({
  url: "/data/podcasts.json?v=test",
  cacheKey: "/data/podcasts.json",
  label: "Podcastkataloget",
  validate: validCatalogue
});
assert.equal(offline, cached, "offline request keeps the valid last-known-good snapshot");

failNetwork = false;
responseData = makeRows(4);
const fallback = await loadCriticalJsonSnapshot({
  url: "/data/podcasts.json?v=test",
  cacheKey: "/data/podcasts.json",
  label: "Podcastkataloget",
  validate: validCatalogue
});
assert.equal(fallback, cached, "invalid network catalogue falls back to a valid snapshot");

cached = makeRows(3);
await assert.rejects(
  loadCriticalJsonSnapshot({
    url: "/data/podcasts.json?v=test",
    cacheKey: "/data/podcasts.json",
    label: "Podcastkataloget",
    validate: validCatalogue
  }),
  /Podcastkataloget bestod ikke sikkerhedsvalideringen/u,
  "an invalid catalogue cannot replace or bypass the identity-size validation"
);

const loadFeaturedReviewObjectsFromJson = compile("loadFeaturedReviewObjectsFromJson", {
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ rows: [] }) };
  },
  FEATURED_JSON_DATA_URL: "/data/featured-reviews.json",
  DATA_VERSION: "test",
  extractRowsFromJsonPayload: (data) => data.rows
});
await loadFeaturedReviewObjectsFromJson();

responseData = {
  version: 1,
  groups: [{ id: "group-1", title: "Test", representativeMemberLegacyKey: "podcast-1", memberLegacyKeys: ["podcast-1"] }]
};
const loadPodcastDisplayGroups = compile("loadPodcastDisplayGroups", {
  loadCriticalJsonSnapshot,
  PODCAST_DISPLAY_GROUPS_URL: "/data/podcast-display-groups.json",
  DATA_VERSION: "test",
  isValidPodcastDisplayGroupsPayload: (data) => data?.version === 1 && Array.isArray(data.groups),
  normalizeText: (value) => String(value || "").trim()
});
assert.equal((await loadPodcastDisplayGroups()).length, 1);

const loadCoverManifestFromJson = compile("loadCoverManifestFromJson", {
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({}) };
  },
  COVER_MANIFEST_URL: "/data/podcast-cover-manifest.json",
  DATA_VERSION: "test",
  normalizeCoverManifestEntries: (data) => data,
  state: { coverManifestWarningShown: false },
  console: quietConsole
});
await loadCoverManifestFromJson();

assert.deepEqual(
  [requests[0].options.cache, requests.at(-3).options.cache, requests.at(-2).options.cache, requests.at(-1).options.cache],
  ["no-cache", "no-cache", "no-cache", "no-cache"],
  "catalogue, display groups, featured reviews and cover manifest revalidate HTTP cache entries"
);
console.log("Critical catalogue HTTP-cache revalidation and fallback scenarios passed.");
