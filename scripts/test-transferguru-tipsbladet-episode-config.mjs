import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");
const configStart = app.indexOf("const MEDIANO_EPISODE_DESTINATIONS");
const configEnd = app.indexOf("const MANUAL_CATALOGUE_SOURCE", configStart);
assert.ok(configStart >= 0 && configEnd > configStart, "episode config manifest exists");

const podcasts = new Map([
  ["transferguru tipsbladet", { podcastId: "transferguru tipsbladet", title: "Transferguru" }],
  ["transferguru", { podcastId: "transferguru", title: "Transferguru", Feed: "Apple:1843557403" }],
  ["transfer talk", { podcastId: "transfer talk", title: "Transfer Talk" }]
]);
const context = {
  Object,
  URL,
  normalizeText: (value) => String(value ?? "").trim().toLowerCase(),
  normalizeMatchKey: (value) => String(value ?? "").trim().toLowerCase(),
  EPISODE_DATABASE_KEY_ALIASES: {},
  getPodcastId: (podcast) => String(podcast?.podcastId ?? "").trim().toLowerCase(),
  getEpisodePodcastKey: (value) => typeof value === "object"
    ? String(value?.podcastId ?? "").trim().toLowerCase()
    : String(value ?? "").trim().toLowerCase(),
  getDisplayGroupEpisodeSeason: () => null,
  resolvePodcastByStoredKey: (key) => podcasts.get(String(key ?? "").toLowerCase()) || null,
  state: { activePodcastDetailKey: "" }
};
context.globalThis = context;
const configSource = app.slice(configStart, configEnd)
  .replace("const MEDIANO_EPISODE_DESTINATIONS", "globalThis.MEDIANO_EPISODE_DESTINATIONS")
  .replace("const MEDIANO_EPISODE_PODCAST_CONFIG", "globalThis.MEDIANO_EPISODE_PODCAST_CONFIG")
  .replace("const EPISODE_PODCAST_CONFIG", "globalThis.EPISODE_PODCAST_CONFIG");
vm.runInNewContext(configSource, context);

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)]
    .filter((index) => index >= 0);
  return app.slice(start, next.length ? Math.min(...next) : app.length);
}

const resolverStart = app.indexOf("function getEpisodePodcastConfig(");
const resolverEnd = app.indexOf("\nfunction getEpisodeRatingPersistenceConfig(", resolverStart);
assert.ok(resolverStart >= 0 && resolverEnd > resolverStart, "episode config resolver exists");
vm.runInNewContext(app.slice(resolverStart, resolverEnd), context);
vm.runInNewContext(`${extractFunction("getEpisodeDatabasePodcastKey")}\n${extractFunction("podcastHasEpisodeConfiguration")}\n${extractFunction("podcastSupportsEpisodes")}\n${extractFunction("applyPodcastEpisodeSourceBoundary")}\n${extractFunction("episodeMatchesPodcastSourceBoundary")}\n${extractFunction("isRateablePodcastEpisode")}`, context);

const newPodcast = podcasts.get("transferguru tipsbladet");
const newConfig = context.getEpisodePodcastConfig(newPodcast);
assert.equal(newConfig?.enabled, true);
assert.equal(newConfig.podcastKey, "transferguru tipsbladet");
assert.equal(newConfig.databasePodcastKey, "transferguru tipsbladet");
assert.equal(newConfig.displayName, "Transferguru");
assert.equal(newConfig.searchPlaceholder, "Søg i Transferguru-episoder");
assert.equal(newConfig.source, "buzzsprout");
assert.deepEqual(Array.from(newConfig.episodeSources), ["buzzsprout_tipsbladet_lyd_rss"]);
assert.equal(newConfig.persistence, "supabase");
assert.equal(context.podcastSupportsEpisodes(newPodcast), true, "new podcast exposes the episode action");
assert.equal(context.getEpisodeDatabasePodcastKey(newConfig), "transferguru tipsbladet");
assert.equal(context.getEpisodePodcastConfig("transferguru tipsbladet").podcastKey, "transferguru tipsbladet");
assert.equal(context.getEpisodeDatabasePodcastKey("transferguru tipsbladet"), "transferguru tipsbladet");
assert.equal(context.getEpisodePodcastConfig({ podcastId: "unrelated show", title: "Transferguru" }), null,
  "display title alone never activates the Tipsbladet config");
