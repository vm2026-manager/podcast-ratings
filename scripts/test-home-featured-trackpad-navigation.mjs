import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

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

class FakeSurface {
  listeners = new Map();

  addEventListener(type, listener, options) {
    this.listeners.set(type, { listener, options });
  }

  dispatchWheel(deltaX, deltaY) {
    let prevented = false;
    this.listeners.get("wheel").listener({
      deltaX,
      deltaY,
      preventDefault: () => {
        prevented = true;
      }
    });
    return prevented;
  }
}

let timers = [];
let desktopMatch = true;
let homepageMatch = true;
const fakeWindow = {
  matchMedia: () => ({ matches: desktopMatch }),
  setTimeout: (callback) => {
    const timer = { callback, cleared: false };
    timers.push(timer);
    return timer;
  },
  clearTimeout: (timer) => {
    timer.cleared = true;
  }
};
const fakeDocument = {
  body: {
    classList: {
      contains: () => homepageMatch
    }
  }
};
const initTrackpadNavigation = new Function(
  "window",
  "document",
  "HOME_FEATURED_TRACKPAD_THRESHOLD",
  "HOME_FEATURED_TRACKPAD_IDLE_DELAY",
  "HOME_FEATURED_TRACKPAD_DOMINANCE",
  `${extractFunction("initHomeFeaturedDesktopTrackpadNavigation")}\nreturn initHomeFeaturedDesktopTrackpadNavigation;`
)(fakeWindow, fakeDocument, 300, 500, 2.2);

function createHarness({ desktop = true, homepage = true } = {}) {
  timers = [];
  desktopMatch = desktop;
  homepageMatch = homepage;
  const surface = new FakeSurface();
  const transitions = [];
  initTrackpadNavigation(surface, (direction) => transitions.push(direction));
  return { surface, transitions };
}

function finishGesture() {
  for (const timer of timers) {
    if (!timer.cleared) timer.callback();
  }
}

{
  const { surface, transitions } = createHarness();
  surface.dispatchWheel(90, 2);
  surface.dispatchWheel(90, 2);
  assert.deepEqual(transitions, [], "180px of clear horizontal input does not navigate");
}

{
  const { surface, transitions } = createHarness({ desktop: false });
  assert.equal(surface.dispatchWheel(60, 1), false, "wheel input below the desktop breakpoint is not prevented");
  assert.deepEqual(transitions, [], "wheel input below 1101px does not navigate");
}

{
  const { surface, transitions } = createHarness({ homepage: false });
  surface.dispatchWheel(60, 1);
  assert.deepEqual(transitions, [], "wheel navigation is limited to body.page-forside");
}

{
  const { surface, transitions } = createHarness();
  surface.dispatchWheel(110, 2);
  surface.dispatchWheel(110, 2);
  assert.deepEqual(transitions, [], "220px of clear horizontal input does not navigate");
}

{
  const { surface, transitions } = createHarness();
  surface.dispatchWheel(130, 2);
  surface.dispatchWheel(130, 2);
  assert.deepEqual(transitions, [], "260px of clear horizontal input does not navigate");
}

{
  const { surface, transitions } = createHarness();
  surface.dispatchWheel(145, 2);
  surface.dispatchWheel(145, 2);
  assert.deepEqual(transitions, [], "290px of clear horizontal input does not navigate");
}

{
  const { surface, transitions } = createHarness();
  [40, 40, 40, 40, 40].forEach((deltaX) => surface.dispatchWheel(deltaX, 20));
  assert.deepEqual(transitions, [], "movement between 1.6 and 2.2 dominance does not navigate");
  [150, 150].forEach((deltaX) => surface.dispatchWheel(deltaX, 20));
  assert.deepEqual(transitions, ["next"], "clearly horizontal input over 2.2 dominance navigates at 300px");
}

{
  const { surface, transitions } = createHarness();
  [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30].forEach((deltaX) => surface.dispatchWheel(deltaX, 2));
  assert.deepEqual(transitions, ["next"], "trackpad inertia events within the 500ms gesture window cause one transition");
  finishGesture();
  [150, 150].forEach((deltaX) => surface.dispatchWheel(deltaX, 2));
  assert.deepEqual(transitions, ["next", "next"], "a distinct gesture after idle can transition again");
}

{
  const { surface, transitions } = createHarness();
  assert.equal(surface.dispatchWheel(20, 50), false, "vertical scrolling is not prevented");
  assert.deepEqual(transitions, [], "vertical scrolling does not navigate");
  assert.equal(surface.listeners.get("wheel").options.passive, false, "wheel listener is non-passive only for accepted navigation");
}

assert.match(app, /data-home-featured-prev[\s\S]*setHomeFeaturedIndex\(container, previousIndex\)/u, "previous button navigation remains bound");
assert.match(app, /data-home-featured-next[\s\S]*setHomeFeaturedIndex\(container, nextIndex\)/u, "next button navigation remains bound");
assert.match(app, /\(max-width: 768px\).*event\.pointerType === "mouse"/u, "mobile pointer swipe remains unchanged");
assert.match(app, /\(min-width: 1101px\)/u, "wheel navigation uses the desktop homepage breakpoint");
assert.match(app, /const HOME_FEATURED_TRACKPAD_THRESHOLD = 300;/u, "trackpad threshold is tuned to 300px");
assert.match(app, /const HOME_FEATURED_TRACKPAD_IDLE_DELAY = 500;/u, "trackpad idle reset is tuned to 500ms");
assert.match(app, /const HOME_FEATURED_TRACKPAD_DOMINANCE = 2\.2;/u, "trackpad dominance is tuned to 2.2");

console.log("Home featured desktop trackpad navigation regression checks passed.");
