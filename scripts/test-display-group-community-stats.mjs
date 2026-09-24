import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260924065645_restrict_display_group_community_stats.sql", import.meta.url),
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

// H: the client supplies only reviewed group IDs. Exact persisted rating keys
// are held in a private server-side map, so aliases cannot be caller-injected.
assert.match(app, /p_display_group_ids: displayGroupIds/u);
assert.doesNotMatch(app, /communityStatsStoredKeysByCanonical|p_groups|podcast_keys: \[\.\.\.new Set/u);

// G/I: editorial aggregation and the existing per-season own-rating helper
// remain separate from the community RPC.
assert.match(app, /ratingValue: averageNumbers\(editorialRatings\)/u);
assert.match(app, /function getDisplayGroupOwnRatingStats\(members\)/u);
assert.match(app, /DISPLAY_GROUP_COMMUNITY_STATS_RPC/u);
assert.doesNotMatch(app, /function getDisplayGroupUserStats\(group\)[\s\S]{0,500}weightedTotal/u);

// The migration is additive and only returns a group ID plus aggregates. It
// validates IDs through a private reviewed-membership map and has no rating
// DML. An unknown ID joins no map row, so it cannot aggregate arbitrary keys.
assert.match(migration, /security definer/u);
assert.match(migration, /private\.display_group_rating_members/u);
assert.match(migration, /p_display_group_ids text\[\]/u);
assert.match(migration, /join requested_group_ids[\s\S]*members\.display_group_id/u);
assert.match(migration, /group by requested_members\.display_group_id, effective_user_ratings\.user_id/u);
assert.match(migration, /avg\(per_user_group_ratings\.user_average_rating\)/u);
assert.match(migration, /set search_path = ''/u);
assert.match(migration, /revoke all on function public\.get_display_group_community_stats\(text\[\]\) from public/u);
assert.match(migration, /grant execute on function public\.get_display_group_community_stats\(text\[\]\) to anon, authenticated/u);
assert.doesNotMatch(migration, /\b(?:insert into|update|delete from)\s+public\.(?:user_ratings|episode_ratings)\b/iu);
assert.doesNotMatch(migration, /user_id.*returns|rating.*returns/iu);

function extractFunction(name) {
  const marker = `async function ${name}(`;
  const start = app.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${name}`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

// Failure/rollout regression: the optional RPC clears only group stats. The
// already-loaded normal per-podcast aggregate remains usable and no stale
// group result survives a failed refresh.
const ordinaryStats = { "ordinary-podcast": { averageRating: 8, ratingCount: 2 } };
const warnings = [];
const context = {
  DISPLAY_GROUP_COMMUNITY_STATS_RPC: "get_display_group_community_stats",
  console: { warn: (...args) => warnings.push(args) },
  state: {
    communityStatsRequestToken: 1,
    podcastDisplayGroupsReady: true,
    podcastDisplayGroupsVersion: 1,
    communityStatsByKey: ordinaryStats,
    displayGroupCommunityStatsById: { stale: { averageRating: 9, ratingCount: 1 } },
    supabase: { rpc: async () => ({ data: null, error: new Error("missing RPC") }) }
  },
  buildDisplayGroupCommunityStatsRequest: () => ["narkobetjenten"],
  normalizeText: (value) => String(value ?? "").trim(),
  parseNumber: (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  },
  Math,
  Object
};
vm.createContext(context);
vm.runInContext(extractFunction("fetchDisplayGroupCommunityStats"), context);
await context.fetchDisplayGroupCommunityStats(1);
assert.equal(JSON.stringify(context.state.displayGroupCommunityStatsById), "{}");
assert.deepEqual(context.state.communityStatsByKey, ordinaryStats);
assert.equal(warnings.length, 1);

context.state.supabase.rpc = async () => ({
  data: [{ display_group_id: "narkobetjenten", average_rating: 7.45, rating_count: 1 }],
  error: null
});
await context.fetchDisplayGroupCommunityStats(1);
assert.equal(
  JSON.stringify(context.state.displayGroupCommunityStatsById),
  JSON.stringify({ narkobetjenten: { averageRating: 7.45, ratingCount: 1 } })
);

console.log("display-group community stats regression tests passed");
