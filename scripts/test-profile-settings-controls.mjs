import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const desktopSettingsStyles = await readFile(new URL("../profile-settings-desktop.css", import.meta.url), "utf8");
const desktopProfileStyles = await readFile(new URL("../desktop-home-mockup.css", import.meta.url), "utf8");
const rendererStart = appSource.indexOf("function renderProfileSettingsPage(container)");
const rendererEnd = appSource.indexOf("function renderProfileFaqPage(container)", rendererStart);
const settingsRenderer = appSource.slice(rendererStart, rendererEnd);

assert.notEqual(rendererStart, -1, "Expected the Profile Settings renderer.");
assert.notEqual(rendererEnd, -1, "Expected the Profile FAQ renderer after Settings.");
assert.doesNotMatch(settingsRenderer, /Eksportér mine data|data-profile-export|Dine data/);
assert.doesNotMatch(settingsRenderer, /Start anbefalingerne forfra|Nulstil anbefalinger|data-profile-reset-recommendations/);
assert.match(settingsRenderer, /<h3>Slet konto<\/h3>/);
assert.match(settingsRenderer, /data-profile-delete-account/);
assert.doesNotMatch(appSource, /function exportProfileData\(|function resetProfileRecommendationCaches\(/);
assert.match(appSource, /function invalidateRankingListCache\(/);
assert.doesNotMatch(desktopSettingsStyles, /profile-settings-card--(?:privacy|recommendations)|data-settings-card="(?:privacy|recommendations)"/);
assert.doesNotMatch(desktopProfileStyles, /profile-settings-card--(?:privacy|recommendations)|data-settings-card="(?:privacy|recommendations)"/);

console.log("Profile Settings controls regression test passed.");
