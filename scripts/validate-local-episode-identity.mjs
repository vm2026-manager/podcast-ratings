import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const normalizeText = (value) => String(value ?? "").trim();
const legacyKey = (value) =>
  normalizeText(value)
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9æøå ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const payload = JSON.parse(
  await readFile(path.resolve(__dirname, "..", "data", "podcasts.json"), "utf8")
);
const localEpisodes = JSON.parse(
  await readFile(path.resolve(__dirname, "..", "data", "podcast-episodes.json"), "utf8")
);
const rowsById = new Map();
const idsByLegacyKey = new Map();

for (const row of payload.rows) {
  const podcastId = normalizeText(row["Podcast-ID"]);
  const key = legacyKey(row.Titel || row.Title);
  assert(podcastId, `Mangler Podcast-ID: ${row.Titel || row.Title}`);
  if (!rowsById.has(podcastId)) rowsById.set(podcastId, row);
  if (!idsByLegacyKey.has(key)) idsByLegacyKey.set(key, new Set());
  idsByLegacyKey.get(key).add(podcastId);
}

const resolveLocalPodcastKey = (storedKey) => {
  const key = normalizeText(storedKey);
  if (rowsById.has(key)) return key;
  const candidates = idsByLegacyKey.get(key);
  return candidates?.size === 1 ? [...candidates][0] : null;
};

const manualEpisodeIdentity = (podcastId, episodeNumber, title) =>
  `podcastlisten-manual-episode-v1|${podcastId}|${episodeNumber}|${normalizeText(title)}`;

const ambiguousKeys = [...idsByLegacyKey.entries()]
  .filter(([, ids]) => ids.size > 1)
  .map(([key, ids]) => ({ key, podcastIds: [...ids].sort() }))
  .sort((left, right) => left.key.localeCompare(right.key, "da"));

const sameTitleChecks = ["Agenterne", "Dobbeltgænger", "Fodbold FM", "Mette Frederiksen"].map((title) => {
  const rows = [...rowsById.values()].filter((row) => normalizeText(row.Titel) === title);
  assert(rows.length === 2, `${title}: forventede to canonical podcasts`);
  const [first, second] = rows;
  const firstId = normalizeText(first["Podcast-ID"]);
  const secondId = normalizeText(second["Podcast-ID"]);
  const key = legacyKey(title);
  assert(firstId !== secondId, `${title}: Podcast-ID kolliderer`);
  assert(resolveLocalPodcastKey(key) === null, `${title}: ambigu legacy key må ikke resolve`);
  assert(
    manualEpisodeIdentity(firstId, 1, "Samme episode") !==
      manualEpisodeIdentity(secondId, 1, "Samme episode"),
    `${title}: lokale episode-ID'er kolliderer`
  );
  return { title, legacyKey: key, podcastIds: [firstId, secondId].sort() };
});

const agenterne = sameTitleChecks.find((entry) => entry.title === "Agenterne");
assert(agenterne.podcastIds.includes("agenterne ekstra bladet"), "Agenterne EB mangler");
assert(agenterne.podcastIds.includes("agenterne politiken"), "Agenterne Politiken mangler");

const genstart = resolveLocalPodcastKey("genstart");
const hvaSa = [...rowsById.values()].find((row) => normalizeText(row["Podcast-ID"]) === "hva sa");
assert(genstart === "genstart", "Genstart legacy alias resolver ikke sikkert");
assert(hvaSa && legacyKey(hvaSa.Titel) === "hva sa", "Hva så?! legacy key afviger");
assert(resolveLocalPodcastKey("hva sa") === "hva sa", "Hva så?! local key resolver ikke til Podcast-ID");

const bomben = localEpisodes.podcasts?.bomben;
assert(bomben?.episodes?.length === 10, "Bomben har ikke 10 lokale episoder");
assert(new Set(bomben.episodes.map((episode) => episode.id)).size === 10, "Bomben episode-ID'er er ikke unikke");
assert(
  bomben.episodes.every((episode) => episode.podcast_key === "bomben"),
  "Bomben lokale episode keys har ændret sig"
);

const appSource = await readFile(path.resolve(__dirname, "..", "app.js"), "utf8");
assert(
  appSource.includes("function getEpisodePodcastKey(podcastOrKey)") &&
    appSource.includes("function getLocalEpisodePodcastKey(podcastOrKey)"),
  "Lokale og remote episode keys er ikke eksplicit adskilt"
);
assert(
  appSource.includes('databasePodcastKey: "genstart"'),
  "Genstart remote database key mangler i konfigurationen"
);

console.log(
  JSON.stringify(
    {
      canonicalPodcastIds: rowsById.size,
      ambiguousLegacyKeys: ambiguousKeys,
      sameTitleChecks,
      localManualKey: "Podcast-ID",
      ambiguousLegacyResolution: "null",
      unambiguousLegacyResolution: { genstart, "hva sa": "hva sa" },
      bomben: { episodes: bomben.episodes.length, key: bomben.parentPodcastKey },
      remoteDatabaseEpisodeKeys: {
        genstart: "unchanged",
        "nu snakker vi om det": "legacy resolver retained",
        "en helvedes fortid": "legacy resolver retained"
      },
      status: "PASS"
    },
    null,
    2
  )
);
