import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootUrl = new URL("../", import.meta.url);
const proposal = await readFile(new URL("docs/proposals/issue-83-season-score-community-aggregate.md", rootUrl), "utf8");
const migration = await readFile(new URL("supabase/migrations/20261107185417_prioritize_display_group_direct_ratings.sql", rootUrl), "utf8");
const sqlMatch = proposal.match(/```sql\s*([\s\S]*?)```/u);
assert.ok(sqlMatch, "the reviewed proposal contains its complete SQL function body");
const sql = sqlMatch[1];

const groupId = "kirsten-ringer-til-rasmus";
const mean = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

function aggregate({ displayGroupId = groupId, supported = true, directRows = [], seasonRows = [], episodeRows = [] }) {
  if (!supported) return { average: null, ratingCount: 0, users: [] };
  const users = [...new Set([
    ...directRows.map((row) => row.user),
    ...seasonRows.map((row) => row.user),
    ...episodeRows.filter((row) => row.active !== false).map((row) => row.user)
  ])].sort();
  const userScores = users.map((user) => {
    const directRating = Math.max(...directRows.filter((row) => row.user === user).map((row) => row.rating));
    const explicitSeasonRows = seasonRows.filter((row) => row.user === user);
    const userEpisodes = episodeRows.filter((row) => row.user === user && row.active !== false);
    const episodesBySeason = new Map();
    userEpisodes.forEach((row) => {
      const ratings = episodesBySeason.get(row.season) || [];
      ratings.push(row.rating);
      episodesBySeason.set(row.season, ratings);
    });
    const explicitBySeason = new Map(explicitSeasonRows.map((row) => [row.season, row.rating]));
    const memberSeasons = new Set([...explicitBySeason.keys(), ...episodesBySeason.keys()]);
    const effectiveMemberScores = [...memberSeasons].map((season) =>
      explicitBySeason.has(season) ? explicitBySeason.get(season) : mean(episodesBySeason.get(season))
    );
    const currentScore = Number.isFinite(directRating)
      ? directRating
      : mean(effectiveMemberScores);
    const score = displayGroupId === groupId && explicitSeasonRows.length > 0
      ? mean(explicitSeasonRows.map((row) => row.rating))
      : currentScore;
    return { user, score };
  }).filter((row) => row.score !== null);

  return {
    average: mean(userScores.map(({ score }) => score)),
    ratingCount: userScores.length,
    users: userScores
  };
}

// One direct group score remains the fallback when no season row exists.
assert.deepEqual(aggregate({ directRows: [{ user: "a", rating: 7.2 }] }), {
  average: 7.2,
  ratingCount: 1,
  users: [{ user: "a", score: 7.2 }]
});

// Explicit season rows win over an existing direct row, one season once.
let result = aggregate({
  directRows: [{ user: "a", rating: 4.1 }],
  seasonRows: [{ user: "a", season: 1, rating: 8 }]
});
assert.equal(result.average, 8, "a direct rating followed by one season resolves to the season rating");
assert.equal(result.ratingCount, 1, "the overlapping user is counted once");

result = aggregate({
  directRows: [{ user: "a", rating: 4.1 }],
  seasonRows: [{ user: "a", season: 1, rating: 8 }, { user: "a", season: 2, rating: 10 }],
  episodeRows: Array.from({ length: 12 }, (_, index) => ({ user: "a", season: 1, episode: index, rating: 2 }))
});
assert.equal(result.average, 9, "each explicit season contributes once regardless of its episode count");
assert.equal(result.ratingCount, 1);

// With no season rows left, direct rating is available again.
result = aggregate({ directRows: [{ user: "a", rating: 4.1 }], seasonRows: [] });
assert.equal(result.average, 4.1);
assert.equal(result.ratingCount, 1);

