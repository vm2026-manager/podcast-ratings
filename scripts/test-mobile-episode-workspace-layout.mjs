import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, css] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../mobile-episode-expansion.css", import.meta.url), "utf8")
]);

const overviewStart = app.indexOf("function renderPodcastEpisodeOverview(podcast)");
const overview = app.slice(overviewStart, app.indexOf("\nfunction ", overviewStart + 1));
assert.ok(overviewStart >= 0, "episode workspace renderer exists");
assert.match(
  overview,
  /podcast-detail-sheet__episode-mobile-column-header">\s*<p class="podcast-detail-sheet__episode-workspace-summary" data-episode-workspace-summary aria-live="polite">\$\{escapeHtml\(getEpisodeWorkspaceSummary\(podcast\)\)\}<\/p>\s*<span aria-hidden="true">Din vurdering<\/span>/u,
  "the dynamic summary and mobile rating label share one header container"
);
assert.match(
  app,
  /querySelector\("\[data-episode-workspace-summary\]"\)[\s\S]*?summary\.textContent = getEpisodeWorkspaceSummary\(podcast\)/u,
  "the shared-header summary remains dynamically updated"
);

const mobileRulesStart = css.indexOf("@media (max-width: 768px)");
const mobileRules = css.slice(mobileRulesStart);
assert.match(
  mobileRules,
  /episode-overview \{\s*display: grid !important;\s*gap: 0 !important;/u,
  "the overview does not stack a global gap below the mobile column header"
);
assert.match(
  css.slice(0, mobileRulesStart),
  /episode-mobile-column-header > span \{\s*display: none;/u,
  "the mobile-only rating companion is hidden outside the mobile breakpoint"
);
assert.match(
  mobileRules,
  /episode-mobile-column-header \{\s*display: grid !important;\s*grid-template-columns: minmax\(0, 1fr\) 120px !important;\s*column-gap: 12px !important;\s*align-items: baseline !important;\s*\/\* Match the table wrapper's 10px inset plus each card's 16px gutter\. \*\/\s*padding: 10px 26px 5px !important;/u,
  "the shared mobile header uses the same two-column geometry with compact, explicit vertical spacing"
);
assert.match(
  mobileRules,
  /episode-table-wrap \{\s*max-height: none !important;\s*overflow: visible !important;[\s\S]*?padding: 0 10px 10px !important;/u,
  "the table wrapper keeps its horizontal inset without adding top spacing below the column header"
);
assert.match(
  mobileRules,
  /episode-mobile-column-header \.podcast-detail-sheet__episode-workspace-summary \{\s*grid-column: 1 !important;\s*grid-row: 1 !important;\s*align-self: baseline !important;[\s\S]*?padding: 0 !important;/u,
  "the dynamic summary occupies the first header column on the shared row"
);
assert.match(
  mobileRules,
  /episode-mobile-column-header span \{\s*display: block !important;\s*grid-column: 2 !important;\s*grid-row: 1 !important;\s*align-self: baseline !important;/u,
  "the rating label occupies the second shared-row column"
);
assert.match(
  css,
  /episode-own-score \{[\s\S]*?min-width: 120px !important;/u,
  "the header column matches the existing mobile rating button width"
);

console.log("Mobile episode workspace layout regression checks passed.");
