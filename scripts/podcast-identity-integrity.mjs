import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const normalizeText = (value) => String(value ?? "").trim();
const normalizeComparable = (value) => normalizeText(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .replace(/[^a-z0-9æøå ]/gu, " ")
  .replace(/\s+/gu, " ")
  .trim();
const podcastId = (row) => normalizeText(row?.["Podcast-ID"]);
const legacyKey = (row) => normalizeComparable(row?.Titel);

function buildResolver(rows) {
  const byId = new Map();
  const legacyCandidates = new Map();
  for (const row of rows) {
    const id = podcastId(row);
    if (!id) continue;
    byId.set(id, id);
    const key = legacyKey(row);
    if (!key) continue;
    const candidates = legacyCandidates.get(key) || [];
    candidates.push(id);
    legacyCandidates.set(key, candidates);
  }
  return (key) => {
    const value = normalizeText(key);
    if (byId.has(value)) return byId.get(value);
    const candidates = legacyCandidates.get(normalizeComparable(value)) || [];
    return candidates.length === 1 ? candidates[0] : "";
  };
}

function candidateHint(oldRow, candidateRows) {
  const matches = candidateRows.filter((row) => legacyKey(row) && legacyKey(row) === legacyKey(oldRow));
  if (matches.length !== 1) return matches.length ? "ambiguous title candidate" : "no candidate";
  return podcastId(matches[0]) || "matching candidate has blank Podcast-ID";
}

export function validatePodcastIdentityContinuity({ previousRows, candidateRows, ratedPodcastKeys = [], migrations = {} }) {
  const errors = [];
  const oldResolve = buildResolver(previousRows);
  const nextResolve = buildResolver(candidateRows);
  const candidateIds = new Set();
  for (const row of candidateRows) {
    const id = podcastId(row);
    if (!id) errors.push(`blank Podcast-ID for ${JSON.stringify(normalizeText(row?.Titel))}`);
    else if (candidateIds.has(id)) errors.push(`duplicate Podcast-ID ${JSON.stringify(id)}`);
    else candidateIds.add(id);
  }
  for (const oldRow of previousRows) {
    const oldId = podcastId(oldRow);
    if (!oldId) continue;
    const mappedId = migrations[oldId] || oldId;
    if (!candidateIds.has(mappedId)) {
      errors.push(`stable Podcast-ID ${JSON.stringify(oldId)} disappeared; candidate: ${candidateHint(oldRow, candidateRows)}`);
    }
  }
  const ratedBefore = ratedPodcastKeys.filter((key) => oldResolve(key));
  const newlyUnresolved = [];
  for (const key of ratedBefore) {
    const before = oldResolve(key);
    const after = nextResolve(migrations[before] || key);
    if (!after) newlyUnresolved.push({ key, before, candidate: candidateHint(previousRows.find((row) => podcastId(row) === before) || {}, candidateRows) });
  }
  for (const failure of newlyUnresolved) errors.push(`rated key ${JSON.stringify(failure.key)} previously resolved to ${JSON.stringify(failure.before)}; candidate: ${failure.candidate}`);
  if (candidateRows.length < previousRows.length * 0.9) errors.push(`catalogue count dropped from ${previousRows.length} to ${candidateRows.length}`);
  return { ok: errors.length === 0, errors, totals: { ratedPodcastKeysBefore: ratedPodcastKeys.length, ratedPodcastKeysResolvingBefore: ratedBefore.length, ratedPodcastKeysResolvingAfter: ratedBefore.length - newlyUnresolved.length, newlyUnresolvedRatedPodcastKeys: newlyUnresolved.length }, newlyUnresolved };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name) => args[args.indexOf(name) + 1] || "";
  const before = JSON.parse(await readFile(value("--before"), "utf8")).rows || [];
  const candidate = JSON.parse(await readFile(value("--candidate"), "utf8")).rows || [];
  const migrationsPath = value("--migrations");
  const migrations = migrationsPath ? JSON.parse(await readFile(migrationsPath, "utf8")).podcastIdMigrations || {} : {};
  const url = process.env.PODCAST_SUPABASE_URL;
  const key = process.env.PODCAST_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("CRITICAL PODCAST IDENTITY REGRESSION: PODCAST_SUPABASE_URL and PODCAST_SUPABASE_ANON_KEY are required; refusing to sync without rated-podcast validation.");
  const response = await fetch(`${url}/rest/v1/podcast_rating_combined_public_stats?select=podcast_key`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`CRITICAL PODCAST IDENTITY REGRESSION: could not read public rating keys (${response.status}).`);
  const ratedKeys = (await response.json()).map((row) => row.podcast_key);
  const result = validatePodcastIdentityContinuity({ previousRows: before, candidateRows: candidate, ratedPodcastKeys: ratedKeys, migrations });
  console.log(JSON.stringify(result.totals, null, 2));
  if (!result.ok) throw new Error(`CRITICAL PODCAST IDENTITY REGRESSION\n- ${result.errors.join("\n- ")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((error) => { console.error(error); process.exitCode = 1; });
