import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

const opening = app.slice(
  app.indexOf("function openMobileHomeSearchOverlay()"),
  app.indexOf("\nfunction renderMobileHomeSearchOverlayResults()", app.indexOf("function openMobileHomeSearchOverlay()"))
);
const closing = app.slice(
  app.indexOf("function closeMobileHomeSearchOverlay("),
  app.indexOf("\nfunction openMobileHomeSearchOverlay()", app.indexOf("function closeMobileHomeSearchOverlay("))
);
assert.match(opening, /openedRoute\s*=\s*getRouteInfoFromHash\(\)\.rawRoute\s*\|\|\s*"forside"/u);
assert.match(closing, /openedRoute\s*=\s*null/u);

const start = app.indexOf("function renderRoute() {");
const end = app.indexOf('  if (rawRoute === "gemte")', start);
assert.ok(start >= 0 && end > start, "route renderer prelude exists");
const prelude = app.slice(start, end);
const createRenderer = new Function(
  "mobileHomeSearchOverlayState",
  "getRouteInfoFromHash",
  "closeMobileHomeSearchOverlay",
  "deactivateHomePodcastSearchFocus",
  prelude + "\n}\nreturn renderRoute;"
);

function assertCloseCount(openedRoute, destinationRoute, expected, message) {
  let closed = 0;
  const overlayState = { openedRoute };
  const renderRoute = createRenderer(
    overlayState,
    () => ({ rawRoute: destinationRoute, route: destinationRoute || "forside" }),
    () => { closed += 1; overlayState.openedRoute = null; },
    () => {}
  );
  renderRoute();
  assert.equal(closed, expected, message);
}

assertCloseCount(null, "forside", 0, "initial render must not close a closed search");
assertCloseCount("forside", "forside", 0, "same-page data rerender must preserve mobile search");
assertCloseCount("forside", "", 0, "default route normalization must preserve mobile search");
assertCloseCount("forside", "udforsk", 1, "real navigation must close mobile search");
assertCloseCount("profil", "profil-gemte", 1, "profile subroute navigation must close mobile search");

console.log("Mobile home search overlay route lifecycle regression checks passed.");
