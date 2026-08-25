import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const podcastPayload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const manifestPayload = JSON.parse(
  await readFile(new URL("../data/podcast-cover-manifest.json", import.meta.url), "utf8")
);
const rows = podcastPayload.rows || [];
const entries = manifestPayload.podcasts || manifestPayload.entries || [];

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeMatchKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9æøå ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPodcast(row) {
  return {
    title: normalizeText(row.Titel),
    host: normalizeText(row["Vært"]),
    publisher: normalizeText(row.Udgiver),
    podcastId: normalizeText(row["Podcast-ID"]),
    legacyKey: normalizeMatchKey(row.Titel),
    image: normalizeText(row.Billedlink)
  };
}

function signature(record) {
  const normalizePart = (value) => normalizeMatchKey(value).replace(/\s+/g, "");
  const title = normalizePart(record?.title);
  return title
    ? [title, normalizePart(record?.host), normalizePart(record?.publisher)].join("|")
    : "";
}

function uniqueLookup(candidates) {
  return Object.fromEntries(
    [...candidates].filter(([, values]) => values.length === 1).map(([key, values]) => [key, values[0]])
  );
}

function addCandidate(candidates, key, entry) {
  if (!key) return;
  const matches = candidates.get(key) || [];
  if (!matches.includes(entry)) matches.push(entry);
  candidates.set(key, matches);
}

function buildManifestLookup() {
  const ids = new Map();
  const signatures = new Map();
  const legacy = new Map();
  entries.forEach((entry) => {
    addCandidate(ids, normalizeText(entry.podcastId || entry["Podcast-ID"]), entry);
    addCandidate(signatures, signature(entry), entry);
    [entry.podcastKey, entry.matchKey, entry.titleKey, entry.title]
      .map(normalizeMatchKey)
      .filter(Boolean)
      .forEach((key) => addCandidate(legacy, key, entry));
  });
  return { byPodcastId: uniqueLookup(ids), bySignature: uniqueLookup(signatures), byLegacyKey: uniqueLookup(legacy) };
}

const podcasts = rows.map(toPodcast);
const legacyCounts = new Map();
podcasts.forEach((podcast) => {
  legacyCounts.set(podcast.legacyKey, (legacyCounts.get(podcast.legacyKey) || 0) + 1);
});
const lookup = buildManifestLookup();
const resolveLocalCover = (podcast) =>
  lookup.byPodcastId[podcast.podcastId] ||
  lookup.bySignature[signature(podcast)] ||
  (legacyCounts.get(podcast.legacyKey) === 1 ? lookup.byLegacyKey[podcast.legacyKey] : null);

const agenterne = podcasts.filter((podcast) => podcast.title === "Agenterne");
assert.equal(agenterne.length, 2, "Agenterne must remain two canonical podcasts");
const ekstraBladet = agenterne.find((podcast) => podcast.podcastId === "agenterne ekstra bladet");
const politiken = agenterne.find((podcast) => podcast.podcastId === "agenterne politiken");
assert.ok(ekstraBladet && politiken, "Both canonical Agenterne IDs must exist");
assert.equal(resolveLocalCover(ekstraBladet)?.stableKey, "agenterne-99488435eb");
assert.equal(resolveLocalCover(politiken), null, "Ambiguous title fallback must not assign Ekstra Bladet's cover");
assert.notEqual(ekstraBladet.image, politiken.image, "Each Agenterne row keeps its own external fallback");

["Genstart", "Kapret", "Robert og Thetanerne"].forEach((title) => {
  const podcast = podcasts.find((candidate) => candidate.title === title);
  assert.ok(podcast, `${title} must exist`);
  assert.ok(resolveLocalCover(podcast) || podcast.image, `${title} must retain an image source`);
});

console.log(
  JSON.stringify(
    {
      passed: true,
      agenterne: {
        "agenterne ekstra bladet": resolveLocalCover(ekstraBladet)?.variants?.["480"]?.path || null,
        "agenterne politiken": resolveLocalCover(politiken)?.variants?.["480"]?.path || politiken.image
      },
      ordinaryPodcastImageSourcesVerified: 3
    },
    null,
    2
  )
);
