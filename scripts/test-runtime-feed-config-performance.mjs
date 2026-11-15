import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadRuntimeFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

const targetPodcastId = "politik for viderekomne med søs og huxi";
const targetFeedKey = "podimo_public_rss_politik_for_viderekomne_med_sos_og_huxi";
const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const rows = Array.isArray(payload) ? payload : payload.rows;
assert.ok(Array.isArray(rows) && rows.length >= 1300, "performance fixture must use the full production-sized catalogue");

const cpuSamples = [];
const wallSamples = [];
let merged;
for (let sample = 0; sample < 3; sample += 1) {
  const cpuStart = process.cpuUsage();
  const startedAt = performance.now();
  merged = await loadRuntimeFeedConfigs({
    podcastsJsonUrl: "https://podcastlisten.dk/data/podcasts.json",
    fetchPayload: async () => payload
  });
  const cpu = process.cpuUsage(cpuStart);
  cpuSamples.push((cpu.user + cpu.system) / 1000);
  wallSamples.push(performance.now() - startedAt);
}
const cpuMs = [...cpuSamples].sort((a, b) => a - b)[1];
const wallMs = [...wallSamples].sort((a, b) => a - b)[1];

assert.equal(merged.configs[targetFeedKey]?.podcast_key, targetPodcastId,
  "the exact verified Podimo public-RSS identity remains configured");
assert.equal(merged.configs[targetFeedKey]?.enabled, true,
  "the exact verified source remains enabled when the full catalogue is unique");
assert.equal(merged.configs[targetFeedKey]?.podimo_show_id, "3520dd9b-1787-4183-b091-aaa5ebd74a5b");
assert.equal(merged.configs[targetFeedKey]?.apple_collection_id, "6833021858");
assert.equal(merged.configs[targetFeedKey]?.podimo_catalogue_id, "catalogue-v1-047662a4");
assert.ok(cpuMs < 1000,
  `full-catalogue feed resolution must stay below 1000ms CPU; measured ${cpuMs.toFixed(1)}ms`);

const targetRow = rows.find(row => row["Podcast-ID"] === targetPodcastId);
assert.ok(targetRow, "the production-sized fixture includes the exact target row");
const duplicateIdentity = {
  ...targetRow,
  catalogue_id: "catalogue-v1-performance-negative-duplicate"
};
const blocked = await loadRuntimeFeedConfigs({
  podcastsJsonUrl: "https://podcastlisten.dk/data/podcasts.json",
  fetchPayload: async () => ({ rows: [...rows, duplicateIdentity] })
});
assert.equal(blocked.configs[targetFeedKey]?.enabled, false,
  "duplicate exact Podcast-ID must fail closed even when its catalogue_id differs");

console.log(JSON.stringify({
  status: "PASS",
  catalogue_rows: rows.length,
  cpu_ms: Number(cpuMs.toFixed(1)),
  wall_ms: Number(wallMs.toFixed(1)),
  cpu_samples_ms: cpuSamples.map(value => Number(value.toFixed(1))),
  positive_exact_source: true,
  negative_duplicate_identity: "blocked"
}));
