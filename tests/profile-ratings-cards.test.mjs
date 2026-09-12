import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../desktop-home-mockup.css", import.meta.url), "utf8");

test("profile episode preview keeps four rows visible", () => {
  assert.match(
    styles,
    /\.profile-episode-list > :nth-child\(n \+ 5\) \{\s*display: none !important;/
  );
});

test("profile ratings and episode headers use outlined orange icon styling", () => {
  assert.match(appSource, /ratings:\s*'[^']*m12 3\.5 2\.7 5\.5/);
  assert.match(appSource, /episodes:\s*'[^']*<circle cx="12" cy="12" r="8\.5"><\/circle>/);
  assert.ok(styles.includes(".profile-ratings-panel .profile-panel__icon svg"));
  assert.ok(styles.includes(".profile-episode-ratings-panel .profile-panel__icon svg"));
  assert.ok(styles.includes("fill: none !important;"));
  assert.ok(styles.includes("stroke: currentColor !important;"));
});

test("paired profile cards retain lower breathing room", () => {
  assert.match(
    styles,
    /\.profile-episode-ratings-panel,[\s\S]*?\.profile-ratings-panel \{\s*padding-bottom: 16px !important;/
  );
});
