import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = [
  {
    path: "supabase/migration-history/production/20260719203000_statement_02_podcast_episodes.sql",
    bytes: 875,
    md5: "f6339b8536db9d54594b8353b117ef9d",
    table: "public.podcast_episodes"
  },
  {
    path: "supabase/migration-history/production/20260719203000_statement_08_episode_ratings.sql",
    bytes: 498,
    md5: "db2446ce1cb1370dcab9fd1ba13a2879",
    table: "public.episode_ratings"
  }
];

for (const source of sources) {
  const bytes = await readFile(path.join(root, source.path));
  const sql = bytes.toString("utf8");
  assert.equal(bytes.byteLength, source.bytes, `${source.path} byte length changed`);
  assert.equal(createHash("md5").update(bytes).digest("hex"), source.md5, `${source.path} checksum changed`);
  assert.match(sql, new RegExp(`create table if not exists ${source.table.replaceAll(".", "\\.")}`, "i"));
  assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|COPY\s+\w+)\b/i);
}

const migrations = await readdir(path.join(root, "supabase/migrations"));
assert.ok(!migrations.some((name) => name.includes("20260719203000")), "Historical source must stay outside runnable migrations");

const baselinePath = path.join(root, "supabase/baseline/schema_only.sql");
const baseline = await readFile(baselinePath, "utf8");
const baselineDirectoryFiles = await readdir(path.join(root, "supabase/baseline"));
assert.ok(baselineDirectoryFiles.includes("schema_only.sql"));
assert.match(baseline, /CREATE TABLE public\.podcast_episodes\s*\(/i);
assert.match(baseline, /CREATE TABLE public\.episode_ratings\s*\(/i);
assert.match(baseline, /CREATE TABLE public\.manual_catalogue_episode_map\s*\(/i);
assert.match(baseline, /manual_catalogue_episode_map_episode_id_key UNIQUE \(episode_id\)/i);
assert.match(baseline, /episode_ratings_episode_id_fkey FOREIGN KEY \(episode_id\) REFERENCES podcast_episodes\(id\) ON DELETE RESTRICT/i);
assert.match(baseline, /CREATE POLICY .*episode_ratings/i);
assert.equal(
  (baseline.match(/CREATE OR REPLACE FUNCTION /g) || []).length,
  (baseline.match(/\$function\$;/g) || []).length,
  "all catalog functions need SQL terminators"
);
assert.match(baseline, /CREATE TRIGGER podcast_episodes_protect_identity/i);
assert.match(baseline, /ALTER TABLE public\.episode_ratings ENABLE ROW LEVEL SECURITY/i);
assert.doesNotMatch(baseline, /ALTER TABLE public\.episode_identity_history ENABLE ROW LEVEL SECURITY/i);
assert.match(baseline, /SET ROLE supabase_admin;[\s\S]*ALTER DEFAULT PRIVILEGES IN SCHEMA public[\s\S]*RESET ROLE;/i);
assert.doesNotMatch(baseline, /ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin/i);
assert.doesNotMatch(baseline, /https?:\/\/|sb_(?:secret|publishable)_[A-Za-z0-9]+/i, "baseline must not contain endpoints or API credentials");

const withoutFunctionBodies = baseline.replace(/(\$[A-Za-z0-9_]*\$)[\s\S]*?\1/g, "");
assert.doesNotMatch(withoutFunctionBodies, /\b(?:INSERT\s+INTO|COPY\s+.*FROM\s+stdin|UPDATE\s+[\w.]+\s+SET|DELETE\s+FROM)\b/i, "no historical table-data operation may run in the baseline");
assert.ok(!migrations.includes("schema_only.sql"), "Baseline is not a normal production migration");

console.log("Schema-only baseline provenance and no-data contract: PASS");
