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
)(fakeWindow, fakeDocument, 48, 180, 1.35);

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
  surface.dispatchWheel(16, 2);
  surface.dispatchWheel(18, 1);
  assert.equal(surface.dispatchWheel(18, 2), true, "a clear left trackpad gesture is accepted");
  assert.deepEqual(transitions, ["next"], "a clear left gesture moves to the next recommendation");
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
  surface.dispatchWheel(-20, 1);
  surface.dispatchWheel(-30, 2);
  assert.deepEqual(transitions, ["previous"], "a clear right gesture moves to the previous recommendation");
}

{
  const { surface, transitions } = createHarness();
  [20, 20, 20, 20, 20].forEach((deltaX) => surface.dispatchWheel(deltaX, 1));
  assert.deepEqual(transitions, ["next"], "many events in one gesture cause one transition");
  finishGesture();
  [25, 25].forEach((deltaX) => surface.dispatchWheel(deltaX, 1));
  assert.deepEqual(transitions, ["next", "next"], "a distinct gesture after idle can transition again");
}

{
  const { surface, transitions } = createHarness();
  assert.equal(surface.dispatchWheel(8, 40), false, "vertical scrolling is not prevented");
  surface.dispatchWheel(10, 9);
  surface.dispatchWheel(12, 11);
  assert.deepEqual(transitions, [], "vertical, small, and ambiguous movement does not navigate");
  assert.equal(surface.listeners.get("wheel").options.passive, false, "wheel listener is non-passive only for accepted navigation");
}

assert.match(app, /data-home-featured-prev[\s\S]*setHomeFeaturedIndex\(container, previousIndex\)/u, "previous button navigation remains bound");
assert.match(app, /data-home-featured-next[\s\S]*setHomeFeaturedIndex\(container, nextIndex\)/u, "next button navigation remains bound");
assert.match(app, /\(max-width: 768px\).*event\.pointerType === "mouse"/u, "mobile pointer swipe remains unchanged");
assert.match(app, /\(min-width: 1101px\)/u, "wheel navigation uses the desktop homepage breakpoint");

console.log("Home featured desktop trackpad navigation regression checks passed.");
