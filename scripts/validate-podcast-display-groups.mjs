import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [cataloguePayload, config] = await Promise.all([
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/podcast-display-groups.json", import.meta.url), "utf8").then(JSON.parse)
]);
const rows = Array.isArray(cataloguePayload) ? cataloguePayload : cataloguePayload.rows;

function normalizeComparable(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeLegacyKey(value) {
  return normalizeComparable(value)
    .replace(/[^a-z0-9æøå ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function titleOf(row) {
  return row.Titel || row.title || "";
}
const podcasts = rows.map((row) => ({ row, title: titleOf(row), legacyKey: normalizeLegacyKey(titleOf(row)) }));
const byLegacyKey = new Map();
for (const podcast of podcasts) {
  const matches = byLegacyKey.get(podcast.legacyKey) || [];
  matches.push(podcast);
  byLegacyKey.set(podcast.legacyKey, matches);
}

assert.equal(config.version, 1, "Config version must be 1");
assert.ok(Array.isArray(config.groups), "Config groups must be an array");
assert.equal(new Set(config.groups.map((group) => group.id)).size, config.groups.length, "Group IDs must be unique");
const activeMemberKeys = new Set();
for (const group of config.groups) {
  if (group.description !== undefined) {
    assert.equal(typeof group.description, "string", `${group.id} description must be a string`);
    assert.ok(group.description.trim(), `${group.id} description must not be empty`);
  }
  assert.equal(new Set(group.memberLegacyKeys).size, group.memberLegacyKeys.length, `${group.id} has duplicate members`);
  assert.ok(group.memberLegacyKeys.includes(group.representativeMemberLegacyKey), `${group.id} representative must be a member`);
  for (const key of group.memberLegacyKeys) {
    const matches = byLegacyKey.get(key) || [];
    assert.equal(matches.length, 1, `${group.id} member must resolve exactly once: ${key}`);
    assert.ok(!activeMemberKeys.has(key), `Active ranking groups overlap on: ${key}`);
    if (group.rankingEnabled) activeMemberKeys.add(key);
  }
}

const narkobetjenten = config.groups.find((group) => group.id === "narkobetjenten");
assert.ok(narkobetjenten, "Narkobetjenten group is required");
assert.equal(narkobetjenten.memberLegacyKeys.length, 12, "Narkobetjenten must have exactly 12 members");
const excludedKey = normalizeLegacyKey("Narkobetjenten på gaden (sæson 1)");
assert.equal((byLegacyKey.get(excludedKey) || []).length, 1, "Narkobetjenten på gaden must remain in catalogue");
assert.ok(!narkobetjenten.memberLegacyKeys.includes(excludedKey), "Narkobetjenten på gaden must not be grouped");
assert.equal(
  podcasts.filter((podcast) => narkobetjenten.memberLegacyKeys.includes(podcast.legacyKey)).length,
  12,
  "Source catalogue must retain all 12 group members"
);

const rawRanking = podcasts.slice();
const rawSnapshot = JSON.stringify(rawRanking);
const groupedRanking = rawRanking.filter((podcast) => !narkobetjenten.memberLegacyKeys.includes(podcast.legacyKey));
groupedRanking.push({ isDisplayGroup: true, displayGroupId: narkobetjenten.id });
assert.equal(groupedRanking.filter((item) => item.displayGroupId === "narkobetjenten").length, 1, "Ranking must contain one display group");
assert.equal(rawRanking.length - groupedRanking.length, 11, "Grouping must reduce ranking by 11 items");
assert.equal(JSON.stringify(rawRanking), rawSnapshot, "Ranking transformation must not mutate source podcasts");
const publicSearchCatalogue = groupedRanking;
assert.equal(publicSearchCatalogue.filter((item) => narkobetjenten.memberLegacyKeys.includes(item.legacyKey)).length, 0, "Public search must exclude raw group members");
assert.equal(publicSearchCatalogue.filter((item) => item.displayGroupId === "narkobetjenten").length, 1, "Public search must include the group once");

const seasonNumbers = narkobetjenten.memberLegacyKeys.map((key) => Number(key.match(/sæson (\d+)/)?.[1]));
assert.deepEqual([...seasonNumbers].sort((a, b) => a - b), [1, 2, 3, 6, 7, 9, 10, 11, 12, 13, 14, 15], "Season ordering must be numeric");

const getDerivedOwnRating = (ratings) => ratings.length
  ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
  : null;
assert.equal(getDerivedOwnRating([8, 7, 9]), 8, "Derived own rating must be the arithmetic mean");
assert.equal(getDerivedOwnRating([]), null, "No season ratings must yield no derived own rating");
const getSeasonLabel = (title) => {
  const match = normalizeComparable(title).match(/sæson\s+(\d+)/);
  return match ? `Sæson ${Number(match[1])}` : title;
};
assert.equal(getSeasonLabel("Podcast uden sæsonnummer"), "Podcast uden sæsonnummer", "Season display fallback must not expose MAX_SAFE_INTEGER");

const weightedStats = [{ averageRating: 8, ratingCount: 2 }, { averageRating: 6, ratingCount: 3 }];
assert.equal(weightedStats.reduce((sum, item) => sum + item.averageRating * item.ratingCount, 0) / 5, 6.8, "User ratings must be count-weighted");
console.log("Podcast display groups validation passed.");
