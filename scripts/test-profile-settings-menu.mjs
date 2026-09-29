import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const sidebarStart = appSource.indexOf('<aside class="profile-sidebar" aria-label="Profilmenu">');
const helpMenuStart = appSource.indexOf('<section class="profile-menu profile-menu--help">', sidebarStart);

assert.notEqual(sidebarStart, -1, "Expected the logged-in profile sidebar renderer.");
assert.notEqual(helpMenuStart, -1, "Expected the profile help menu after the settings menu.");

const settingsMenu = appSource.slice(sidebarStart, helpMenuStart);
const settingsLinks = settingsMenu.match(/href="#profil-indstillinger"/g) || [];

assert.equal(settingsLinks.length, 1, "Profile settings menu must expose one settings route link.");
assert.match(settingsMenu, /<strong>Konto &amp; indstillinger<\/strong><small>Profil, præferencer og privatliv<\/small>/);
assert.doesNotMatch(settingsMenu, /<strong>(Rediger profil|Præferencer|Privatliv\/data)<\/strong>/);
assert.match(settingsMenu, /<strong>Log ud<\/strong><small>Afslut din session<\/small>/);

console.log("Profile settings menu regression test passed.");
