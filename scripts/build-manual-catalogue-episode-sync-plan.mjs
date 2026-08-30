import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const allowLegacyV1 = process.argv.includes("--allow-legacy-v1");

const normalizeText = (value) => String(value ?? "").trim();

function hashStringToEightHex(input, seed = 0) {
  let hash = (2166136261 ^ seed) >>> 0;
  const value = String(input || "");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 8);
}

function uuidFromIdentity(identity, seeds) {
  const hex = seeds.map((seed) => hashStringToEightHex(identity, seed)).join("");
  const variantNibble = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variantNibble}${hex.slice(17, 20)}`,
    hex.slice(20, 32)
  ].join("-");
}

function parseEntries(value) {
  const rawEntries = Array.isArray(value) ? value : String(value ?? "").split(";");
  return rawEntries.map((entry) => ({
    title: normalizeText(typeof entry === "object" ? entry?.title : entry),
    manualEpisodeKey: normalizeText(
      typeof entry === "object" ? entry?.manual_episode_key || entry?.manualEpisodeKey : ""
    )
  })).filter((entry) => entry.title);
}

const payload = JSON.parse(await readFile(path.join(root, "data", "podcasts.json"), "utf8"));
const podcasts = Array.isArray(payload) ? payload : payload.rows || [];
const rows = [];

for (const podcast of podcasts) {
  const podcastKey = normalizeText(podcast["Podcast-ID"]);
  if (!podcastKey) continue;

  for (const [index, entry] of parseEntries(podcast.manualEpisodes).entries()) {
    const legacyIdentity = `podcastlisten-manual-episode-v1|${podcastKey}|${index + 1}|${entry.title}`;
    const legacyId = uuidFromIdentity(legacyIdentity, [0x11, 0x22, 0x33, 0x44]);
    if (!entry.manualEpisodeKey && !allowLegacyV1) {
      throw new Error(
        `${podcastKey} episode ${index + 1} mangler manual_episode_key. ` +
        "Tilføj den i kildedata før en ny manuel episode synkroniseres."
      );
    }

    const id = entry.manualEpisodeKey
      ? uuidFromIdentity(
          `podcastlisten-manual-catalogue-v2|${podcastKey}|${entry.manualEpisodeKey}`,
          [0x51, 0x52, 0x53, 0x54]
        )
      : legacyId;
    const manualEpisodeKey = entry.manualEpisodeKey
      ? `manual-catalogue-v2:${podcastKey}:${entry.manualEpisodeKey}`
      : `manual-catalogue-v1:${id}`;

    rows.push({
      id,
      podcast_key: podcastKey,
      source: "manual_catalogue_v1",
      external_guid: `manual_catalogue_v1:${id}`,
      external_episode_id: manualEpisodeKey,
      title: entry.title,
      is_active: true,
      metadata: {
        manual_catalogue: true,
        manual_episode_key: manualEpisodeKey,
        legacy_episode_id: legacyId,
        identity_version: entry.manualEpisodeKey ? "manual_catalogue_v2" : "manual_catalogue_v1",
        rateable: true
      }
    });
  }
}

console.log(JSON.stringify({
  mode: allowLegacyV1 ? "legacy-v1-review-only" : "immutable-key-sync",
  rows,
  instructions: "Review this output, then apply it only through a separately approved service-role catalogue sync."
}, null, 2));
