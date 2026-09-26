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
  /podcast-detail-sheet__episode-mobile-column-header" aria-hidden="true">\s*<span>Din vurdering<\/span>/u,
  "mobile workspace provides a visible companion to the hidden table column header"
);

const mobileRulesStart = css.indexOf("@media (max-width: 768px)");
const mobileRules = css.slice(mobileRulesStart);
assert.match(
  css.slice(0, mobileRulesStart),
  /episode-mobile-column-header \{\s*display: none;/u,
  "the companion header is hidden outside the mobile breakpoint"
);
assert.match(
  mobileRules,
  /episode-workspace-summary \{\s*box-sizing: border-box !important;\s*margin: 0 !important;\s*\/\* Align with the table wrapper's 10px inset plus each card's 16px gutter\. \*\/\s*padding: 0 26px !important;/u,
  "episode count uses the table inset and card gutter"
);
assert.match(
  mobileRules,
  /episode-mobile-column-header \{\s*display: grid !important;\s*grid-template-columns: minmax\(0, 1fr\) 120px !important;\s*padding: 0 16px 7px !important;/u,
  "mobile header reserves the exact rating-button column width"
);
assert.match(
  mobileRules,
  /episode-mobile-column-header span \{\s*grid-column: 2 !important;/u,
  "mobile header label is placed in the rating-button column"
);
assert.match(
  css,
  /episode-own-score \{[\s\S]*?min-width: 120px !important;/u,
  "the header column matches the existing mobile rating button width"
);

console.log("Mobile episode workspace layout regression checks passed.");
