import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  ["catalogue identity alerts", ["scripts/test-catalogue-identity-alert.mjs"]],
  ["display-group catalogue", ["scripts/validate-podcast-display-groups.mjs"]],
  ["Narkobetjenten seasons", ["scripts/test-narkobetjenten-seasons.mjs"]],
  ["app.js syntax", ["--check", "app.js"]],
  ["Bakspejl local cover availability", ["scripts/test-bakspejl-cover-availability.mjs"]],
  ["cover identity resolution", ["scripts/test-cover-identity-resolution.mjs"]],
  ["cover source freshness", ["scripts/test-cover-source-freshness.mjs"]],
  ["startup rating hydration", ["scripts/test-startup-rating-hydration.mjs"]],
  ["episode archive/source", ["scripts/test-podcast-episode-archive-source-regression.mjs"]],
  ["Djævlen umbrella routing", ["--experimental-strip-types", "scripts/test-djaevlen-umbrella-routing.mjs"]],
  ["Mediano episode workspace", ["scripts/test-mediano-episode-workspace-config.mjs"]],
  ["episode detail DOM stability", ["scripts/test-podcast-detail-episode-load-dom-stability.mjs"]],
  ["episode own-rating lock", ["scripts/test-podcast-detail-own-rating-lock-behavior.mjs"]],
  ["mobile podcast-detail rating alignment", ["scripts/test-mobile-podcast-detail-regressions.mjs"]],
  ["mobile episode workspace layout", ["scripts/test-mobile-episode-workspace-layout.mjs"]],
  ["episode canonical identity", ["scripts/validate-episode-canonical-identity.mjs"]],
  ["legacy community rating identity", ["scripts/test-community-rating-identity.mjs"]],
  ["display-group unique community users", ["scripts/test-display-group-community-stats.mjs"]],
  ["display-group community readiness", ["scripts/test-display-group-community-readiness.mjs"]],
  ["display-group modal lifecycle", ["scripts/test-display-group-modal-lifecycle.mjs"]],
  ["legacy local episode identity", ["scripts/validate-local-episode-identity.mjs"]],
  ["manual catalogue episode identity", ["scripts/validate-manual-catalogue-episode-migration.mjs"]],
  ["Mediano legacy catalogue resolution", ["scripts/test-mediano-legacy-catalogue-resolution.mjs"]],
  ["Mediano historical editorial episode ratings", ["scripts/test-mediano-historical-editorial-episode-ratings.mjs"]],
  ["Mounir canonical Mediano editorial rating", ["scripts/test-mediano-mounir-canonical-editorial-rating.mjs"]],
  ["Explore stale-content guard", ["scripts/test-explore-stale-content-guard.mjs"]],
  ["Explore recommendation mix", ["scripts/test-explore-recommendation-mix.mjs"]],
  ["Explore startup warmup", ["scripts/test-explore-startup-warmup.mjs"]]
];

for (const [name, args] of checks) {
  console.log(`\n[critical-regression-gate] ${name}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    console.error(`\n[critical-regression-gate] FAILED: ${name}`);
    break;
  }
}

if (!process.exitCode) console.log("\n[critical-regression-gate] PASS");
