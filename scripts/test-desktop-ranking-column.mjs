import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const desktopCss = await readFile(fileURLToPath(new URL("../desktop-home-mockup.css", import.meta.url)), "utf8");
const movementCss = await readFile(fileURLToPath(new URL("../ranking-movement.css", import.meta.url)), "utf8");
const indexHtml = await readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

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
assert.match(movementWrap, /\.desktop-ranking-row__rank:has\(\.ranking-movement\)\s*\{[\s\S]*?flex-wrap:\s*wrap\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/,
  "desktop table rank and movement can wrap within the first column");
assert.doesNotMatch(movementCss, /@media\s*\(max-width:\s*700px\)[\s\S]*?desktop-ranking-row__rank/,
  "the desktop rank wrapping rule does not leak into mobile cards");

const tableRule = desktopCss.match(/\.desktop-ranking-row__podcast\s*\{([^}]*)\}/)?.[1] || "";
assert.match(tableRule, /grid-template-columns:\s*58px minmax\(0, 1fr\)/,
  "desktop cover size and podcast text column remain unchanged");
assert.match(indexHtml, /desktop-home-mockup\.css\?v=20261024-ranking-column-80-v1/,
  "desktop ranking CSS has a fresh cache key");
assert.match(indexHtml, /ranking-movement\.css\?v=20261024-ranking-rank-wrap-v1/,
  "movement wrapping CSS has a fresh cache key");

console.log("Desktop ranking rank-column and movement-wrap regression checks passed.");
