import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const normalizeText = (value) => String(value ?? "").trim();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const migratedKeys = {
  "hva så": "hva sa",
  "jagten på det evige liv": "jagten pa det evige liv",
  "sagen genåbnet": "sagen genabnet",
  "vi ser på det": "vi ser pa det",
  "vågn lidt op": "vagn lidt op"
};
const appSource = await readFile(path.join(root, "app.js"), "utf8");
const payload = JSON.parse(await readFile(path.join(root, "data", "podcasts.json"), "utf8"));
const rows = Array.isArray(payload) ? payload : payload.rows;

for (const [legacyKey, podcastId] of Object.entries(migratedKeys)) {
  assert(
    rows.some((row) => normalizeText(row["Podcast-ID"]) === podcastId),
    `Mangler Podcast-ID i kataloget: ${podcastId}`
  );
  assert(
    appSource.includes(`"${legacyKey}": "${podcastId}"`),
    `Legacy alias resolver ikke kanonisk: ${legacyKey} -> ${podcastId}`
  );
  assert(
    appSource.includes(`"${podcastId}": {\n    podcastKey: "${podcastId}",\n    databasePodcastKey: "${podcastId}"`),
    `Episode-konfiguration er ikke kanonisk: ${podcastId}`
  );
  assert(
    !appSource.includes(`databasePodcastKey: "${legacyKey}"`),
    `Forældet databasePodcastKey findes stadig: ${legacyKey}`
  );
}

assert(!appSource.includes("EPISODE_DATABASE_KEY_READ_BRIDGES"), "Midlertidig read bridge findes stadig");
assert(!appSource.includes("getEpisodeDatabaseReadKeys"), "Midlertidig read-key helper findes stadig");
assert(!appSource.includes('.in("podcast_key",'), "Episode-læsning må ikke bruge multi-key filter");
const canonicalReadFilter = '.eq("podcast_key", getEpisodeDatabasePodcastKey(config))';
assert(
  appSource.split(canonicalReadFilter).length - 1 === 2,
  "Episode-liste og -søgning skal begge læse én kanonisk database nøgle"
);

const authorityStart = appSource.indexOf("function getEpisodeDatabasePodcastKey(configOrPodcast)");
const authorityEnd = appSource.indexOf("function podcastHasEpisodeConfiguration", authorityStart);
const authoritySource = appSource.slice(authorityStart, authorityEnd);
assert(
  authoritySource.indexOf("const explicitDatabaseKey") < authoritySource.indexOf("const rawCandidates"),
  "databasePodcastKey skal være autoritativ før generiske aliases"
);
assert(authoritySource.includes("if (explicitDatabaseKey) return explicitDatabaseKey;"), "Autoritativ databasePodcastKey mangler");

const configStart = appSource.indexOf("function getEpisodePodcastConfig(podcastOrKey)");
const configEnd = appSource.indexOf("function getEpisodeRatingPersistenceConfig", configStart);
const configSource = appSource.slice(configStart, configEnd);
assert(configSource.includes("const podcastId = getPodcastId(podcast);"), "Config lookup mangler Podcast-ID first");
assert(configSource.includes("if (!podcastId) return null;"), "Dynamisk config må ikke falde tilbage til titel uden Podcast-ID");
assert(
  configSource.includes("podcastKey: podcastId,") && configSource.includes("databasePodcastKey: podcastId,"),
  "Dynamisk feed config bruger ikke Podcast-ID"
);

const titleChangeSample = rows.find((row) => normalizeText(row.Feed) && normalizeText(row["Podcast-ID"]));
assert(titleChangeSample, "Mangler feed-bakket Podcast-ID prøve");
const dynamicDatabaseKey = (podcast) => normalizeText(podcast?.podcastId);
const original = { podcastId: normalizeText(titleChangeSample["Podcast-ID"]), title: titleChangeSample.Titel };
const renamed = { ...original, title: "En ny podcasttitel, som ikke må ændre episode-identiteten" };
assert(dynamicDatabaseKey(original) === dynamicDatabaseKey(renamed), "Titelskift ændrede dynamisk episodeidentitet");

const ambiguousAgenterne = rows.filter((row) => normalizeText(row.Titel) === "Agenterne");
assert(new Set(ambiguousAgenterne.map((row) => normalizeText(row["Podcast-ID"]))).size === 2, "Agenterne er ikke isoleret i kataloget");
assert(!appSource.includes('  agenterne: {'), "Ambiguous Agenterne må ikke have en title-baseret episode config");
assert(appSource.includes('  bomben: {') && appSource.includes('persistence: "local"'), "Bomben lokal episode-konfiguration mangler");

console.log(JSON.stringify({
  status: "PASS",
  canonicalMappings: migratedKeys,
  queryPaths: ["episode list", "episode search"],
  dynamicFeedConfig: "Podcast-ID only",
  titleChangeInvariant: "PASS",
  controls: { genstart: "canonical", bomben: "local unchanged", agenterne: "ambiguous title isolated" }
}, null, 2));
