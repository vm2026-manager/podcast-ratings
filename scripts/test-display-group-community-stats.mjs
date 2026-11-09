import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260924065645_restrict_display_group_community_stats.sql", import.meta.url),
  "utf8"
);
const directRatingMigration = readFileSync(
  new URL("../supabase/migrations/20261107185417_prioritize_display_group_direct_ratings.sql", import.meta.url),
  "utf8"
);

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// This mirrors the aggregate-only SQL contract: first reduce all included
// season ratings to one arithmetic mean per user, then average those users.
function displayGroupStats(rows, memberKeys, directGroupRatings = [], directGroupKey = "display-group:test") {
  const ratingsByUser = new Map();
  for (const row of rows) {
    if (!memberKeys.includes(row.podcastKey)) continue;
    const ratings = ratingsByUser.get(row.user) || [];
    ratings.push(row.rating);
    ratingsByUser.set(row.user, ratings);
  }
  const directByUser = new Map(directGroupRatings
    .filter((row) => row.podcastKey === directGroupKey)
    .map((row) => [row.user, row.rating]));
  const userIds = new Set([...ratingsByUser.keys(), ...directByUser.keys()]);
  const userAverages = [...userIds].map((user) => ratingsByUser.has(user)
    ? average(ratingsByUser.get(user))
    : directByUser.get(user));
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

// Once a user has rated any season, those season ratings determine that
// user's group score. A direct-only user still contributes once. The applied
// production SQL currently has the earlier direct-first priority; because
// production writes are not part of this task, that function remains an
// explicitly documented follow-up instead of an automatic migration.
stats = displayGroupStats(
  [...oneUserSixSeasons, { user: "user-b", podcastKey: "season-1", rating: 10 }],
  seasons,
  [
    { user: "user-a", podcastKey: "display-group:test", rating: 4 },
    { user: "user-c", podcastKey: "display-group:test", rating: 6 },
    { user: "user-d", podcastKey: "display-group:other", rating: 10 }
  ]
);
assert.deepEqual(stats, { averageRating: 23.5 / 3, ratingCount: 3 });

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
assert.match(app, /function getDisplayGroupOwnRatingStats\(members, displayGroup = null\)/u);
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

// The rollout migration changes only the aggregate function. Explicit group
// ratings override the user's season average, while group membership stays
// private and existing season/episode ratings remain the fallback.
assert.match(directRatingMigration, /ratings\.podcast_key = 'display-group:' \|\| requested_group_ids\.display_group_id/u);
assert.match(directRatingMigration, /where requested_group_ids\.display_group_id = 'kirsten-ringer-til-rasmus'/u,
  "direct-rating community priority is scoped to Kirsten");
assert.match(directRatingMigration, /coalesce\(max\(direct_group_ratings\.rating\), avg\(effective_user_ratings\.rating\)\)/u);
assert.match(directRatingMigration, /group_user_ids[\s\S]*union[\s\S]*direct_group_ratings/u);
assert.match(directRatingMigration, /count\(per_user_group_ratings\.user_id\)::integer/u);
assert.match(directRatingMigration, /set search_path = ''/u);
assert.match(directRatingMigration, /revoke all on function public\.get_display_group_community_stats\(text\[\]\) from public/u);
assert.match(directRatingMigration, /grant execute on function public\.get_display_group_community_stats\(text\[\]\) to anon, authenticated/u);
assert.doesNotMatch(directRatingMigration, /\b(?:insert into|update|delete from)\s+public\.(?:user_ratings|episode_ratings|podcast_episodes)\b/iu);

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
  , refreshOpenPodcastDetailSheet: () => {}
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

// Concurrent refresh paths share one RPC for the same reviewed group version.
let resolveConcurrentRpc;
let concurrentRpcCalls = 0;
context.state.displayGroupCommunityStatsPromiseKey = "";
context.state.displayGroupCommunityStatsPromise = null;
context.state.supabase.rpc = () => {
  concurrentRpcCalls += 1;
  return new Promise((resolve) => { resolveConcurrentRpc = resolve; });
};
const concurrentA = context.fetchDisplayGroupCommunityStats(1);
const concurrentB = context.fetchDisplayGroupCommunityStats(1);
assert.equal(concurrentRpcCalls, 1, "startup and community refresh cannot duplicate the group RPC");
resolveConcurrentRpc({ data: [], error: null });
await Promise.all([concurrentA, concurrentB]);
assert.equal(context.state.displayGroupCommunityStatsPromise, null, "the in-flight promise is cleared after resolution");

console.log("display-group community stats regression tests passed");
