import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const mobileStyles = await readFile(new URL("../mobile-home-profile.css", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("mobile average rating label and value are centered in the text column", () => {
  assert.match(
    mobileStyles,
    /@media \(max-width: 768px\)[\s\S]*?html body\.page-profil \.profile-stat-card--average \.profile-stat-card__label,\s*html body\.page-profil \.profile-stat-card--average strong\s*\{\s*justify-self: stretch !important;\s*text-align: center !important;\s*\}/
  );
  assert.match(
    mobileStyles,
    /html body\.page-profil \.profile-stat-card--average \{\s*grid-template-columns: 32px minmax\(0, 1fr\) !important;\s*column-gap: 8px !important;/
  );
  assert.match(
    mobileStyles,
    /html body\.page-profil \.profile-stat-card--genre \.profile-stat-card__icon,\s*html body\.page-profil \.profile-stat-card--average \.profile-stat-card__icon\s*\{\s*grid-column: 1 !important;\s*grid-row: 1 \/ -1 !important;/
  );
});

test("mobile genre stat card keeps its existing geometry and left aligned content", () => {
  assert.match(
    mobileStyles,
    /html body\.page-profil \.profile-stat-card--genre,\s*html body\.page-profil \.profile-stat-card--average\s*\{\s*grid-column: span 3 !important;\s*min-width: 0 !important;\s*min-height: 78px !important;\s*height: 78px !important;\s*padding: 8px !important;\s*display: grid !important;\s*grid-template-columns: 26px minmax\(0, 1fr\) !important;\s*grid-template-rows: auto auto !important;\s*column-gap: 7px !important;\s*row-gap: 3px !important;\s*align-content: center !important;\s*align-items: center !important;\s*justify-items: start !important;/
  );
  assert.match(
    mobileStyles,
    /html body\.page-profil \.profile-stat-card--genre strong,\s*html body\.page-profil \.profile-stat-card--average strong\s*\{\s*grid-column: 2 !important;\s*grid-row: 2 !important;[\s\S]*?text-align: left !important;\s*white-space: nowrap !important;/
  );
  assert.match(
    index,
    /href="mobile-home-profile\.css\?v=20261030-average-card-centered-v1"/
  );
});
