import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  appendRadioIIIIToStaging, buildRadioIIIIStagingPlan, buildRadioIIIIStagingRow,
  CATALOGUE_HEADERS, RADIO_IIII_STAGING_HEADERS, RADIO_IIII_STAGING_TAB
} from "./google-sheets-staging.mjs";
import { buildRadioIIIIRoutes, RADIO_IIII_FEED_KEY, RADIO_IIII_FEED_URL } from "../supabase/functions/import-podcast-episodes/radio-iiii-routing.mjs";
import { mergeSheetFeedConfigs, RADIO_IIII_IMPORT_ACTIVATION_APPROVED } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { runEpisodeImport, selectNormalFeedKeys } from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeAutoDiscoveredRadioIIIIRows } from "./radio-iiii-auto-discovery.mjs";
import { slimPodcastRows } from "./sync-sheet-data.mjs";

const registry = JSON.parse(await readFile("data/auto-discovered-radio-iiii.json", "utf8"));
const candidates = registry.records;
assert.equal(candidates.length, 4);
assert.equal(RADIO_IIII_FEED_KEY, "radio_iiii_et_kapitel_for_sig");
assert.match(RADIO_IIII_FEED_URL, /api\/programs\/51e8702e-5649-4ff8-9681-ad4800b0bb22\/episodes/u);
const rows = candidates.map((candidate) => ({
  Titel: candidate.title, "Podcast-ID": candidate.podcast_id, Hovedserie: candidate.hovedserie,
  radioIIIIEpisodes: candidate.episodes
}));
const mergedCandidates = mergeAutoDiscoveredRadioIIIIRows([], registry);
const slimCandidates = await slimPodcastRows(mergedCandidates);
assert.equal(slimCandidates.length, 4);
assert.equal(slimCandidates.every((row) => row.radioIIIIEpisodes.length === 5 && row.radioIIIISeasonUrl && row.manualEpisodes.length === 5), true,
  "the staged catalogue preserves Radio IIII episode routing metadata through catalogue serialization");
const routes = buildRadioIIIIRoutes(rows);
assert.equal(routes.length, 20);
assert.equal(new Set(routes.flatMap((route) => route.external_guids)).size, 20);
assert.equal(routes.every((route) => route.title.patterns[0].test(candidates.flatMap((candidate) => candidate.episodes).find((episode) => episode.guid === route.external_guids[0]).title)), true,
  "each source route also requires its exact official episode title");
assert.equal(routes.every((route) => !route.title.patterns[0].test(`${candidates.flatMap((candidate) => candidate.episodes).find((episode) => episode.guid === route.external_guids[0]).title} - replay`)), true);
assert.equal(routes.filter((route) => route.key.endsWith(":prolog")).length, 4);
assert.deepEqual(routes.filter((route) => route.key.endsWith(":chapter-1")).map((route) => route.podcast_key).sort(), candidates.map((candidate) => candidate.podcast_id).sort());
assert.equal(buildRadioIIIIRoutes([{ ...rows[0], Hovedserie: "En anden serie" }]).length, 0);
assert.equal(buildRadioIIIIRoutes([{ ...rows[0], radioIIIIEpisodes: rows[0].radioIIIIEpisodes.slice(0, 4) }]).length, 0);
assert.equal(buildRadioIIIIRoutes([rows[0], { ...rows[1], radioIIIIEpisodes: rows[0].radioIIIIEpisodes }]).length, 5, "overlapping episode GUIDs are withheld from the later child");
const runtime = mergeSheetFeedConfigs({ rows: slimCandidates }, undefined);
assert.equal(RADIO_IIII_IMPORT_ACTIVATION_APPROVED, false, "Radio IIII production rollout remains explicitly code-gated");
assert.equal(runtime.configs[RADIO_IIII_FEED_KEY].enabled, false);
assert.equal(runtime.configs[RADIO_IIII_FEED_KEY].routes.length, 20);
assert.equal(runtime.configs[RADIO_IIII_FEED_KEY].format, "radio4_json");
assert.equal(selectNormalFeedKeys(runtime.configs).includes(RADIO_IIII_FEED_KEY), false, "Radio IIII is excluded from the existing scheduled import plan");
assert.equal(selectNormalFeedKeys(runtime.configs).includes("sig_noget_klogt_omny"), true, "the approved Sig noget klogt adapter remains scheduled");
assert.equal(FEED_CONFIGS.se_og_hor_lige_her.enabled, false, "SE og HØR remains inactive until its own rollout");
assert.equal(selectNormalFeedKeys(runtime.configs).includes("se_og_hor_lige_her"), false);
let radioCalls = 0;
await assert.rejects(runEpisodeImport({
  feedKey: RADIO_IIII_FEED_KEY,
  feedConfigs: runtime.configs,
  repository: { createImportRun: async () => { radioCalls++; throw new Error("unexpected import run"); } },
  fetchText: async () => { radioCalls++; throw new Error("unexpected feed fetch"); }
}), /Feed import is disabled/u, "direct Radio IIII import is blocked before an import run or network fetch");
await assert.rejects(runEpisodeImport({
  feedKey: "se_og_hor_lige_her",
  feedConfigs: runtime.configs,
  repository: { createImportRun: async () => { radioCalls++; throw new Error("unexpected import run"); } },
  fetchText: async () => { radioCalls++; throw new Error("unexpected feed fetch"); }
}), /Feed import is disabled/u, "direct SE og HØR import is blocked before an import run or network fetch");
assert.equal(radioCalls, 0, "disabled feed gates run before production write or source access");
const latestCatalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const latestRuntime = mergeSheetFeedConfigs(latestCatalogue);
const scheduledKeys = selectNormalFeedKeys(latestRuntime.configs);
assert.equal(latestRuntime.configs[RADIO_IIII_FEED_KEY].routes.length, 20, "the latest catalogue identities remain intact");
assert.equal(scheduledKeys.includes(RADIO_IIII_FEED_KEY), false, "the actual latest catalogue cannot schedule Radio IIII");
assert.equal(scheduledKeys.includes("se_og_hor_lige_her"), false, "the actual latest catalogue cannot schedule SE og HØR");
assert.equal(scheduledKeys.includes("sig_noget_klogt_omny"), true, "the exact approved Sig noget klogt importer is scheduled");

