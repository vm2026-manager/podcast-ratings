import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseApplePodcastEpisodePage } from "../supabase/functions/import-podcast-episodes/apple-podcasts.ts";

const page = (id, description, appleFields = "") => `
<link rel="canonical" href="https://podcasts.apple.com/dk/podcast/kirsten/id1715936714?i=${id}">
<script type="application/ld+json">{"@type":"PodcastEpisode","name":"Titel","description":${JSON.stringify(description)},"url":"https://podcasts.apple.com/dk/podcast/kirsten/id1715936714?i=${id}"}</script>
<script id="serialized-server-data">{"episode":{"adamId":"${id}","storeUrl":"https://podcasts.apple.com/dk/podcast/kirsten/id1715936714?i=${id}",${appleFields}}}</script>`;
const s1 = parseApplePodcastEpisodePage(page("1000000000001", "Afsnit 1.", '"seasonNumber":1,"episodeNumber":1'), "1000000000001");
assert.deepEqual([s1.seasonNumber, s1.seasonEpisodeNumber, s1.seasonNumberSource], [1, 1, "apple_season_and_description"]);
const s2 = parseApplePodcastEpisodePage(page("1000000000002", "Sæson 2 - afsnit 1.", '"seasonNumber":2,"episodeNumber":26'), "1000000000002");
assert.deepEqual([s2.seasonNumber, s2.seasonEpisodeNumber], [2, 1]);
const s3 = parseApplePodcastEpisodePage(page("1000000000003", "Sæson 3, afsnit 8."), "1000000000003");
assert.deepEqual([s3.seasonNumber, s3.seasonEpisodeNumber], [3, 8]);
const ambiguous = parseApplePodcastEpisodePage(page("1000000000004", "Afsnit 2.", '"episodeNumber":2'), "1000000000004");
assert.deepEqual([ambiguous.seasonNumber, ambiguous.seasonEpisodeNumber], [null, null]);

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const extract = (name) => {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  let depth = 0;
  for (let i = app.indexOf("{", start); i < app.length; i += 1) {
    if (app[i] === "{") depth += 1;
    if (app[i] === "}" && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
};
const matches = [
  { id: "s5e8", description: "Sæson 5 - afsnit 8." },
  { id: "s5e2", description: "Sæson 5, afsnit 2." },
  { id: "s6e4", description: "Sæson 6, afsnit 4." },
  { id: "s6e1", description: "Sæson 6, afsnit 1." },
  { id: "unknown", description: "Afsnit 10." },
];
const getAppleSeasonEpisodeNumber = new Function("normalizeText", `${extract("getAppleSeasonEpisodeNumber")}\nreturn getAppleSeasonEpisodeNumber;`)(
  (value) => String(value ?? "").trim()
);
const base = {
  getPodcastEpisodeState: () => ({ items: matches, searchTerm: "" }),
  normalizeText: (value) => String(value ?? "").trim(),
  normalizeComparable: (value) => String(value ?? "").trim().toLowerCase(),
  getEpisodePodcastConfig: (podcast) => ({ seasonNumber: podcast.seasonNumber }),
  getAppleSeasonEpisodeNumber,
  getVisibleGenstartEpisodes: () => matches
};
const workspace = new Function(...Object.keys(base), "podcast", `${extract("getEpisodeWorkspaceEpisodes")}\nreturn getEpisodeWorkspaceEpisodes(podcast);`);
const getSeasonEpisodes = (season) => workspace(...Object.values(base), { seasonNumber: season });
assert.deepEqual(getSeasonEpisodes(5).map((episode) => episode.id), ["s5e2", "s5e8"]);
assert.deepEqual(getSeasonEpisodes(6).map((episode) => episode.id), ["s6e1", "s6e4"]);
assert.deepEqual(getSeasonEpisodes(4), [], "Episodes without explicit season 4 metadata are not misassigned to season 4");

const groupConfig = JSON.parse(await readFile(new URL("../data/podcast-display-groups.json", import.meta.url), "utf8"));
const group = groupConfig.groups.find((entry) => entry.id === "kirsten-ringer-til-rasmus");
assert.equal(group.memberLegacyKeys[0], "kirsten ringer til rasmus sæson 4");
assert.deepEqual([...group.seasonIdentities.map((entry) => entry.season), 4].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
const normalizeMatchKey = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9æøå ]/g, " ").replace(/\s+/g, " ").trim();
const getDisplayGroupEpisodeSeason = new Function("state", "normalizeText", "normalizeMatchKey", "resolvePodcastByStoredKey", "getPodcastKey", `
  ${extract("getDisplayGroupEpisodeSeason")}
  return getDisplayGroupEpisodeSeason;
`)({ podcastDisplayGroups: groupConfig.groups }, (value) => String(value ?? "").trim(), normalizeMatchKey,
  (key) => key === "kirsten ringer til rasmus sæson 4" ? { podcastId: key, legacyKey: key } : null,
  (podcast) => podcast?.podcastId || podcast?.legacyKey || "");
for (const season of [1, 2, 3, 4, 5, 6]) {
  const key = season === 4 ? "kirsten ringer til rasmus sæson 4" : `display-season:kirsten-ringer-til-rasmus:${season}`;
  const routed = getDisplayGroupEpisodeSeason(key);
  assert.equal(routed.seasonNumber, season);
  assert.equal(routed.databasePodcastKey, "kirsten ringer til rasmus sæson 4");
  assert.equal(routed.source, "apple_podcasts_1715936714");
  assert.equal(routed.stateKey, key, "Each season keeps a distinct local rating state key");
}
const migration = await readFile(new URL("../supabase/migrations/20261022065420_add_kirsten_ringer_six_season_rating_membership.sql", import.meta.url), "utf8");
assert.match(migration, /on conflict \(display_group_id, podcast_key\) do nothing/i);
assert.doesNotMatch(migration, /public\.(podcast_episodes|episode_ratings|user_ratings)/i, "Membership migration does not modify podcast, episode, or rating data");
console.log("Kirsten Apple season parsing, grouping, and episode routing regressions passed.");
