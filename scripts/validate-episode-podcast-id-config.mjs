import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSheetFeedEntries } from "./generate-feed-config-from-podcasts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const podcastPayload = JSON.parse(fs.readFileSync(path.join(root, "data", "podcasts.json"), "utf8"));
const podcasts = Array.isArray(podcastPayload) ? podcastPayload : podcastPayload.rows;
assert(Array.isArray(podcasts), "data/podcasts.json does not contain podcast rows");
const configPath = path.join(root, "supabase", "functions", "import-podcast-episodes", "feed-config.ts");
const configSource = fs.readFileSync(configPath, "utf8");

function stableEntries(entries) {
  return new Map(entries.map((entry) => [entry.feedKey, entry]));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqualMaps(legacy, canonical, field) {
  assert(legacy.size === canonical.size, `${field}: entry count changed (${legacy.size} -> ${canonical.size})`);
  for (const [key, legacyEntry] of legacy) {
    const canonicalEntry = canonical.get(key);
    assert(canonicalEntry, `${field}: generated feed key disappeared: ${key}`);
    assert(
      legacyEntry[field] === canonicalEntry[field],
      `${field}: ${key} changed (${legacyEntry[field]} -> ${canonicalEntry[field]})`
    );
  }
}

const legacyResult = buildSheetFeedEntries(podcasts, configSource, { identity: "legacy" });
const canonicalResult = buildSheetFeedEntries(podcasts, configSource, { identity: "podcast-id" });
assert(canonicalResult.summary.missingPodcastIds === 0, "Podcast-ID is missing for a sheet feed row");

const legacy = stableEntries(legacyResult.generated);
const canonical = stableEntries(canonicalResult.generated);
assertEqualMaps(legacy, canonical, "feedKey");
assertEqualMaps(legacy, canonical, "source");
assertEqualMaps(legacy, canonical, "feedUrl");

const expectedManualKeys = new Map([
  ["hva_saa", "hva sa"],
  ["jagten_paa_det_evige_liv", "jagten pa det evige liv"],
  ["sagen_genaabnet", "sagen genabnet"],
  ["vi_ser_paa_det", "vi ser pa det"],
  ["vaagn_lidt_op", "vagn lidt op"]
]);
for (const [configKey, podcastId] of expectedManualKeys) {
  const matcher = new RegExp(`"${configKey}":\\s*\\{([\\s\\S]*?)\\n  \\}`, "m");
  const block = configSource.match(matcher)?.[1] || "";
  assert(block.includes(`podcast_key: "${podcastId}"`), `manual config ${configKey} does not use ${podcastId}`);
}

const sample = podcasts.find((podcast) => String(podcast.Feed || "").trim() && String(podcast["Podcast-ID"] || "").trim());
assert(sample, "no feed-backed Podcast-ID sample found");
const renamed = { ...sample, Titel: "En helt ny titel, som aldrig må ændre episode-identiteten" };
const originalEntry = buildSheetFeedEntries([sample], "export const FEED_CONFIGS = {};", { identity: "podcast-id" }).generated[0];
const renamedEntry = buildSheetFeedEntries([renamed], "export const FEED_CONFIGS = {};", { identity: "podcast-id" }).generated[0];
assert(originalEntry.podcastKey === renamedEntry.podcastKey, "title change altered generated podcast_key");
assert(originalEntry.feedKey === renamedEntry.feedKey, "title change altered generated feed key");
assert(originalEntry.source === renamedEntry.source, "title change altered generated source");

console.log(JSON.stringify({
  status: "PASS",
  legacyGeneratedFeedCount: legacy.size,
  canonicalGeneratedFeedCount: canonical.size,
  changedGeneratedKeys: 0,
  changedGeneratedSources: 0,
  changedGeneratedUrls: 0,
  missingPodcastIds: canonicalResult.summary.missingPodcastIds,
  manualPodcastKeys: Object.fromEntries(expectedManualKeys),
  titleChangeInvariant: "PASS"
}, null, 2));
