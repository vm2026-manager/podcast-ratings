import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = await readFile(
  path.join(root, "supabase", "migrations", "20260910145126_create_editorial_episode_reviews.sql"),
  "utf8"
);
const catalogue = JSON.parse(await readFile(path.join(root, "data", "podcasts.json"), "utf8"));
const catalogueRows = Array.isArray(catalogue) ? catalogue : catalogue.rows;

const legacyIds = [
  "der var engang et mal af peter møller mod farum",
  "her er vores bud pa de ti spillere har været de største transfersucceser i superligaen",
  "ciao gianni",
  "vi præsenterer erik skjærbæk",
  "sadan blev han victor froholdt",
  "sagen om de 15 point forsvandt fra i lommen af den gamle dame",
  "kristjaan speakmann"
];
const ratings = ["7.3", "7.3", "7.0", "6.7", "6.7", "6.7", "5.8"];

assert.match(migration, /legacy_catalogue_podcast_id text null/);
assert.match(migration, /identity_status in \('staged', 'bound'\)/);
assert.match(migration, /identity_status = 'staged' and episode_id is null/);
assert.match(migration, /identity_status = 'bound' and episode_id is not null/);
assert.match(migration, /before update on public\.editorial_episode_reviews/);
assert.match(migration, /execute function public\.set_updated_at\(\)/);
assert.match(migration, /grant select on public\.editorial_episode_reviews to anon, authenticated/);
assert.doesNotMatch(migration, /grant (insert|update|delete|all) on public\.editorial_episode_reviews to (anon|authenticated)/);
assert.match(migration, /revoke all on table private\.editorial_episode_review_provenance from anon, authenticated/);
assert.match(migration, /on delete set null/);

for (const id of legacyIds) {
  assert.match(migration, new RegExp(`legacy_catalogue_podcast_id[^;]*${id}`, "s"));
}
for (const rating of ratings) {
  assert.match(migration, new RegExp(`, ${rating.replace('.', '\\.')}[,)]`));
}
assert.equal((migration.match(/'staged'\)/g) || []).length, 7, "expected seven staged seed records");
assert.equal((migration.match(/confirmed_mediano_page/g) || []).length, 7, "expected seven confirmed page evidence records");
assert.doesNotMatch(migration, /STOT_MEDIANO_RSS_URL|accessToken=|feed_url/i);

const snapshots = [...migration.matchAll(/\('[0-9a-f-]{36}',\s*\n\s*'(\{[\s\S]*?\})'::jsonb,\s*\n\s*'\{/g)]
  .map((match) => JSON.parse(match[1]));
assert.equal(snapshots.length, 7, "expected seven private legacy snapshots");
for (const id of legacyIds) {
  const expected = catalogueRows.find((row) => row["Podcast-ID"] === id);
  const actual = snapshots.find((snapshot) => snapshot["Podcast-ID"] === id);
  assert.deepEqual(actual, expected, `complete legacy snapshot mismatch for ${id}`);
}

console.log("Editorial episode reviews migration tests passed");
