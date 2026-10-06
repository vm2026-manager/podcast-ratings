import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MINIMUM_SAFE_PODCAST_CATALOGUE_ROWS,
  validateProductionCataloguePayload,
  validateProductionDisplayGroups
} from "./production-catalogue-health.mjs";
import {
  PRODUCTION_CATALOGUE_ALERT_TITLE,
  productionHealthExcerpt
} from "./production-catalogue-alert.mjs";

const rows = Array.from({ length: MINIMUM_SAFE_PODCAST_CATALOGUE_ROWS }, (_, index) => ({
  Titel: `Podcast ${index}`,
  "Podcast-ID": `podcast-${index}`
}));

assert.equal(validateProductionCataloguePayload({ rows }).ok, true);
assert.equal(
  validateProductionCataloguePayload({ rows: rows.slice(1) }).ok,
  false,
  "999 rows must fail the absolute floor"
);
assert.equal(
  validateProductionCataloguePayload({ rows: [...rows.slice(0, -1), { Titel: "Missing" }] }).ok,
  false,
  "blank Podcast-ID must fail"
);
assert.equal(
  validateProductionCataloguePayload({
    rows: [...rows.slice(0, -1), { Titel: "Duplicate", "Podcast-ID": "podcast-0" }]
  }).ok,
  false,
  "duplicate Podcast-ID must fail"
);
assert.equal(validateProductionDisplayGroups({ version: 1, groups: [] }).ok, true);
assert.equal(validateProductionDisplayGroups({ version: 2, groups: [] }).ok, false);

const workflow = await readFile(
  new URL("../.github/workflows/production-catalogue-health.yml", import.meta.url),
  "utf8"
);
assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/u);
assert.match(workflow, /push:[\s\S]*branches:[\s\S]*- main/u);
assert.match(workflow, /issues: write/u);
assert.match(
  workflow,
  /node scripts\/production-catalogue-health\.mjs 2>&1 \| tee \.production-catalogue-health\.log/u
);
assert.match(workflow, /Alert on production catalogue failure/u);
assert.match(workflow, /Resolve production catalogue alert/u);

assert.equal(PRODUCTION_CATALOGUE_ALERT_TITLE, "Production catalogue health alert");
const excerpt = productionHealthExcerpt(
  "noise\nError: CRITICAL PRODUCTION CATALOGUE HEALTH FAILURE\n- catalogue row count 0 is below safety minimum 1000\nsecret=x"
);
assert.match(excerpt, /CRITICAL PRODUCTION CATALOGUE HEALTH FAILURE/u);
assert.match(excerpt, /catalogue row count 0/u);
assert.doesNotMatch(excerpt, /secret=x/u);

console.log("Production catalogue health safety checks passed.");
