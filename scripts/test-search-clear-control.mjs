import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, html, css] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../style.css", import.meta.url), "utf8")
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

console.log("Search clear control regression checks passed.");
