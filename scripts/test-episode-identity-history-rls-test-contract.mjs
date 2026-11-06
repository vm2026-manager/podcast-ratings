import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/episode-identity-history-rls.yml", "utf8");
const sql = await readFile("scripts/sql/episode-identity-history-rls-test.sql", "utf8");

assert.match(workflow, /image:\s*postgres:16-alpine/u);
assert.match(workflow, /POSTGRES_DB:\s*episode_identity_history_rls_test/u);
assert.match(workflow, /PGPASSWORD:\s*test-only-password/u);
assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./iu, "isolated RLS test must not use repository credentials");
assert.doesNotMatch(workflow, /SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|SERVICE_ROLE_KEY)/iu);
assert.match(sql, /current_database\(\)\s*<>\s*'episode_identity_history_rls_test'/u);
assert.match(sql, /\\ir\s+\.\.\/\.\.\/supabase\/migrations\/20261025072328_enable_rls_episode_identity_history\.sql/u);
assert.match(sql, /ARRAY\['anon', 'authenticated'\]/u);
assert.match(sql, /podcast_episodes_protect_identity/u);
assert.match(sql, /episode_ratings/u);
assert.match(sql, /ROLLBACK;/u, "synthetic fixtures must not persist after the contract test");

console.log("Episode identity history isolated PostgreSQL test contract: PASS");