// Episodes supply the existing fallback, but cannot satisfy the explicit-season test.
result = aggregate({
  episodeRows: [
    { user: "a", season: 1, episode: "e1", rating: 4 },
    { user: "a", season: 1, episode: "e2", rating: 6 }
  ]
});
assert.equal(result.average, 5, "episode-only users keep their prior episode-derived fallback");
assert.equal(result.ratingCount, 1);
result = aggregate({
  directRows: [{ user: "a", rating: 7 }],
  episodeRows: [{ user: "a", season: 1, episode: "e1", rating: 4 }]
});
assert.equal(result.average, 7, "a direct score remains the fallback when only episodes, not seasons, exist");

// Mixed sources use explicit seasons for Kirsten; ordinary groups keep the
// old season/episode fallback and do not enter the Kirsten-only branch.
result = aggregate({
  directRows: [{ user: "a", rating: 4 }],
  seasonRows: [{ user: "a", season: 2, rating: 10 }],
  episodeRows: [
    { user: "a", season: 1, episode: "e1", rating: 4 },
    { user: "a", season: 2, episode: "e2", rating: 2 }
  ]
});
assert.equal(result.average, 10);
assert.equal(result.ratingCount, 1);
const narkobetjenten = aggregate({
  displayGroupId: "narkobetjenten",
  seasonRows: [{ user: "a", season: 15, rating: 8 }],
  episodeRows: [{ user: "a", season: 16, episode: "n1", rating: 6 }]
});
assert.equal(narkobetjenten.average, 7, "Narkobetjenten keeps its existing one-score-per-member fallback");
assert.equal(narkobetjenten.ratingCount, 1);

// A user present in several source sets still contributes one aggregate row.
result = aggregate({
  directRows: [{ user: "a", rating: 3 }, { user: "b", rating: 9 }],
  seasonRows: [{ user: "a", season: 1, rating: 7 }, { user: "a", season: 2, rating: 9 }],
  episodeRows: [{ user: "a", season: 3, episode: "e1", rating: 1 }]
});
assert.deepEqual(result.users, [{ user: "a", score: 8 }, { user: "b", score: 9 }]);
assert.equal(result.ratingCount, 2);
assert.equal(result.average, 8.5);

// Private support mapping remains authoritative; an unknown ID returns no row.
assert.deepEqual(aggregate({ displayGroupId: "unknown", supported: false }), {
  average: null,
  ratingCount: 0,
  users: []
});

// The proposed SQL changes only Kirsten's per-user precedence and retains the
// old episode fallback, unique-user union, and supported-group filter.
assert.match(sql, /from private\.display_group_rating_members as members/u);
assert.match(sql, /episode_user_ratings as \([\s\S]*?where episodes\.is_active = true/u);
assert.match(sql, /coalesce\(direct_ratings\.rating, episode_user_ratings\.rating\)/u);
assert.match(sql, /group_user_ids as \([\s\S]*?\bunion\b[\s\S]*?direct_group_ratings/u);
assert.match(sql, /when group_user_ids\.display_group_id = 'kirsten-ringer-til-rasmus'\s+and count\(direct_ratings\.podcast_key\) > 0\s+then avg\(direct_ratings\.rating\)/u);
assert.match(sql, /else coalesce\(max\(direct_group_ratings\.rating\), avg\(effective_user_ratings\.rating\)\)/u);
assert.match(sql, /join \(select distinct display_group_id from requested_members\) as supported_groups/u);
assert.match(sql, /count\(per_user_group_ratings\.user_id\)::integer as rating_count/u);
assert.match(sql, /language sql\s+stable\s+security definer\s+set search_path = ''/u);
assert.doesNotMatch(sql, /\b(?:insert into|update|delete from)\s+public\.(?:user_ratings|episode_ratings|podcast_episodes)\b/iu);
assert.doesNotMatch(sql, /\b(?:grant|revoke)\b/iu, "the proposal leaves the active ACL untouched");
assert.match(proposal, /`anon`, `authenticated`,[\s\S]*?`postgres`, and `service_role`/u);
assert.match(proposal, /`PUBLIC` has no execute grant/u);
assert.doesNotMatch(migration, /\b(?:insert into|update|delete from)\s+public\.(?:user_ratings|episode_ratings|podcast_episodes)\b/iu);

console.log("Display-group season-first aggregate proposal, episode fallback, unique users, unknown groups and unchanged-group regressions passed.");
