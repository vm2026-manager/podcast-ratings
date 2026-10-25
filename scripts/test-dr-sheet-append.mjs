import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { appendVerifiedDrRows, assertProductionWriteGate, REQUIRED_HEADERS, SheetsApiClient } from "./google-sheets-append.mjs";
import { mergeAutoDiscoveredBakspejlRows } from "./bakspejl-auto-discovery.mjs";
import { mergeAutoDiscoveredDjaevlenRows } from "./djaevlen-auto-discovery.mjs";
import { VERIFIED_DR_SERIES_METADATA } from "./verified-dr-series-metadata.mjs";
import { buildRecommendationData } from "./build-recommendation-metadata.mjs";
import { preserveCatalogueIdsByPodcastId } from "./sync-sheet-data.mjs";

class MockSheet {
  constructor(rows = []) { this.rows = structuredClone(rows); this.appendCalls = 0; this.failAfterAppend = false; }
  async readSheet() { return { headers: [...REQUIRED_HEADERS], rows: structuredClone(this.rows) }; }
  async appendRows(values) {
    this.appendCalls += 1;
    this.rows.push(...structuredClone(values));
    if (this.failAfterAppend) { this.failAfterAppend = false; throw new Error("simulated timeout after commit"); }
  }
}

const ids = Object.keys(VERIFIED_DR_SERIES_METADATA);
const candidates = ids.map((id) => {
  const m = VERIFIED_DR_SERIES_METADATA[id];
  return { Titel: m.title, "Podcast-ID": id, Hovedserie: m.mainSeries, Link: m.sourceUrl, Kilde: m.sourceUrl, Billedlink: "https://api.dr.dk/covers/test.jpg", needs_editorial_review: false };
});

// First append is one batch; rerun checks exact Podcast-ID and never overwrites.
const sheet = new MockSheet();
assert.deepEqual(await appendVerifiedDrRows({ client: sheet, candidates, dryRun: true }), { dryRun: true, appended: 0, alreadyPresent: 0 });
assert.equal(sheet.appendCalls, 0);
assert.deepEqual(await appendVerifiedDrRows({ client: sheet, candidates, dryRun: false }), { dryRun: false, appended: 2, alreadyPresent: 0 });
assert.equal(sheet.appendCalls, 1);
assert.deepEqual(await appendVerifiedDrRows({ client: sheet, candidates, dryRun: false }), { dryRun: false, appended: 0, alreadyPresent: 2 });
assert.equal(sheet.appendCalls, 1);

// A timed-out write is resolved by read-back; the next run remains idempotent.
const ambiguous = new MockSheet();
ambiguous.failAfterAppend = true;
assert.equal((await appendVerifiedDrRows({ client: ambiguous, candidates: candidates.slice(0, 1), dryRun: false })).recoveredAfterAmbiguousFailure, true);
assert.equal(ambiguous.rows.length, 1);
assert.equal((await appendVerifiedDrRows({ client: ambiguous, candidates: candidates.slice(0, 1), dryRun: false })).appended, 0);

