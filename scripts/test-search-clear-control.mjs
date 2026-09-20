import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, html, css, mobileLayoutCss] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../style.css", import.meta.url), "utf8"),
  readFile(new URL("../mobile-layout-regressions.css", import.meta.url), "utf8")
]);

assert.match(
  html,
  /<button\s+id="searchClearButton"[\s\S]*?aria-label="Ryd s&#248;gning"[\s\S]*?hidden/u,
  "the ranking search has an explicit, initially hidden clear button"
);
assert.match(app, /elements\.searchClearButton\.hidden = !elements\.searchInput\.value;/u);

const inputHandlerStart = app.indexOf('elements.searchInput.addEventListener("input"');
const clearHandlerStart = app.indexOf('elements.searchClearButton?.addEventListener("click"');
const clearHandlerEnd = app.indexOf("\n    });", clearHandlerStart) + "\n    });".length;
assert.ok(inputHandlerStart >= 0 && clearHandlerStart >= 0, "search handlers exist");
assert.match(
  app.slice(clearHandlerStart, clearHandlerEnd),
  /elements\.searchInput\.focus\(\{ preventScroll: true \}\);[\s\S]*?dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/u,
  "clearing preserves focus and uses the normal input event path"
);

assert.match(css, /#searchInput\s*\{\s*padding-right:\s*56px\s*!important;/u);
assert.match(
  css,
  /\.search-field__clear\s*\{[\s\S]*?width:\s*44px\s*!important;[\s\S]*?height:\s*44px\s*!important;/u,
  "the clear control provides a 44px touch target"
);
assert.match(css, /#searchInput::-webkit-search-cancel-button/u);

assert.match(
  html,
  /<button\s+id="mobileHomeSearchOverlayClear"[\s\S]*?aria-label="Ryd søgning"[\s\S]*?hidden/u,
  "the mobile home overlay has an explicit, initially hidden clear button"
);
assert.match(app, /mobileHomeSearchOverlayClear:\s*document\.getElementById\("mobileHomeSearchOverlayClear"\)/u);
assert.match(app, /function updateMobileHomeSearchOverlayClearButton\(\)[\s\S]*?hidden\s*=\s*!elements\.mobileHomeSearchOverlayInput\?\.value/u);
const mobileClearHandlerStart = app.indexOf('clearButton.addEventListener("click"');
const mobileClearHandlerEnd = app.indexOf("\n  });", mobileClearHandlerStart) + "\n  });".length;
assert.ok(mobileClearHandlerStart >= 0, "mobile home clear handler exists");
assert.match(
  app.slice(mobileClearHandlerStart, mobileClearHandlerEnd),
  /input\.value\s*=\s*"";[\s\S]*?input\.focus\(\{ preventScroll: true \}\);[\s\S]*?dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/u,
  "mobile home clearing retains focus and reuses the normal input event path"
);
assert.match(mobileLayoutCss, /mobile-home-search-overlay__form\s*\{[^}]*grid-template-columns:\s*20px\s+minmax\(0,\s*1fr\)\s+44px/u);
assert.match(mobileLayoutCss, /mobile-home-search-overlay__clear\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/u);
assert.match(mobileLayoutCss, /mobile-home-search-overlay__input::-webkit-search-cancel-button\s*\{[^}]*-webkit-appearance:\s*none/u);

console.log("Search clear control regression checks passed.");
