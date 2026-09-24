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

  dispatch(type, event = {}) {
    this.listeners.get(type)?.listener(event);
  }
}

let timers = [];
let desktopMatch = true;
let homepageMatch = true;
let overscrollGuardActive = false;
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
      contains: (className) =>
        className === "page-forside"
          ? homepageMatch
          : className === "home-featured-trackpad-guard" && overscrollGuardActive,
      toggle: (className, active) => {
        if (className === "home-featured-trackpad-guard") overscrollGuardActive = Boolean(active);
      }
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
)(fakeWindow, fakeDocument, 450, 500, 2.2);

function createHarness({ desktop = true, homepage = true } = {}) {
  timers = [];
  desktopMatch = desktop;
  homepageMatch = homepage;
  overscrollGuardActive = false;
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
  surface.dispatch("pointerenter");
  assert.equal(overscrollGuardActive, true, "overscroll protection is active only while the weekly surface is hovered");
  assert.equal(surface.dispatchWheel(150, 2), true, "the first clear horizontal event is prevented");
  assert.equal(surface.dispatchWheel(0, 2), true, "a noisy inertia tail remains prevented after horizontal ownership");
  assert.equal(surface.dispatchWheel(150, 2), true, "300px of clear horizontal input remains prevented");
  assert.deepEqual(transitions, [], "300px of clear horizontal input does not navigate");
  surface.dispatch("mouseleave");
  assert.equal(overscrollGuardActive, false, "overscroll protection is removed when the pointer leaves the weekly surface");
}

{
  const { surface, transitions } = createHarness({ desktop: false });
  assert.equal(surface.dispatchWheel(60, 1), false, "wheel input below the desktop breakpoint is not prevented");
  assert.deepEqual(transitions, [], "wheel input below 1101px does not navigate");
}

{
  const { surface, transitions } = createHarness({ homepage: false });
  assert.equal(surface.dispatchWheel(60, 1), false, "non-homepage wheel input is not prevented");
  assert.deepEqual(transitions, [], "wheel navigation is limited to body.page-forside");
}

{
  const { surface, transitions } = createHarness();
  assert.equal(surface.dispatchWheel(200, 2), true, "400px clear horizontal input is prevented");
  assert.equal(surface.dispatchWheel(200, 2), true, "each accepted horizontal event is prevented");
  assert.deepEqual(transitions, [], "400px of clear horizontal input does not navigate");
}

{
  const { surface, transitions } = createHarness();
  [149, 150, 150].forEach((deltaX) => assert.equal(surface.dispatchWheel(deltaX, 2), true));
  assert.deepEqual(transitions, [], "449px of clear horizontal input does not navigate");
}

{
  const { surface, transitions } = createHarness();
  [150, 150, 150].forEach((deltaX) => assert.equal(surface.dispatchWheel(deltaX, 2), true));
  assert.deepEqual(transitions, ["next"], "450px clear horizontal input navigates next exactly once");
}

{
  const { surface, transitions } = createHarness();
  [40, 40, 40, 40, 40].forEach((deltaX) => surface.dispatchWheel(deltaX, 20));
  assert.deepEqual(transitions, [], "movement between 1.6 and 2.2 dominance does not navigate");
  assert.equal(surface.dispatchWheel(40, 20), false, "diagonal input below 2.2 dominance is not prevented");
}

{
  const { surface, transitions } = createHarness();
  [-150, -150, -150].forEach((deltaX) => assert.equal(surface.dispatchWheel(deltaX, 2), true));
  assert.deepEqual(transitions, ["previous"], "450px clear horizontal input navigates previous in the opposite direction");
}

{
  const { surface, transitions } = createHarness();
  [150, 150, 150, 30, 30, 30].forEach((deltaX) => assert.equal(surface.dispatchWheel(deltaX, 2), true));
  assert.deepEqual(transitions, ["next"], "trackpad inertia events within the 500ms gesture window cause one transition");
  finishGesture();
  [150, 150, 150].forEach((deltaX) => assert.equal(surface.dispatchWheel(deltaX, 2), true));
  assert.deepEqual(transitions, ["next", "next"], "a distinct gesture after idle can transition again");
}

{
  const { surface, transitions } = createHarness();
  assert.equal(surface.dispatchWheel(20, 50), false, "vertical scrolling is not prevented");
  assert.deepEqual(transitions, [], "vertical scrolling does not navigate");
  assert.equal(surface.listeners.get("wheel").options.passive, false, "wheel listener is non-passive only for accepted navigation");
}

assert.match(app, /data-home-featured-prev[\s\S]*setHomeFeaturedIndex\(container, previousIndex, \{ direction: "previous"/u, "previous button navigation remains bound");
assert.match(app, /data-home-featured-next[\s\S]*setHomeFeaturedIndex\(container, nextIndex, \{ direction: "next"/u, "next button navigation remains bound");
assert.match(app, /\(max-width: 768px\).*event\.pointerType === "mouse"/u, "mobile pointer swipe remains unchanged");
assert.match(app, /\(min-width: 1101px\)/u, "wheel navigation uses the desktop homepage breakpoint");
assert.match(app, /const HOME_FEATURED_TRACKPAD_THRESHOLD = 450;/u, "trackpad threshold is tuned to 450px");
assert.match(app, /const HOME_FEATURED_TRACKPAD_IDLE_DELAY = 500;/u, "trackpad idle reset is tuned to 500ms");
assert.match(app, /const HOME_FEATURED_TRACKPAD_DOMINANCE = 2\.2;/u, "trackpad dominance is tuned to 2.2");
assert.match(app, /let gestureAxis = "undecided"/u, "trackpad navigation tracks gesture ownership");
assert.match(app, /gestureAxis = "horizontal"/u, "horizontal ownership persists across later wheel events");
assert.match(app, /home-featured-trackpad-guard/u, "overscroll guard is scoped to the weekly surface interaction");

console.log("Home featured desktop trackpad navigation regression checks passed.");
