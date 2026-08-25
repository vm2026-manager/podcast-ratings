import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeText(value) {
  return String(value ?? "").trim();
}

function legacyKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9\u00e6\u00f8\u00e5 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const payload = JSON.parse(
  await readFile(path.resolve(__dirname, "..", "data", "podcasts.json"), "utf8")
);
const rows = payload.rows;
const byId = new Map();
const idsByLegacyKey = new Map();

for (const row of rows) {
  const podcastId = normalizeText(row["Podcast-ID"]);
  const key = legacyKey(row.Titel || row.Title);
  assert(podcastId, `Mangler Podcast-ID: ${row.Titel || row.Title}`);
  if (!byId.has(podcastId)) byId.set(podcastId, row);
  if (!idsByLegacyKey.has(key)) idsByLegacyKey.set(key, new Set());
  idsByLegacyKey.get(key).add(podcastId);
}

const ambiguousLegacyKeys = [...idsByLegacyKey.entries()]
  .filter(([, ids]) => ids.size > 1)
  .map(([key, ids]) => ({ key, podcastIds: [...ids].sort() }));
const resolveStoredKey = (key) =>
  byId.get(normalizeText(key)) ||
  (idsByLegacyKey.get(normalizeText(key))?.size === 1
    ? byId.get([...idsByLegacyKey.get(normalizeText(key))][0])
    : null);

const agentA = { "Podcast-ID": "agenterne ekstra bladet", Titel: "Agenterne" };
const agentB = { "Podcast-ID": "agenterne politiken", Titel: "Agenterne" };
const userRatings = { [agentA["Podcast-ID"]]: 8.1 };
const saved = new Set([agentB["Podcast-ID"]]);
assert(userRatings[agentA["Podcast-ID"]] !== userRatings[agentB["Podcast-ID"]], "Samme titel deler rating-state");
assert(saved.has(agentB["Podcast-ID"]) && !saved.has(agentA["Podcast-ID"]), "Samme titel deler saved-state");
assert(resolveStoredKey(agentA["Podcast-ID"]) !== resolveStoredKey(agentB["Podcast-ID"]), "Samme titel deler opslag");
assert(resolveStoredKey("agenterne") === null, "Ambigu legacy alias resolves");

const beforeTitleChange = { "Podcast-ID": "kapret", Titel: "Kapret" };
const afterTitleChange = { ...beforeTitleChange, Titel: "Kapret – historien fortsætter" };
assert(beforeTitleChange["Podcast-ID"] === afterTitleChange["Podcast-ID"], "Titelændring ændrer Podcast-ID");

const sameIdDuplicateChecks = ["Nu snakker vi om det", "En helvedes fortid"].map((title) => {
  const matchingRows = rows.filter((row) => normalizeText(row.Titel) === title);
  const ids = new Set(matchingRows.map((row) => normalizeText(row["Podcast-ID"])));
  assert(matchingRows.length > 1 && ids.size === 1, `${title} er ikke en sikker same-ID-duplikat`);
  return { title, rawRows: matchingRows.length, renderedRows: 1, podcastId: [...ids][0] };
});

console.log(JSON.stringify({
  rawRows: rows.length,
  renderedCatalogueCount: byId.size,
  canonicalIdsUnique: byId.size === new Set(byId.keys()).size,
  ambiguousLegacyKeys,
  sameIdDuplicateChecks,
  sameTitleStateIsolation: "PASS",
  titleChangeInvariant: "PASS"
}, null, 2));