let appliedSourceFilter = null;
const sourceFilteredQuery = context.applyPodcastEpisodeSourceBoundary({
  in(column, values) { appliedSourceFilter = { column, values: Array.from(values) }; return this; }
}, newConfig, "podcast_episodes.");
assert.ok(sourceFilteredQuery);
assert.deepEqual(appliedSourceFilter, {
  column: "podcast_episodes.source",
  values: ["buzzsprout_tipsbladet_lyd_rss"]
}, "Supabase episode and parent-rating queries filter to the exact Tipsbladet source");

const existingRows = [
  { id: "f5258a1b-35dc-4819-b25b-9b72613ef816", podcast_key: "transferguru tipsbladet", source: "buzzsprout_tipsbladet_lyd_rss", title: "Hvem har haft det BEDSTE transfervindue i Superligaen? | Transferguru" },
  { id: "aad2f21e-dbe2-4e23-bb4f-f09351e05ead", podcast_key: "transferguru tipsbladet", source: "buzzsprout_tipsbladet_lyd_rss", title: "FCK TIL SALG: En kæmpe nyhed for dansk fodbold! | Transferguru" },
  { id: "old-series", podcast_key: "transferguru", source: "apple_podcasts_1843557403", title: "Transferguru old episode" },
  { id: "other-feed", podcast_key: "transferguru tipsbladet", source: "buzzsprout_other", title: "Wrong feed" }
];
const renderedEpisodePanel = existingRows.filter((row) =>
  row.podcast_key === context.getEpisodeDatabasePodcastKey(newConfig) &&
  context.episodeMatchesPodcastSourceBoundary(row, newConfig)
);
assert.deepEqual(renderedEpisodePanel.map((row) => row.id), [
  "f5258a1b-35dc-4819-b25b-9b72613ef816",
  "aad2f21e-dbe2-4e23-bb4f-f09351e05ead"
], "the panel selects both exact episodes and excludes old-series/other-feed rows");
assert.ok(renderedEpisodePanel.every((episode) => context.isRateablePodcastEpisode(episode)));
assert.equal(context.getEpisodePodcastConfig(newPodcast).persistence, "supabase", "episode ratings use the standard persisted rating path");

const oldPodcast = podcasts.get("transferguru");
const oldConfig = context.getEpisodePodcastConfig(oldPodcast);
assert.notEqual(oldConfig.databasePodcastKey, "transferguru tipsbladet", "old Transferguru keeps its own database identity");
assert.equal(oldConfig.podcastKey, "transferguru");
assert.equal(context.getEpisodeDatabasePodcastKey(oldConfig), "transferguru");
assert.equal(context.episodeMatchesPodcastSourceBoundary(existingRows[2], oldConfig), true);
assert.deepEqual(existingRows.filter((row) =>
  row.podcast_key === context.getEpisodeDatabasePodcastKey(oldConfig) &&
  context.episodeMatchesPodcastSourceBoundary(row, oldConfig)
).map((row) => row.id), ["old-series"], "old Transferguru stays scoped to its own database key");

const transferTalk = podcasts.get("transfer talk");
const transferTalkConfig = context.getEpisodePodcastConfig(transferTalk);
assert.equal(transferTalkConfig.podcastKey, "transfer talk");
assert.equal(transferTalkConfig.databasePodcastKey, "transfer talk");
assert.equal(context.podcastSupportsEpisodes(transferTalk), true, "Transfer Talk retains its existing episode support");
assert.notEqual(transferTalkConfig.databasePodcastKey, newConfig.databasePodcastKey);

assert.match(app, /getEpisodeRatingPersistenceConfig[\s\S]*?if \(config\) return config;/u,
  "normal episode rating persistence resolution remains in place");
console.log("Transferguru Tipsbladet episode config and identity regression: PASS");