// Editing in the sheet wins on normal catalogue sync; existing row content is returned untouched.
const editedRow = Array(REQUIRED_HEADERS.length).fill("");
editedRow[REQUIRED_HEADERS.indexOf("Titel")] = "Kvinden i Isdalen";
editedRow[REQUIRED_HEADERS.indexOf("Podcast-ID")] = ids[0];
editedRow[REQUIRED_HEADERS.indexOf("Hovedserie")] = "Djævlen i detaljen";
editedRow[REQUIRED_HEADERS.indexOf("Kort beskrivelse")] = "Redaktørens rettelse";
const djaevlenRegistry = { records: [{ title: "Kvinden i Isdalen", podcast_id: ids[0], discovery_key: "kvinden i isdalen", hovedserie: "Djævlen i detaljen" }] };
const manualWins = mergeAutoDiscoveredDjaevlenRows([{ Titel: "Kvinden i Isdalen", "Podcast-ID": ids[0], Hovedserie: "Djævlen i detaljen", "Kort beskrivelse": "Redaktørens rettelse" }], djaevlenRegistry);
assert.equal(manualWins.length, 1);
assert.equal(manualWins[0]["Kort beskrivelse"], "Redaktørens rettelse");
const ratedExisting = Array(REQUIRED_HEADERS.length).fill("");
ratedExisting[REQUIRED_HEADERS.indexOf("Titel")] = "Kvinden i Isdalen";
ratedExisting[REQUIRED_HEADERS.indexOf("Podcast-ID")] = ids[0];
ratedExisting[REQUIRED_HEADERS.indexOf("Hovedserie")] = "Djævlen i detaljen";
ratedExisting[REQUIRED_HEADERS.indexOf("Vuring (1-10)")] = "8,7";
ratedExisting[REQUIRED_HEADERS.indexOf("Afgivet vurdering")] = "2026-10-20";
const protectedRowSheet = new MockSheet([ratedExisting]);
assert.equal((await appendVerifiedDrRows({ client: protectedRowSheet, candidates: candidates.slice(0, 1), dryRun: false })).appended, 0);
assert.equal(protectedRowSheet.appendCalls, 0);
assert.equal(protectedRowSheet.rows[0][REQUIRED_HEADERS.indexOf("Vuring (1-10)")], "8,7");
assert.equal(protectedRowSheet.rows[0][REQUIRED_HEADERS.indexOf("Afgivet vurdering")], "2026-10-20");

// Immutable IDs and source identities are retained; no rating, listening history or episode fields are generated.
const bakspejlRegistry = { records: [{ title: "Den spanske borgerkrig", podcast_id: ids[1], discovery_key: "den spanske borgerkrig", hovedserie: "Bakspejl", publisher: "DR", cover: "https://api.dr.dk/covers/test.jpg" }] };
const autoRows = mergeAutoDiscoveredBakspejlRows([], bakspejlRegistry);
assert.equal(autoRows[0]["Podcast-ID"], "bakspejl-auto-v1-4962cdc5");
assert.equal(autoRows[0].Genre, "Historie");
assert.ok(autoRows[0]["Kort beskrivelse"].includes("Harald, Aage og Kai"));
for (const forbidden of ["Vuring (1-10)", "Afgivet vurdering", "Årstal afspillet", "Episoder", "Feed", "Undervurderet perle"]) {
  assert.equal(forbidden in autoRows[0], false, `${forbidden} must remain unset`);
}
assert.equal(preserveCatalogueIdsByPodcastId(autoRows, [{ "Podcast-ID": ids[1], catalogue_id: "catalogue-v1-existing" }])[0].catalogue_id, "catalogue-v1-existing");
assert.throws(() => preserveCatalogueIdsByPodcastId(autoRows, [{ "Podcast-ID": ids[1] }, { "Podcast-ID": ids[1] }]), /duplicate Podcast-ID/);
const legacyEditorialRow = { Titel: "Dræberurten", "Podcast-ID": "dræberurten", Hovedserie: "Djævlen i detaljen", "Kort beskrivelse": "Existing editorial row" };
assert.deepEqual(
  preserveCatalogueIdsByPodcastId([{ ...legacyEditorialRow, needs_editorial_review: true }], [legacyEditorialRow])[0],
  legacyEditorialRow,
  "Unreviewed metadata must not erase an already-published catalogue row"
);

