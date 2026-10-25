import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(root, "supabase", "migrations");
const migrationName = (await readdir(migrationDirectory)).find((name) =>
  /^\d+_enable_rls_episode_identity_history\.sql$/u.test(name)
);
assert.ok(migrationName, "RLS hardening migration is versioned in supabase/migrations");

const sql = await readFile(path.join(migrationDirectory, migrationName), "utf8");
const normalizedSql = sql
  .replace(/^\s*--.*$/gmu, "")
  .replace(/\s+/gu, " ")
  .trim();

assert.equal(
  normalizedSql,
  "ALTER TABLE public.episode_identity_history ENABLE ROW LEVEL SECURITY;",
  "migration only enables RLS on the audited table"
);
assert.doesNotMatch(sql, /\b(?:CREATE|ALTER|DROP)\s+POLICY\b/iu, "no client policy is opened");
assert.doesNotMatch(sql, /\b(?:GRANT|REVOKE)\b/iu, "existing table ACL is preserved");
assert.doesNotMatch(sql, /\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/iu, "trusted owner and SECURITY DEFINER behavior is preserved");
assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/iu, "migration does not touch production data");
assert.doesNotMatch(sql, /\b(?:CREATE|DROP)\s+TRIGGER\b/iu, "episode identity triggers are unchanged");

console.log("Episode identity history RLS migration contract: PASS");
