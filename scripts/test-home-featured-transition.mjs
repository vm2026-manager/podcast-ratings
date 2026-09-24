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
assert.match(setIndex, /stopHomeFeaturedAutoplay\(\)/u, "transition does not leave an old autoplay timer active");
assert.match(setIndex, /\.home-featured__track/u, "desktop navigation moves the retained horizontal track");
assert.match(setIndex, /translate3d\(-\$\{targetPosition \* 100\}%/u, "next and previous movement uses full-slide horizontal distance");
assert.match(setIndex, /HOME_FEATURED_TRACK_TRANSITION_DURATION/u, "transition completion clears its lock after the track movement");
assert.match(setIndex, /startHomeFeaturedAutoplay\(container\)/u, "autoplay resumes only after the track settles");
assert.match(extractFunction("shouldAnimateHomeFeatured"), /prefers-reduced-motion: reduce/u, "reduced motion bypasses animation");
assert.match(autoplay, /setHomeFeaturedIndex\(container, nextIndex, \{ direction: "next", animate: true \}\)/u, "autoplay retains a single forward transition");
assert.match(render, /home-featured__viewport/u, "desktop render provides a clipped viewport");
assert.match(render, /home-featured__track/u, "desktop render provides a real horizontal track");
assert.match(render, /home-featured__slide/u, "desktop render pre-renders slide elements");
assert.match(render, /\[maxIndex, \.\.\.reviews\.map\(\(_, reviewIndex\) => reviewIndex\), 0\]/u, "desktop render includes real neighbours plus edge clones before movement");
assert.match(render, /renderHomeFeatured\(slide, \{ forceSingle: true/u, "incoming content is rendered before it can enter the viewport");
assert.match(render, /setHomeFeaturedIndex\(navigationContainer, previousIndex, \{ direction: "previous", animate: true \}\)/u, "previous controls request the shared track transition");
assert.match(render, /setHomeFeaturedIndex\(navigationContainer, nextIndex, \{ direction: "next", animate: true \}\)/u, "next controls request the shared track transition");
assert.match(render, /direction,\s*\n\s*animate: true/u, "trackpad navigation forwards its known direction into the shared state path");

assert.match(desktopCss, /@media \(min-width: 1101px\)[\s\S]*home-featured__viewport/u, "track CSS is desktop-only");
assert.match(desktopCss, /home-featured__track[\s\S]*display: flex/u, "track lays slides out horizontally");
assert.match(desktopCss, /home-featured__slide[\s\S]*flex: 0 0 100%/u, "each slide fills exactly one viewport");
assert.doesNotMatch(desktopCss, /home-featured-leave-next|home-featured-enter-next|opacity: 0; transform: translateX\(-18px\)/u, "obsolete opacity-to-zero transition model is removed");
assert.match(desktopCss, /overscroll-behavior-x: none/u, "horizontal overscroll protection is narrowly scoped");

console.log("Home featured desktop transition regression checks passed.");
