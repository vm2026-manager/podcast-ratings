import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const desktopCss = readFileSync(new URL("../desktop-home-mockup.css", import.meta.url), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is present`);
  const bodyStart = app.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}") depth -= 1;
    if (depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const setIndex = extractFunction("setHomeFeaturedIndex");
const autoplay = extractFunction("startHomeFeaturedAutoplay");
const render = extractFunction("renderHomeFeatured");

assert.match(setIndex, /state\.homeFeaturedTransitioning/u, "an active transition blocks duplicate state changes");
assert.match(setIndex, /is-home-featured-leaving--\$\{direction\}/u, "outgoing recommendation receives its known direction");
assert.match(setIndex, /is-home-featured-entering--\$\{direction\}/u, "incoming recommendation receives its known direction");
assert.match(setIndex, /stopHomeFeaturedAutoplay\(\)/u, "transition does not leave an old autoplay timer active");
assert.match(setIndex, /renderHomeFeatured\(container\)/u, "transition uses the existing authoritative render path");
assert.match(setIndex, /HOME_FEATURED_TRANSITION_DURATION/u, "transition completion clears its lock after the animation");
assert.match(extractFunction("shouldAnimateHomeFeatured"), /prefers-reduced-motion: reduce/u, "reduced motion bypasses animation");
assert.match(autoplay, /setHomeFeaturedIndex\(container, nextIndex, \{ direction: "next", animate: true \}\)/u, "autoplay retains a single forward transition");
assert.match(render, /setHomeFeaturedIndex\(container, previousIndex, \{ direction: "previous", animate: true \}\)/u, "previous controls request previous-direction transition");
assert.match(render, /setHomeFeaturedIndex\(container, nextIndex, \{ direction: "next", animate: true \}\)/u, "next controls request next-direction transition");
assert.match(render, /direction,\s*\n\s*animate: true/u, "trackpad navigation forwards its known direction into the shared state path");

assert.match(desktopCss, /@media \(min-width: 1101px\) and \(prefers-reduced-motion: no-preference\)/u, "motion CSS is desktop-only and excludes reduced-motion users");
assert.match(desktopCss, /home-featured-leave-next/u);
assert.match(desktopCss, /home-featured-enter-next/u);
assert.match(desktopCss, /home-featured-leave-previous/u);
assert.match(desktopCss, /home-featured-enter-previous/u);
assert.match(desktopCss, /overscroll-behavior-x: none/u, "horizontal overscroll protection is narrowly scoped");

console.log("Home featured desktop transition regression checks passed.");
