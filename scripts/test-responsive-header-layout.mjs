import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const headerCss = readFileSync(new URL("../header-navigation-fix.css", import.meta.url), "utf8");
const robustnessCss = readFileSync(new URL("../responsive-robustness.css", import.meta.url), "utf8");
const desktopHomeCss = readFileSync(new URL("../desktop-home-mockup.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /<header class="topbar">/u);
assert.match(html, /class="site-nav"/u);
assert.match(html, /id="desktopHeaderSearch"/u);
assert.match(html, /id="desktopUserButton"/u);

assert.match(headerCss, /@media \(min-width: 1299\.6px\)/u);
assert.match(headerCss, /grid-template-areas: "brand nav search account"/u);

const laterCompactHeader = robustnessCss.slice(robustnessCss.lastIndexOf("/* The only intermediate header layout"));
assert.match(laterCompactHeader, /@media \(min-width: 901px\) and \(max-width: 1299\.59px\)/u);
assert.match(laterCompactHeader, /grid-template-areas: "brand nav search account"/u);
assert.match(laterCompactHeader, /grid-template-rows: 76px/u);
assert.doesNotMatch(laterCompactHeader, /"search search search"|grid-column: 1 \/ -1/u);
assert.match(laterCompactHeader, /\.site-nav \{[\s\S]*?grid-area: nav/u);
assert.match(laterCompactHeader, /#mobileHeaderSearchButton \{[\s\S]*?grid-area: search/u);
assert.match(laterCompactHeader, /#mobileHeaderSearchButton svg \{[\s\S]*?fill: none[\s\S]*?stroke: currentColor/u);
assert.match(laterCompactHeader, /#desktopUserButton \{[\s\S]*?grid-area: account/u);
assert.match(laterCompactHeader, /flex-wrap: nowrap/u);
assert.match(laterCompactHeader, /\.site-nav__link \{[\s\S]*?min-height: 76px/u);
assert.match(laterCompactHeader, /border-bottom: 0/u);
assert.match(laterCompactHeader, /text-decoration: none/u);
assert.match(laterCompactHeader, /\.site-nav__link::after \{[\s\S]*?bottom: 11px[\s\S]*?height: 2px/u);
assert.match(laterCompactHeader, /#desktopHeaderSearch\.is-mobile-open \{[\s\S]*?display: grid/u);
assert.doesNotMatch(laterCompactHeader, /devicePixelRatio|zoom|110%|125%|150%/u);

assert.doesNotMatch(headerCss, /@media \(min-width: 901px\) and \(max-width: 1299\.59px\)/u);
assert.equal((robustnessCss.match(/grid-template-areas:/gu) || []).length, 1);
assert.equal((desktopHomeCss.match(/@media \(max-width: 1299\.59px\) \{\s*html body \.mobile-header-search-button/gu) || []).length, 2);

console.log("Responsive header layout regressions passed.");