const staged = candidates.map((candidate) => buildRadioIIIIStagingRow(candidate, "2026-11-03"));
assert.equal(staged.every((row) => row.length === RADIO_IIII_STAGING_HEADERS.length), true);
assert.equal(staged.every((row) => row[CATALOGUE_HEADERS.indexOf("Antal afsnit")] === "5"), true, "the catalog count includes the prolog and four chapters");
assert.equal(staged.every((row) => row[CATALOGUE_HEADERS.indexOf("Vuring (1-10)")] === ""), true, "owner ratings remain blank for review");
assert.equal(staged.every((row) => row[CATALOGUE_HEADERS.indexOf("Afgivet vurdering")] === ""), true);
assert.equal(staged.every((row) => row[CATALOGUE_HEADERS.indexOf("Podcast-ID")]), true);
const plan = buildRadioIIIIStagingPlan({ headers: RADIO_IIII_STAGING_HEADERS, existingRows: [], candidates });
assert.equal(plan.append.length, 4);
assert.equal(buildRadioIIIIStagingPlan({ headers: RADIO_IIII_STAGING_HEADERS, existingRows: staged, candidates }).append.length, 0);
assert.throws(() => buildRadioIIIIStagingPlan({ headers: RADIO_IIII_STAGING_HEADERS.slice(0, -1), existingRows: [], candidates }), /header schema drift/u);
assert.throws(() => buildRadioIIIIStagingPlan({ headers: RADIO_IIII_STAGING_HEADERS, existingRows: [], candidates: [candidates[0], candidates[0]] }), /Duplicate RADIO IIII/u);
assert.throws(() => buildRadioIIIIStagingPlan({ headers: RADIO_IIII_STAGING_HEADERS, existingRows: [staged[0].map((value, index) => index === RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source GUIDs") ? "conflicting-guid" : value)], candidates }), /source conflict/u);
assert.throws(() => buildRadioIIIIStagingRow({ ...candidates[0], publisher: "DR" }), /identity or official/u);

class MockStaging {
  constructor() { this.rows = []; this.writeCalls = []; this.headers = RADIO_IIII_STAGING_HEADERS; this.tab = RADIO_IIII_STAGING_TAB; this.spreadsheetId = "separate-staging-sheet"; }
  async readSheet() { return { headers: [...RADIO_IIII_STAGING_HEADERS], rows: structuredClone(this.rows) }; }
  async writeRowsAt(startRow, values) {
    this.writeCalls.push(startRow);
    assert.equal(startRow, this.rows.length + 2, "Radio IIII rows are written directly below the existing table");
    this.rows.push(...structuredClone(values));
  }
}
const mock = new MockStaging();
assert.deepEqual(await appendRadioIIIIToStaging({ client: mock, candidates, dryRun: true }), { dryRun: true, appended: 0, alreadyPresent: 0 });
assert.equal(mock.writeCalls.length, 0);
assert.deepEqual(await appendRadioIIIIToStaging({ client: mock, candidates, dryRun: false }), { dryRun: false, appended: 4, alreadyPresent: 0 });
assert.deepEqual(await appendRadioIIIIToStaging({ client: mock, candidates, dryRun: false }), { dryRun: false, appended: 0, alreadyPresent: 4 });
assert.deepEqual(mock.writeCalls, [2], "explicit-coordinate writes stage once and repeat runs do not duplicate candidates");

console.log("RADIO IIII staging and exact-feed routing passed: separate source identities, 20 exact GUID routes, review-safe catalog columns, and idempotent staging.");
