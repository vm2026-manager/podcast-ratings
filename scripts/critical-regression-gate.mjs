import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  ["Har du hørt source identity and episode visibility", ["--experimental-strip-types", "scripts/test-har-du-hoert-source-boundary.mjs"]],
  ["Sheet feed override safety and audit", ["--experimental-strip-types", "scripts/test-sheet-feed-overrides.mjs"]],
  ["homepage community momentum", ["scripts/test-homepage-community-momentum.mjs"]],
  ["Static podcast recommendation landing page", ["scripts/test-seo-podcast-anbefalinger.mjs"]],
  ["SEO podcast rendering and existing URLs", ["scripts/test-seo-podcast-pages.mjs"]],
  ["SEO generator safety", ["scripts/test-seo-podcast-safety.mjs"]],
  ["Krop til salg identity-preserving Podimo sync", ["--experimental-strip-types", "scripts/test-krop-podimo-migration.mjs"]],
  ["Podimo pagination and existing sources", ["--experimental-strip-types", "scripts/test-podimo-grebet-routing.mjs"]],
  ["Småt Brændbart and 112 for knuste hjerter Podimo import identities", ["--experimental-strip-types", "scripts/test-two-podimo-show-imports.mjs"]],
  ["Bounded cross-source episode URL lookup preserves existing IDs", ["--experimental-strip-types", "scripts/test-cross-source-episode-url-batching.mjs"]],
  ["Episode feed configuration coverage", ["--experimental-strip-types", "scripts/test-episode-feed-coverage.mjs"]],
  ["sheet access source isolation", ["scripts/test-sync-sheet-access.mjs"]],
  ["Flashback parent identity preservation", ["scripts/test-flashback-parent-preservation.mjs"]],
  ["catalogue identity alerts", ["scripts/test-catalogue-identity-alert.mjs"]],
  ["production catalogue health", ["scripts/test-production-catalogue-health.mjs"]],
  ["display-group catalogue", ["scripts/validate-podcast-display-groups.mjs"]],
  ["Narkobetjenten seasons", ["scripts/test-narkobetjenten-seasons.mjs"]],
  ["Narkobetjenten public display and community season eligibility", ["scripts/test-narkobetjenten-public-display.mjs"]],
  ["app.js syntax", ["--check", "app.js"]],
  ["Bakspejl local cover availability", ["scripts/test-bakspejl-cover-availability.mjs"]],
  ["cover identity resolution", ["scripts/test-cover-identity-resolution.mjs"]],
  ["DR Tyran unique series covers", ["scripts/test-tyran-individual-covers.mjs"]],
  ["Flashback exact uploaded originals and identity routing", ["scripts/test-flashback-original-covers.mjs"]],
  ["Det levende bevis DR cover identity and stale override removal", ["scripts/test-det-levende-bevis-cover.mjs"]],
  ["cover source freshness", ["scripts/test-cover-source-freshness.mjs"]],
  ["manual cover intake identity", ["scripts/test-manual-cover-intake.mjs"]],
  ["startup rating hydration", ["scripts/test-startup-rating-hydration.mjs"]],
  ["ranking movement scoring, entrant stability, and 1,300-item ranks", ["scripts/test-ranking-movement.mjs"]],
  ["ranking movement hydration lifecycle", ["scripts/test-ranking-movement-load-lifecycle.mjs"]],
  ["community ranking load safety", ["scripts/test-community-ranking-load-safety.mjs"]],
  ["mobile home search stays open during data refresh", ["scripts/test-mobile-home-search-overlay-lifecycle.mjs"]],
  ["episode archive/source", ["scripts/test-podcast-episode-archive-source-regression.mjs"]],
  ["Tipsbladet Transferguru identity and routing", ["--experimental-strip-types", "scripts/test-tipsbladet-transferguru-routing.mjs"]],
  ["Djævlen umbrella routing", ["--experimental-strip-types", "scripts/test-djaevlen-umbrella-routing.mjs"]],
  ["Bakspejl umbrella routing", ["--experimental-strip-types", "scripts/test-bakspejl-umbrella-routing.mjs"]],
  ["New DR umbrella series monitor", ["--experimental-strip-types", "scripts/test-monitor-dr-umbrella-series.mjs"]],
  ["DR Lyd supplemental full episodes and RSS identity preservation", ["--experimental-strip-types", "scripts/test-dr-lyd-supplemental-umbrella.mjs"]],
  ["Future verified DR single-episode discovery", ["--experimental-strip-types", "scripts/test-dr-full-standalone-discovery.mjs"]],
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
  ["manual episode rating protection", ["--experimental-strip-types", "scripts/test-manual-episode-identity-protection.mjs"]],
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
