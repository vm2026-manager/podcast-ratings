import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260924110000_create_display_group_community_stats.sql", import.meta.url),
  "utf8"
);

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// This mirrors the aggregate-only SQL contract: first reduce all included
// season ratings to one arithmetic mean per user, then average those users.
function displayGroupStats(rows, memberKeys) {
  const ratingsByUser = new Map();
  for (const row of rows) {
    if (!memberKeys.includes(row.podcastKey)) continue;
    const ratings = ratingsByUser.get(row.user) || [];
    ratings.push(row.rating);
    ratingsByUser.set(row.user, ratings);
  }
  const userAverages = [...ratingsByUser.values()].map(average);
  return {
    averageRating: userAverages.length ? average(userAverages) : null,
    ratingCount: userAverages.length
  };
}

const seasons = ["season-1", "season-2", "season-3", "season-4", "season-5", "season-6"];
const oneUserSixSeasons = seasons.map((podcastKey, index) => ({
  user: "user-a",
  podcastKey,
  rating: [7, 8, 6, 9, 7, 8][index]
}));

// A: one user with six seasons counts once, while F preserves the six-rating
// personal calculation.
let stats = displayGroupStats(oneUserSixSeasons, seasons);
assert.deepEqual(stats, { averageRating: 7.5, ratingCount: 1 });
assert.equal(average(oneUserSixSeasons.map((row) => row.rating)), 7.5);
assert.equal(oneUserSixSeasons.length, 6);

// B: unequal season counts have equal user weight.
const unequal = [...oneUserSixSeasons, { user: "user-b", podcastKey: "season-1", rating: 10 }];
stats = displayGroupStats(unequal, seasons);
assert.deepEqual(stats, { averageRating: 8.75, ratingCount: 2 });

// C and D: another season from an existing user does not add a user; a new
// user does.
stats = displayGroupStats([...oneUserSixSeasons, { user: "user-a", podcastKey: "season-7", rating: 10 }], [...seasons, "season-7"]);
assert.equal(stats.ratingCount, 1);
stats = displayGroupStats([...oneUserSixSeasons, { user: "user-c", podcastKey: "season-2", rating: 4 }], seasons);
assert.equal(stats.ratingCount, 2);

// E: a one-key group remains the ordinary per-podcast average/count.
stats = displayGroupStats([{ user: "user-a", podcastKey: "single", rating: 7 }, { user: "user-b", podcastKey: "single", rating: 9 }], ["single"]);
assert.deepEqual(stats, { averageRating: 8, ratingCount: 2 });

// H: raw historical keys are forwarded to the server aggregate rather than
// discarded when the client canonicalizes public per-podcast stats.
assert.match(app, /communityStatsStoredKeysByCanonical/u);
assert.match(app, /storedKeys\?\.length \? storedKeys : \[canonicalKey\]/u);

// G/I: editorial aggregation and the existing per-season own-rating helper
// remain separate from the community RPC.
assert.match(app, /ratingValue: averageNumbers\(editorialRatings\)/u);
assert.match(app, /function getDisplayGroupOwnRatingStats\(members\)/u);
assert.match(app, /DISPLAY_GROUP_COMMUNITY_STATS_RPC/u);
assert.doesNotMatch(app, /function getDisplayGroupUserStats\(group\)[\s\S]{0,500}weightedTotal/u);

// The migration is additive and only returns a group ID plus aggregates. It
// has no rating-data DML and explicitly limits execution to public roles.
assert.match(migration, /security definer/u);
assert.match(migration, /group by requested_keys\.display_group_id, effective_user_ratings\.user_id/u);
assert.match(migration, /avg\(per_user_group_ratings\.user_average_rating\)/u);
assert.match(migration, /revoke all on function public\.get_display_group_community_stats\(jsonb\) from public/u);
assert.match(migration, /grant execute on function public\.get_display_group_community_stats\(jsonb\) to anon, authenticated/u);
assert.doesNotMatch(migration, /\b(?:insert|update|delete|alter\s+table|drop\s+table)\b/iu);

console.log("display-group community stats regression tests passed");
