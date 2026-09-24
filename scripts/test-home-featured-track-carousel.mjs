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

const source = extractFunction("setHomeFeaturedIndex");
const makeSetHomeFeaturedIndex = new Function(
  "state",
  "getHomeFeaturedReviewQueue",
  "shouldAnimateHomeFeatured",
  "renderHomeFeatured",
  "stopHomeFeaturedAutoplay",
  "startHomeFeaturedAutoplay",
  "HOME_FEATURED_TRACK_TRANSITION_DURATION",
  "window",
  `${source}; return setHomeFeaturedIndex;`
);

function createHarness(initialIndex = 0) {
  const timers = [];
  const track = { style: { transform: "translate3d(-100%, 0, 0)", transition: "" } };
  const classes = new Set();
  const indicators = [0, 1, 2].map((index) => ({
    dataset: { homeFeaturedIndex: String(index) },
    classList: { toggle(name, active) { if (active) this.active = name; else if (this.active === name) this.active = ""; } },
    setAttribute(name, value) { this[name] = value; }
  }));
  const container = {
    querySelector(selector) { return selector === ".home-featured__track" ? track : null; },
    querySelectorAll(selector) { return selector === "[data-home-featured-index]" ? indicators : []; },
    classList: { add(...names) { names.forEach((name) => classes.add(name)); }, remove(...names) { names.forEach((name) => classes.delete(name)); } }
  };
  const state = { homeFeaturedIndex: initialIndex, homeFeaturedTransitioning: false, homeFeaturedTransitionTimer: null };
  let autoplayStarts = 0;
  const fakeWindow = {
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { timers.push(callback); return timers.length; }
  };
  const setIndex = makeSetHomeFeaturedIndex(
    state,
    () => [{}, {}, {}],
    () => true,
    () => { throw new Error("desktop track navigation must not rerender the visible carousel"); },
    () => {},
    () => { autoplayStarts += 1; },
    320,
    fakeWindow
  );
  return { container, setIndex, state, track, indicators, timers, classes, get autoplayStarts() { return autoplayStarts; } };
}

{
  const harness = createHarness(0);
  harness.setIndex(harness.container, 1, { direction: "next", animate: true });
  assert.equal(harness.state.homeFeaturedIndex, 0, "logical index waits for the retained slide movement to settle");
  assert.equal(harness.track.style.transform, "translate3d(-200%, 0, 0)", "next moves the existing next slide into the viewport");
  assert.equal(harness.timers.length, 1, "one transition timer is active");
  harness.setIndex(harness.container, 2, { direction: "next", animate: true });
  assert.equal(harness.timers.length, 1, "a repeated input cannot stack another movement");
  harness.timers.shift()();
  assert.equal(harness.state.homeFeaturedIndex, 1, "next changes the logical index exactly once after movement");
  assert.equal(harness.indicators[1].classList.active, "is-active", "active indicator synchronizes with the settled slide");
  assert.equal(harness.autoplayStarts, 1, "autoplay resumes once after the settled transition");
}

{
  const harness = createHarness(0);
  harness.setIndex(harness.container, 2, { direction: "previous", animate: true });
  assert.equal(harness.track.style.transform, "translate3d(-0%, 0, 0)", "previous uses the pre-rendered leading clone instead of a blank rerender");
  harness.timers.shift()();
  assert.equal(harness.track.style.transform, "translate3d(-300%, 0, 0)", "wraparound snaps to the matching real slide after it has stayed visible");
  assert.equal(harness.state.homeFeaturedIndex, 2, "previous changes the logical index exactly once");
}

assert.match(app, /home-featured__viewport[\s\S]*home-featured__track[\s\S]*home-featured__slide/u, "desktop DOM creates a viewport, track, and real slides before any movement");
assert.doesNotMatch(app, /is-home-featured-leaving|is-home-featured-entering/u, "the obsolete fade/rerender transition classes are not used");

console.log("Home featured desktop track carousel regression checks passed.");
