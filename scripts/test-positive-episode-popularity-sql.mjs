// Run against an isolated in-memory PostgreSQL engine, never a remote database:
// npm install --prefix /tmp/podcast-sql-test --no-audit --no-fund @electric-sql/pglite@0.3.14
// node scripts/test-positive-episode-popularity-sql.mjs /tmp/podcast-sql-test/node_modules/@electric-sql/pglite/dist/index.js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

assert.ok(process.argv[2], "Pass the path to the local PGlite module (see file header)");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const root = new URL("../", import.meta.url);
const oldSql = await readFile(new URL("supabase/migrations/20260921092820_add_public_rating_momentum_stats.sql", root), "utf8");
const newSql = await readFile(new URL("supabase/migrations/20261014113719_renew_positive_episode_popularity_activity.sql", root), "utf8");

try {
  await db.exec(`
    begin;
    create table public.user_ratings (
      user_id text, podcast_key text, rating numeric,
      created_at timestamptz, updated_at timestamptz,
      primary key (user_id, podcast_key)
    );
    create table public.podcast_episodes (
      id text primary key, podcast_key text, is_active boolean
    );
    create table public.episode_ratings (
      user_id text, episode_id text references public.podcast_episodes(id), rating numeric,
      created_at timestamptz, updated_at timestamptz,
      primary key (user_id, episode_id)
    );
  `);
  const direct = (podcast, user, rating = 8, age = 120, edited = null) => db.query(
    `insert into public.user_ratings values ($1, $2, $3,
       now() - $4 * interval '1 day', now() - $5 * interval '1 day')`,
    [user, podcast, rating, age, edited]
  );
  let episodeNumber = 0;
  async function episode(podcast, user, rating, age, edited = null, active = true) {
    const id = `exact-episode-ID:${++episodeNumber}`;
    await db.query("insert into public.podcast_episodes values ($1, $2, $3)", [id, podcast, active]);
    await db.query(`insert into public.episode_ratings values ($1, $2, $3,
      now() - $4 * interval '1 day', now() - $5 * interval '1 day')`, [user, id, rating, age, edited]);
  }
  // Repeated episodes and a recent direct rating still contribute just one user.
  await direct("repeat", "a", 8);
  for (const age of [1, 2, 3, 15, 45]) await episode("repeat", "a", 9, age);
  await direct("already-recent", "a", 8, 1);
  await episode("already-recent", "a", 10, 2);

  // Different users count independently, including an episode-only user.
  await direct("unique", "a", 8);
  await direct("unique", "b", 6);
  await episode("unique", "a", 7, 1);
  await episode("unique", "a", 10, 2);
  await episode("unique", "b", 8, 15);
  await episode("unique", "c", 9, 45);
  await episode("unique", "c", 7, 50);

  await direct("bad", "a");
  await episode("bad", "a", 6.9, 1);
  await episode("bad", "a", 1, 2);
  await direct("edited-old", "a");
  await episode("edited-old", "a", 10, 120, 1);
  await direct("edited-30d", "a");
  await episode("edited-30d", "a", 7, 15, 1);
  await direct("new-bad-after-positive", "a");
  await episode("new-bad-after-positive", "a", 7, 45);
  await episode("new-bad-after-positive", "a", 2, 1);
  await direct("direct-edit", "a", 5, 120, 1);
  await episode("direct-edit", "a", 10, 45);

  // Preserve all episode-only behavior, including bad ratings and old edits.
  await episode("episode-only-edited", "a", 2, 120, 1);
  await episode("episode-only-edited", "a", 10, 130);
  await episode("episode-only-bad", "a", 1, 15);
  await direct("inactive", "a");
  await episode("inactive", "a", 10, 1, null, false);
  await direct("older-positive", "a", 8, 15);
  await episode("older-positive", "a", 10, 45);

  for (const age of [7, 30, 90, 91]) {
    await direct(`boundary-${age}`, "a");
    await episode(`boundary-${age}`, "a", 7, age);
  }
  // Same user on a separate canonical/legacy key cannot transfer activity.
  await direct("legacy-alias:unchanged", "a");
  await direct("direct-only", "a", 9, 45);

  await db.exec(oldSql);
  await db.exec("create role popularity_test_reader; grant select on public.podcast_rating_combined_public_stats to popularity_test_reader;");
  const stats = async () => (await db.query("select * from public.podcast_rating_combined_public_stats order by podcast_key")).rows;
  const contract = async () => (await db.query(`select column_name, data_type, ordinal_position
    from information_schema.columns where table_schema = 'public'
      and table_name = 'podcast_rating_combined_public_stats' order by ordinal_position`)).rows;
  const oldStats = await stats();
  const oldContract = await contract();
  const security = async () => (await db.query(`select relowner, relacl::text, reloptions
    from pg_class where oid = 'public.podcast_rating_combined_public_stats'::regclass`)).rows;
  const oldSecurity = await security();
  const sources = async () => (await db.query(`select
    (select jsonb_agg(t order by user_id, podcast_key) from public.user_ratings t) as direct,
    (select jsonb_agg(t order by id) from public.podcast_episodes t) as episodes,
    (select jsonb_agg(t order by user_id, episode_id) from public.episode_ratings t) as ratings`)).rows;
  const before = await sources();
  await db.exec(newSql);
  const newStats = await stats();
  assert.deepEqual(await sources(), before, "migration never changes source data or identities");
  assert.deepEqual(await security(), oldSecurity, "view ownership, permissions and options are preserved");
  assert.deepEqual(await contract(), oldContract, "all columns, types and ordering remain unchanged");
  assert.deepEqual(newStats.map(({ podcast_key, average_rating, rating_count }) => ({ podcast_key, average_rating, rating_count })),
    oldStats.map(({ podcast_key, average_rating, rating_count }) => ({ podcast_key, average_rating, rating_count })),
    "every podcast retains its exact average and unique rating count");
  const byKey = new Map(newStats.map((row) => [row.podcast_key, row]));
  const expected = {
    repeat: [1, 1, 1, 1],
    "already-recent": [1, 1, 1, 1],
    unique: [1, 2, 3, 1.45],
    bad: [0, 0, 0, 0],
    "edited-old": [0, 0, 0, 0],
    "edited-30d": [0, 1, 1, 0.35],
    "new-bad-after-positive": [0, 0, 1, 0.1],
    "direct-edit": [1, 1, 1, 1],
    "episode-only-edited": [1, 1, 1, 1],
    "episode-only-bad": [0, 1, 1, 0.35],
    inactive: [0, 0, 0, 0],
    "older-positive": [0, 1, 1, 0.35],
    "boundary-7": [1, 1, 1, 1],
    "boundary-30": [0, 1, 1, 0.35],
    "boundary-90": [0, 0, 1, 0.1],
    "boundary-91": [0, 0, 0, 0],
    "legacy-alias:unchanged": [0, 0, 0, 0],
    "direct-only": [0, 0, 1, 0.1]
  };
  for (const [key, values] of Object.entries(expected)) {
    const row = byKey.get(key);
    assert.deepEqual([row.recent_users_7d, row.recent_users_30d, row.recent_users_90d, Number(row.momentum_score)], values, key);
  }
  assert.equal(Number(byKey.get("repeat").average_rating), 8, "direct rating wins over five positive episodes");
  assert.equal(byKey.get("repeat").rating_count, 1);
  assert.equal(Number(byKey.get("unique").average_rating), (8 + 6 + 8) / 3);
  assert.equal(byKey.get("unique").rating_count, 3);
  for (const key of ["episode-only-edited", "episode-only-bad", "direct-only", "legacy-alias:unchanged"]) {
    assert.deepEqual(byKey.get(key), oldStats.find((row) => row.podcast_key === key), `${key} is entirely unchanged`);
  }
  // Replacing the view again must be safe and must not mutate any source rows.
  await db.exec(newSql);
  assert.deepEqual(await sources(), before, "migration never changes source data or identities");
  assert.deepEqual(await stats(), newStats, "migration is repeatable");
  await db.exec("rollback");
  console.log("Positive episode popularity SQL regression checks passed (18 synthetic podcasts).");
} finally {
  await db.close();
}
