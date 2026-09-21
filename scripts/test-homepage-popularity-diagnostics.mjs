import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");
const css = await readFile(fileURLToPath(new URL("../style.css", import.meta.url)), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

const enabled = new Function(
  "isPodcastSuggestionAdmin", "window",
  `${extractFunction("isHomePopularDiagnosticsEnabled")}\nreturn isHomePopularDiagnosticsEnabled;`
);
assert.equal(enabled(() => false, { location: { search: "?debugPopular=1" } })(), false, "non-admin users never receive diagnostics");
assert.equal(enabled(() => true, { location: { search: "" } })(), false, "admins must explicitly activate diagnostics");
assert.equal(enabled(() => true, { location: { search: "?debugPopular=1" } })(), true, "admin debug activation works");

const render = extractFunction("renderHomePopular");
assert.match(render, /if \(isHomePopularDiagnosticsEnabled\(\)\)/u, "public render has a strict opt-in branch");
assert.match(render, /getHomeCommunityPopularSelection/u, "diagnostics and carousel share one selection result");
const panel = extractFunction("createHomePopularDiagnosticPanel");
for (const field of ["popularityScore", "establishedScore", "momentumScore", "recentUsers7d", "recentUsers30d", "recentUsers90d"]) {
  assert.match(panel, new RegExp(field, "u"), `${field} is displayed from the production candidate`);
}
assert.doesNotMatch(panel, /user_id|email|created_at|updated_at/iu, "diagnostics never render user-identifying or individual activity data");
assert.match(panel, /getPodcastKey\(podcast\)/u, "canonical podcast ID is shown");
assert.match(panel, /weightedCandidates/u, "omitted entries are derived from the real weighted selection");
assert.match(css, /\.home-popular-diagnostics__scroll \{ max-width: 100%; overflow-x: auto; \}/u, "mobile diagnostics contain wide data safely");
assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.home-popular-diagnostics/u, "diagnostics have a mobile rule");
assert.match(panel, /podcast\.title/u, "titles, including ÆØÅ, are preserved through normal escaping");

console.log("Homepage popularity diagnostics regression checks passed.");
