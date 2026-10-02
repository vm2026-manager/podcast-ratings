// Dependency-free structural regression test. This checks the SQL contract;
// it does not execute PostgreSQL or connect to Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261002123932_narkobetjenten_24_seasons.sql");
const membershipMigration = read("../supabase/migrations/20260924065645_restrict_display_group_community_stats.sql");
const group = JSON.parse(read("../data/podcast-display-groups.json")).groups.find(
  (candidate) => candidate.id === "narkobetjenten"
);
assert.ok(group, "Narkobetjenten config must exist");

const editorialSeasons = [1, 2, 3, 6, 7, 9, 10, 11, 12, 13, 14, 15];
const newSeasons = [4, 5, 8, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const editorialKeys = editorialSeasons.map((season) =>
  `${[1, 2, 3, 6].includes(season) ? "narkobetjenten og den kriminelle underverden" : "narkobetjenten"} sæson ${season}`
);
const newKeys = newSeasons.map((season) => `display-season:narkobetjenten:${season}`);
const expectedKeys = [...editorialKeys, ...newKeys].sort();
assert.deepEqual([...group.memberLegacyKeys].sort(), [...editorialKeys].sort());
assert.deepEqual(group.seasonIdentities.map((season) => season.podcast_key).sort(), [...newKeys].sort());
assert.deepEqual([...editorialSeasons, ...newSeasons].sort((a, b) => a - b),
  Array.from({ length: 24 }, (_, index) => index + 1));

// Preserve quoted literals while removing comments. This deliberately accepts
// only the migration's simple SQL subset, not arbitrary PostgreSQL programs.
function stripComments(sql) {
  return sql.replace(/'(?:''|[^'])*'|--[^\r\n]*|\/\*[\s\S]*?\*\//g,
    (token) => token.startsWith("'") ? token : " ");
}
const compact = (sql) => stripComments(sql).replace(/\s+/g, " ").trim().toLowerCase();

function validateMigration(sql) {
  const clean = stripComments(sql);
  const code = clean.replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(code, /\b(?:delete|truncate|drop|update|merge|execute|call|copy|grant)\b/i,
    "No destructive statements, rating rewrites, dynamic SQL or expanded grants");
  assert.doesNotMatch(code, /["$]/, "Unexpected quoted identifiers or dollar-quoted SQL require review");
  const statements = clean.split(";").map((statement) => statement.trim()).filter(Boolean);
  assert.equal(statements.length, 3, "Only BEGIN, membership INSERT and COMMIT are allowed");
  assert.equal(compact(statements[0]), "begin");
  assert.equal(compact(statements[2]), "commit");

  const insert = statements[1].match(/^insert\s+into\s+private\.display_group_rating_members\s*\(\s*display_group_id\s*,\s*podcast_key\s*\)\s+values\s+([\s\S]+?)\s+on\s+conflict\s*\(\s*display_group_id\s*,\s*podcast_key\s*\)\s+do\s+nothing$/i);
  assert.ok(insert, "Only insert members, with ON CONFLICT (display_group_id, podcast_key) DO NOTHING");
  const tuples = [...insert[1].matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)];
  assert.equal(insert[1].replace(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g, "").replace(/[\s,]/g, ""), "",
    "Membership values must consist only of explicit key tuples");
  assert.equal(tuples.length, 24, "Exactly 24 season memberships");
  assert.ok(tuples.every((tuple) => tuple[1] === "narkobetjenten"), "Every display_group_id must be narkobetjenten");
  const keys = tuples.map((tuple) => tuple[2]);
  assert.equal(new Set(keys).size, 24, "No duplicate season keys");
  assert.ok(keys.every((key) => !/narkobetjenten p[åa] gaden/i.test(key)), "På gaden must remain separate");
  assert.deepEqual([...keys].sort(), expectedKeys, "Exact editorial and synthetic keys must all be covered");
  for (const key of newKeys) assert.ok(keys.includes(key), `Missing new season: ${key}`);
}

validateMigration(migration);
// The current main already owns the aggregate RPC and its composite key.
// This feature extends its map without replacing the RPC, view or policies.
const existing = compact(membershipMigration);
assert.match(existing, /primary key \(display_group_id, podcast_key\)/);
assert.match(existing, /group by requested_members\.display_group_id, effective_user_ratings\.user_id/);
assert.match(existing, /avg\(per_user_group_ratings\.user_average_rating\)/);
const existingKeys = [...membershipMigration.matchAll(/\('narkobetjenten', '([^']+)'\)/g)].map((match) => match[1]);
assert.deepEqual(existingKeys.sort(), [...editorialKeys].sort(), "Existing editorial membership must remain covered");

// Negative controls prove that the structural guards reject the regressions
// they protect against, rather than merely finding expected text in comments.
for (const [name, changed] of [
  ["missing season", migration.replace(/\s*\('narkobetjenten', 'display-season:narkobetjenten:4'\),/, "")],
  ["duplicate key", migration.replace("'display-season:narkobetjenten:24'", "'display-season:narkobetjenten:23'")],
  ["wrong group", migration.replace("('narkobetjenten',", "('another-group',")],
  ["På gaden included", migration.replace("'display-season:narkobetjenten:24'", "'narkobetjenten pa gaden sæson 1'")],
  ["conflict overwrites", migration.replace("do nothing", "do update set display_group_id = excluded.display_group_id")],
  ["ratings deleted", `${migration}\ndelete from public.user_ratings;`],
  ["ratings overwritten", `${migration}\nupdate public.user_ratings set rating = 0;`],
  ["ratings inserted", `${migration}\ninsert into public.user_ratings values ('x', 'y', 0);`],
  ["destructive DDL", `${migration}\ndrop table public.user_ratings;`],
  ["ratings truncated", `${migration}\ntruncate public.episode_ratings;`]
]) {
  assert.notEqual(changed, migration, `${name}: mutation must take effect`);
  assert.throws(() => validateMigration(changed), assert.AssertionError, `${name}: must be rejected`);
}
console.log("PASS: structural migration checks — 24 exact seasons, 12 new keys, På gaden excluded, safe private membership insert, no rating writes/destructive SQL, existing aggregate RPC preserved (no external dependencies).");
