import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const desktopCss = await readFile(fileURLToPath(new URL("../desktop-home-mockup.css", import.meta.url)), "utf8");
const movementCss = await readFile(fileURLToPath(new URL("../ranking-movement.css", import.meta.url)), "utf8");
const indexHtml = await readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const appJs = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");

const standardColumns = "80px minmax(220px, 2.02fr) minmax(105px, 0.95fr) minmax(226px, 1.08fr) minmax(110px, 0.8fr) 82px";
const compactColumns = "80px minmax(190px, 2fr) minmax(90px, 0.82fr) minmax(226px, 1.08fr) minmax(100px, 0.76fr) 74px";
assert.equal(desktopCss.split(`grid-template-columns: ${standardColumns} !important;`).length - 1, 1,
  "standard desktop table header and rows share an 80px rank column with their existing remaining columns");
assert.equal(desktopCss.split(`grid-template-columns: ${compactColumns} !important;`).length - 1, 1,
  "compact desktop table header and rows share an 80px rank column with their existing remaining columns");
assert.doesNotMatch(desktopCss, /grid-template-columns:\s*94px minmax\(220px, 2\.02fr\)/,
  "the standard desktop ranking table no longer has the old 94px rank track");
assert.doesNotMatch(desktopCss, /grid-template-columns:\s*94px minmax\(190px, 2fr\)/,
  "the compact desktop ranking table no longer has the old 94px rank track");

const movementWrap = movementCss.match(/@media\s*\(min-width:\s*1101px\)\s*\{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(movementWrap, /\.desktop-ranking-row__rank:has\(\.ranking-movement\),\s*html body\.page-ranglister \.desktop-ranking-row__rank:not\(:has\(\.ranking-movement\)\)\s*\{/,
  "the desktop alignment applies at equal specificity to rows with and without a verified movement");
const allDesktopRanksRule = movementWrap.match(/\.desktop-ranking-row__rank:has\(\.ranking-movement\),\s*html body\.page-ranglister \.desktop-ranking-row__rank:not\(:has\(\.ranking-movement\)\)\s*\{([^}]*)\}/)?.[1] || "";
assert.match(allDesktopRanksRule, /flex-wrap:\s*wrap\s*!important;/,
  "desktop rank cells with and without movement can wrap within the first column");
assert.match(allDesktopRanksRule, /justify-content:\s*flex-end\s*!important;/,
  "all desktop rank cells align to the cover-side edge of the existing rank column");
assert.match(allDesktopRanksRule, /padding-right:\s*4px\s*!important;/,
  "all rank cells retain a 12px minimum cover gap at compact desktop widths");
assert.match(movementWrap, /\.desktop-ranking-row__rank \.ranking-movement\s*\{[^}]*flex:\s*0 0 2rem;/,
  "unchanged, rising, and falling movement markers share a fixed indicator slot");
assert.match(movementWrap, /\.desktop-ranking-row__rank:not\(:has\(\.ranking-movement\)\)::after\s*\{[^}]*content:\s*["']{2};[^}]*flex:\s*0 0 2rem;[^}]*visibility:\s*hidden;/,
  "rows without verified movement reserve an invisible slot without showing a false marker");
assert.match(movementCss, /\.ranking-movement\s*\{[^}]*color:\s*#187342;/,
  "rising movement keeps its existing green shared marker style");
assert.match(movementCss, /\.ranking-movement--steady\s*\{[^}]*color:\s*#74685e;/,
  "verified unchanged movement keeps its existing neutral marker style");
assert.match(movementCss, /\.ranking-movement--down\s*\{[^}]*color:\s*#b4232d;/,
  "falling movement keeps its existing red marker style");
assert.match(appJs, /if\s*\(delta\s*===\s*0\)[\s\S]*?ranking-movement--steady/,
  "only verified unchanged positions use the neutral marker");
assert.match(appJs, /gain\s*\?\s*"ranking-movement--up"\s*:\s*"ranking-movement--down"/,
  "verified ranking gains and losses keep their existing movement markers");
assert.match(appJs, /desktop-ranking-row__rank[\s\S]{0,160}getRankingMovementMarkup\(podcast\)/,
  "the desktop rank and its verified indicator remain adjacent for consistent #13/#14 alignment");
assert.doesNotMatch(movementCss, /@media\s*\(max-width:\s*700px\)[\s\S]*?desktop-ranking-row__rank/,
  "the desktop rank wrapping rule does not leak into mobile cards");

const tableRule = desktopCss.match(/\.desktop-ranking-row__podcast\s*\{([^}]*)\}/)?.[1] || "";
assert.match(tableRule, /grid-template-columns:\s*58px minmax\(0, 1fr\)/,
  "desktop cover size and podcast text column remain unchanged");
assert.match(indexHtml, /desktop-home-mockup\.css\?v=20261024-ranking-column-80-v1/,
  "desktop ranking CSS has a fresh cache key");
assert.match(indexHtml, /ranking-movement\.css\?v=20261024-ranking-rank-align-v3/,
  "desktop rank alignment CSS has a fresh cache key");

console.log("Desktop ranking rank-column and movement-wrap regression checks passed.");
