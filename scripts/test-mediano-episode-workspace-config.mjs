import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");
const expectedMedianoIds = [
  "max mediano", "mediano pl", "mediano superliga", "superliga preview", "camp canada",
  "mediano landshold", "fodbold var bedre i 90 erne", "superliga special", "bold boger",
  "fredagsfrokosten", "mediano la liga", "mediano serie a", "mediano bundesliga",
  "mediano 1 division", "superliga for voksne", "mediano q", "mediano business",
  "mediano bossword", "mediano breaking", "fodbold var værre i 70 erne", "minimax",
  "mediano marketing", "souplesse", "klub mediano", "mediano 2 division",
  "mediano sport og perspektiv", "magasinet jennings", "troels bech i en samtale"
];

const configStart = app.indexOf("const MEDIANO_EPISODE_DESTINATIONS");
const configEnd = app.indexOf("const MANUAL_CATALOGUE_SOURCE", configStart);
assert.ok(configStart >= 0 && configEnd > configStart, "Mediano config manifest is missing");
const context = {
  URL,
  Object,
  console,
  normalizeText: (value) => String(value ?? "").trim().toLowerCase(),
  normalizeMatchKey: (value) => String(value ?? "").trim().toLowerCase(),
  EPISODE_DATABASE_KEY_ALIASES: {},
  getPodcastId: (podcast) => String(podcast?.podcastId ?? "").trim().toLowerCase(),
  getEpisodePodcastKey: (podcast) => String(podcast?.podcastId ?? podcast ?? "").trim().toLowerCase(),
  resolvePodcastByStoredKey: () => null
};
context.globalThis = context;
const configSource = app.slice(configStart, configEnd)
  .replace("const MEDIANO_EPISODE_DESTINATIONS", "globalThis.MEDIANO_EPISODE_DESTINATIONS")
  .replace("const MEDIANO_EPISODE_PODCAST_CONFIG", "globalThis.MEDIANO_EPISODE_PODCAST_CONFIG")
  .replace("const EPISODE_PODCAST_CONFIG", "globalThis.EPISODE_PODCAST_CONFIG");
vm.runInNewContext(configSource, context);

const resolverStart = app.indexOf("function getEpisodePodcastConfig(");
const resolverEnd = app.indexOf("function getEpisodeRatingPersistenceConfig", resolverStart);
assert.ok(resolverStart >= 0 && resolverEnd > resolverStart, "Episode config resolver is missing");
vm.runInNewContext(app.slice(resolverStart, resolverEnd), context);

for (const id of expectedMedianoIds) {
  const config = context.getEpisodePodcastConfig({ podcastId: id, title: `Display ${id}` });
  assert.ok(config?.enabled, `${id} must resolve to an enabled episode config`);
  assert.equal(config.podcastKey, id, `${id} must preserve its canonical Podcast-ID`);
  assert.equal(config.databasePodcastKey, id, `${id} must query its canonical database Podcast-ID`);
  assert.equal(config.persistence, "supabase", `${id} must use the normal Supabase episode path`);
  assert.equal(config.source, "mediano_public_rss", `${id} must read only public Mediano feed rows`);
}

assert.equal(context.MEDIANO_EPISODE_DESTINATIONS.length, 32, "approved Mediano destinations plus reviewed dormant series are configured");
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["superliga for voksne"].includeManualEpisodes, true);
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["klub mediano"].includeManualEpisodes, true, "Klub Mediano merges its reviewed historical subseries with RSS episodes");
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["troels bech i en samtale"].includeManualEpisodes, true, "Troels merges the reviewed Mounir catalogue row with its existing Supabase episode");
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["mediano superliga"].includeManualEpisodes, false);
assert.equal(context.getEpisodePodcastConfig({ podcastId: "unrelated podcast", title: "Unrelated" }), null, "unrelated podcasts are not globally enabled");

const fodboldministeriet = context.getEpisodePodcastConfig({
  podcastId: "fodboldministeriet",
  title: "Fodboldministeriet",
  Feed: "https://example.test/fodboldministeriet.rss"
});
assert.equal(fodboldministeriet.databasePodcastKey, "fodboldministeriet", "Fodboldministeriet retains its dedicated canonical key");
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG.fodboldministeriet, undefined, "Fodboldministeriet is not added to the Mediano umbrella config");

assert.match(app, /mergeEpisodes\(rows, manualEpisodes\)/u, "Superliga for voksne uses the existing identity de-duplication merge");
assert.match(app, /manualEpisodeKey: "den-store-talentserie"/u, "Den store talentserie uses an immutable manual episode key");
assert.match(app, /manualEpisodeKey: "mediano-special-hvad-siger-data-om-superligaen"/u, "Mediano Special historical episode uses an immutable manual episode key");
assert.match(app, /refreshManualEpisodeRatingData\(config\.podcastKey, manualEpisodes\)/u, "manual rating/mapping hydration remains active");
assert.match(app, /function getEpisodeRatingPersistenceConfig[\s\S]*?if \(config\) return config;/u, "existing episode-rating persistence resolution remains unchanged");

console.log("Mediano episode workspace configuration regression checks passed.");