const brokenHeader = [...REQUIRED_HEADERS];
brokenHeader[19] = "Manual similarity";
await assert.rejects(() => import("./google-sheets-append.mjs").then(({ buildAppendPlan }) => buildAppendPlan({ headers: brokenHeader, existingRows: [], candidates })), /header schema drift/);
const duplicateRow = [...sheet.rows[0]];
await assert.rejects(() => import("./google-sheets-append.mjs").then(({ buildAppendPlan }) => buildAppendPlan({ headers: REQUIRED_HEADERS, existingRows: [duplicateRow, duplicateRow], candidates: [] })), /duplicate Podcast-ID/);
await assert.rejects(() => import("./google-sheets-append.mjs").then(({ buildAppendPlan }) => buildAppendPlan({ headers: REQUIRED_HEADERS, existingRows: [["orphan row"]], candidates: [] })), /without Podcast-ID/);
assert.throws(() => new SheetsApiClient({}), /credentials are missing/);
let apiCalls = 0;
const apiClient = new SheetsApiClient({
  accessToken: "short-lived-test-token",
  fetchImpl: async (url, options) => {
    apiCalls += 1;
    if (options.method === "POST") {
      assert.match(String(url), /valueInputOption=RAW/u);
      assert.match(String(options.body), /=IMPORTXML/u, "RAW API payload treats untrusted formulas as plain text");
      return new Response("{}", { status: 200 });
    }
    return apiCalls === 1
      ? new Response("rate limited", { status: 429 })
      : new Response(JSON.stringify({ values: [REQUIRED_HEADERS] }), { status: 200 });
  }
});
assert.equal((await apiClient.readSheet()).headers.length, REQUIRED_HEADERS.length);
assert.equal(apiCalls, 2, "read retries a bounded rate-limit response");
await apiClient.appendRows([["=IMPORTXML(\"https://example.invalid\",\"//x\")"]]);
assert.equal(apiCalls, 3, "append is not blindly retried");
assert.throws(() => assertProductionWriteGate({}), /gate is closed/);
assert.doesNotThrow(() => assertProductionWriteGate({ GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", GOOGLE_SHEETS_WRITE_ENABLED: "true", GOOGLE_SHEETS_BACKUP_VERIFIED: "true", GOOGLE_SHEETS_SPREADSHEET_ID: "1V21y9uMx_fGethrT47hILWczgK_ZSNRfksSKWuR69ss", GOOGLE_ACCESS_TOKEN: "short-lived-test-token" }));

// Recommendation metadata accepts both enriched IDs and provides content topics.
const files = ["../data/podcasts.json", "../data/auto-discovered-djaevlen.json", "../data/auto-discovered-bakspejl.json", "../config/recommendation-topic-aliases.json", "../config/recommendation-genre-mapping.json", "../data/recommendation-metadata.json"];
const [catalogue, drRegistry, backRegistry, aliases, genres, previousMetadata] = await Promise.all(
  files.map((path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse))
);
const verifiedIds = new Set(ids);
let recommendationRows = catalogue.rows.filter((row) => !verifiedIds.has(row["Podcast-ID"]));
recommendationRows = mergeAutoDiscoveredDjaevlenRows(recommendationRows, drRegistry);
recommendationRows = mergeAutoDiscoveredBakspejlRows(recommendationRows, backRegistry);
recommendationRows = recommendationRows.map((row) => ({
  ...row,
  secondaryGenre: row.secondaryGenre || row["2. genre"] || "",
  topics: Array.isArray(row.topics) ? row.topics : String(row.Emner || "").split(";").map((topic) => topic.trim()).filter(Boolean)
}));
const built = buildRecommendationData({ rows: recommendationRows }, aliases, genres, {
  repoRoot: process.cwd(), existingMetadata: previousMetadata
});
for (const title of ["Kvinden i Isdalen", "Den spanske borgerkrig"]) {
  const metadata = built.payload.rows.find((row) => row.title === title);
  assert.equal(metadata?.recommendationMetadataEligible, true, `${title} must be recommendation-eligible`);
  assert.ok(metadata.topicsCanonical.length > 0, `${title} needs source-based topics`);
}
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const topicPhase = app.indexOf("appendPhase(scoredCandidates.filter((candidate) => candidate.hasTopicMatch));");
const sameSeriesPhase = app.indexOf("appendPhase(sameSeriesCandidates);", topicPhase);
assert.ok(topicPhase >= 0 && sameSeriesPhase > topicPhase, "topic-based recommendations precede same-series fallback");

console.log("DR Sheets append tests passed (mock-only; no production Google writes)");
