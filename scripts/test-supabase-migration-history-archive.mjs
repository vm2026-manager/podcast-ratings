import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archiveRelative = "supabase/migration-history/production/20261008093805_protect_episode_identity_and_ratings.sql";
const archivePath = path.join(root, archiveRelative);
const source = await readFile(archivePath);
const sql = source.toString("utf8");

assert.equal(source.byteLength, 3600, "Recovered production SQL byte length changed");
assert.equal(
  createHash("md5").update(source).digest("hex"),
  "6c2c3e22bce1097dae2abc8d05779f67",
  "Recovered production SQL checksum changed"
);

const activeMigrations = await readdir(path.join(root, "supabase/migrations"));
assert.ok(
  !activeMigrations.some((file) => file.startsWith("20261008093805_")),
  "Forensic historical SQL must not be discovered as a runnable migration"
);
assert.match(sql, /create table if not exists public\.episode_identity_history/i);
assert.match(sql, /revoke all on public\.episode_identity_history from anon, authenticated/i);
assert.match(sql, /security definer/i);
assert.match(sql, /create trigger trg_protect_episode_identity_and_ratings/i);

const successorPath = path.join(root, "supabase/migrations/20261008112000_protect_manual_episode_identities.sql");
const successor = await readFile(successorPath, "utf8");
assert.match(successor, /drop trigger if exists trg_protect_episode_identity_and_ratings/i);
assert.match(successor, /create trigger podcast_episodes_protect_identity/i);
assert.ok("20261008112000" > "20261008093805", "The local successor must remain later than the archived historical source");

console.log("PASS: archived production migration source matches its verified checksum and stays out of executable migrations");
