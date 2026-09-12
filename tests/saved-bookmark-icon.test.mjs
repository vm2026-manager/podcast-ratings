import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../style.css", import.meta.url), "utf8");
const desktopStyles = await readFile(new URL("../desktop-home-mockup.css", import.meta.url), "utf8");

test("saved profile modal reuses the saved card renderer", () => {
  assert.match(
    appSource,
    /createCard: \(podcast\) => createSavedPodcastCardElement\(podcast, \{ compactLibrary: true \}\)/
  );
});

test("saved-modal bookmarks use the active filled icon treatment without changing large saved-card controls", () => {
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
    /\.profile-list-dialog--saved \.saved-card--library \.saved-button--remove\.is-saved \.favorite-button__icon path \{\s*fill: #ff5c16;\s*stroke: #ff5c16;/
  );
  assert.doesNotMatch(styles, /(^|\n)\.saved-button--remove\.is-saved \.favorite-button__icon path/);
  assert.match(
    desktopStyles,
    /html body\.page-profil \.profile-saved-grid \.saved-button--remove \.saved-button__heart \{\s*display: block !important;\s*color: #fff !important;/
  );
});
