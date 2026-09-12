import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../style.css", import.meta.url), "utf8");

test("saved profile modal reuses the saved card renderer", () => {
  assert.match(
    appSource,
    /createCard: \(podcast\) => createSavedPodcastCardElement\(podcast, \{ compactLibrary: true \}\)/
  );
});

test("saved card bookmarks use the active filled icon treatment", () => {
  assert.match(
    appSource,
    /removeButton\.className = "saved-button saved-button--remove is-saved"/
  );
  assert.match(
    appSource,
    /class="saved-button__heart favorite-button__icon"/
  );
  assert.match(
    styles,
    /\.saved-button--remove\.is-saved \.favorite-button__icon path \{\s*fill: #ff5c16;\s*stroke: #ff5c16;/
  );
});
