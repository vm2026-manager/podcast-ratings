import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const backupRoot = process.argv[2];
if (!backupRoot) throw new Error("Brug: node validate-rescued-manual-episode-ratings.mjs <backup-root>");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const bomben = {
  "bomben-01": "c7599019-1106-5e7e-a5f1-893306e57790",
  "bomben-02": "00a1b3cb-40ae-52de-8276-4d45ebf4f4c0",
  "bomben-03": "c150d333-7b03-5bcc-8c47-48c97e32d48a",
  "bomben-04": "2df98b7c-0a87-50eb-bf10-069e03e57225",
  "bomben-05": "95715ea8-c123-5bbb-b14c-e2c65f2ade81",
  "bomben-06": "8e19963d-335b-52a8-916e-c2b30d9fe466",
  "bomben-07": "12a33e5c-865a-57fb-8202-d55a2e658c01",
  "bomben-08": "faeb474e-fb2c-50c1-b5d0-bbf8de49ca1b",
  "bomben-09": "9ea45188-e72e-557f-a4bc-7796fa6781e5",
  "bomben-10": "f5428bc3-1e71-5af6-8363-93cd13708f70"
};

const ratingsBackup = JSON.parse(await readFile(
  path.join(backupRoot, "podcastlisten_local_episode_ratings_2026-08-30.json"),
  "utf8"
));
const parentsBackup = JSON.parse(await readFile(
  path.join(backupRoot, "podcastlisten_episode_parent_backups_2026-08-30.json"),
  "utf8"
));
const sql = await readFile(
  path.join(root, "supabase", "migrations", "20260830105706_rescued_manual_episode_ratings_CORRECTED.sql"),
  "utf8"
);
const userIds = Object.keys(parentsBackup.parentBackups || {});
assert(userIds.length === 1, "Backup skal indeholde præcis én authenticated user_id");
const userId = userIds[0];
const expected = Object.entries(ratingsBackup.ratings || {}).map(([legacyId, value]) => ({
  userId,
  episodeId: bomben[legacyId] || legacyId,
  rating: Number(value.rating),
  updatedAt: new Date(value.updatedAt).toISOString()
}));
assert(expected.length === 21, "Forventede 21 rescued ratings i backup");

const actual = [...sql.matchAll(/\('([^']+)'::uuid, '([^']+)'::uuid, ([0-9.]+)::numeric, '([^']+)'::timestamptz\)/g)]
  .map(([, sqlUserId, episodeId, rating, updatedAt]) => ({
    userId: sqlUserId,
    episodeId,
    rating: Number(rating),
    updatedAt: new Date(updatedAt).toISOString()
  }));
assert(actual.length === 21, "SQL skal indeholde præcis 21 rescued rows");
assert(new Set(actual.map((row) => row.episodeId)).size === 21, "SQL har duplicate rescued episode IDs");
for (const row of expected) {
  assert(
    actual.some((candidate) =>
      candidate.userId === row.userId &&
      candidate.episodeId === row.episodeId &&
      candidate.rating === row.rating &&
      candidate.updatedAt === row.updatedAt
    ),
    `Backup row mangler eller afviger: ${row.episodeId}`
  );
}
assert(sql.includes("on conflict (user_id, episode_id) do nothing"), "SQL må ikke overskrive eksisterende rating");
assert(!sql.includes("do update"), "SQL må ikke UPDATE eksisterende rating");
assert(!/\bdelete\s+from\b/i.test(sql), "SQL må ikke DELETE data");
assert(/^\s*begin;/im.test(sql) && /^\s*commit;/im.test(sql), "SQL skal være explicit transactional");
assert(sql.includes("missing canonical episode"), "SQL skal afbryde før insert ved manglende episode");

console.log(JSON.stringify({
  status: "PASS",
  rescuedRows: actual.length,
  userId: `${userId.slice(0, 8)}-…`,
  conflictPolicy: "insert-only"
}, null, 2));
