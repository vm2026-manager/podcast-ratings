import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");
const indexHtml = await readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const movementCss = await readFile(fileURLToPath(new URL("../ranking-movement.css", import.meta.url)), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const bodyStart = app.indexOf("{", app.indexOf(")", start) + 1);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const state = {
  rankingMovementByKey: new Map(),
  rankingMovementPeriodLabel: "siden 20. oktober",
  rankingMovementSnapshotValid: true,
  rankingPositionMode: "dynamic"
};
const eligible = () => true;
const getKey = (podcast) => podcast?.key || "";
const getId = new Function(
  "state", "isRankingMovementEligible", "getRankingMovementKey",
  `${extractFunction("getRankingMovementId")}; return getRankingMovementId;`
)(state, eligible, getKey);
const markup = new Function(
  "state", "isRankingMovementEligible", "getRankingMovementKey", "getRankingMovementId", "escapeHtml",
  `${extractFunction("getRankingMovementMarkup")}; return getRankingMovementMarkup;`
)(state, eligible, getKey, getId, (value) => String(value));
const presentation = new Function(
  "getFilteredPodcasts", `${extractFunction("getRankingPresentationPodcasts")}; return getRankingPresentationPodcasts;`
)(() => []);
const displayRank = new Function(
  "state", `${extractFunction("getRankingDisplayRank")}; return getRankingDisplayRank;`
)(state);
const podcasts = Array.from({ length: 190 }, (_, index) => ({ key: `podcast-${index + 1}`, title: `Podcast ${index + 1}` }));
podcasts[171].title = "Jagten på det evige liv";
state.rankingMovementByKey = new Map([["podcast-172", 18], ["podcast-173", -1], ["podcast-174", 0]]);

assert.equal(presentation(podcasts), podcasts, "presentation always returns the complete normal list");
assert.deepEqual(podcasts.map((podcast, index) => displayRank(index, podcast)), Array.from({ length: 190 }, (_, index) => index + 1), "full ranking positions are unique and sequential");
assert.match(markup(podcasts[171]), /ranking-movement--up/);
assert.match(markup(podcasts[171]), />▲18</, "real up arrow stays beside the #172 row");
assert.match(markup(podcasts[172]), />▼1</, "real down arrow stays beside the #173 row");
assert.match(markup(podcasts[173]), /ranking-movement--steady/);
assert.match(markup(podcasts[173]), />–</, "verified unchanged positions display an en dash");
assert.match(markup(podcasts[173]), /aria-label="Uændret placering siden 20\. oktober"/);
assert.equal(getId(podcasts[173]), "ranking-movement-podcast-174", "neutral markers have a matching accessible ID");
assert.equal(markup({ key: "podcast-not-in-snapshot" }), "", "missing cohort history does not look unchanged");
assert.equal(getId({ key: "podcast-not-in-snapshot" }), "", "no dangling ID for missing history");
assert.equal(markup({ key: "leopold ii", title: "Tyran: Leopold II" }), "", "a protected first-week listing without a comparable entry has no false marker");
state.rankingMovementSnapshotValid = false;
assert.equal(markup(podcasts[173]), "", "invalid snapshot never displays a neutral dash");
assert.equal(getId(podcasts[173]), "", "invalid snapshot has no movement ID");
state.rankingMovementSnapshotValid = true;
state.rankingPositionMode = "fixed";
assert.equal(displayRank(171, podcasts[171]), null, "fixed-position preference remains intact");

assert.doesNotMatch(app, /rankingChangesOnly|syncRankingMovementToggle|toggleRankingChangesOnly|rankingMovementToggle|Viser kun podcasts med ændret placering/);
assert.doesNotMatch(indexHtml, /rankingMovementToggle|ranking-movement-toggle|Vis &#230;ndringer/);
assert.doesNotMatch(movementCss, /ranking-movement-toggle/);
assert.match(app, /getRankingMovementMarkup\(podcast\)/, "normal rows retain automatic movement markers");
assert.match(app, /getRankingPresentationPodcasts\(\);\s*const isMobileTail/, "mobile batches and tail use the complete presentation list");
assert.match(app, /getRankingDisplayRank\(index, podcast\)/, "desktop row/card renderers keep absolute sequence ranks");
assert.match(movementCss, /\.ranking-movement--steady\s*\{\s*color:\s*#[0-9a-f]{6};/i, "neutral marker has a muted desktop color");
assert.match(movementCss, /\.podcast-card__placement \.ranking-movement[\s\S]*?color:\s*#fff/, "mobile badge markers retain readable white contrast");

console.log("Full ranking and verified movement marker regression checks passed.");
