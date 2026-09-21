import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const headerCss = readFileSync(new URL("../header-navigation-fix.css", import.meta.url), "utf8");
const robustnessCss = readFileSync(new URL("../responsive-robustness.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /<header class="topbar">/u);
assert.match(html, /class="site-nav"/u);
assert.match(html, /id="desktopHeaderSearch"/u);
assert.match(html, /id="desktopUserButton"/u);

assert.match(headerCss, /@media \(min-width: 1299\.6px\)/u);
assert.match(headerCss, /grid-template-areas: "brand nav search account"/u);

const laterCompactHeader = robustnessCss.slice(robustnessCss.lastIndexOf("/* This file loads after the page-specific header rules"));
assert.match(laterCompactHeader, /@media \(min-width: 901px\) and \(max-width: 1299\.59px\)/u);
assert.match(laterCompactHeader, /"brand nav account"\s*\n\s*"search search search"/u);
assert.match(laterCompactHeader, /grid-column: 1 \/ -1/u);
assert.match(laterCompactHeader, /\.site-nav \{[\s\S]*?grid-area: nav/u);
assert.match(laterCompactHeader, /#desktopHeaderSearch \{[\s\S]*?grid-area: search/u);
assert.match(laterCompactHeader, /#desktopUserButton \{[\s\S]*?grid-area: account/u);
assert.match(laterCompactHeader, /flex-wrap: nowrap/u);
assert.doesNotMatch(laterCompactHeader, /devicePixelRatio|zoom|110%|125%|150%/u);
assert.match(robustnessCss, /@media \(min-width: 901px\) and \(max-width: 1100px\)/u);
assert.match(robustnessCss, /grid-template-areas: "brand nav account"/u);

console.log("Responsive header layout regressions passed.");
