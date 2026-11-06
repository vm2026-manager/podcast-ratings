import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { discoverTyranSeries, mergeAutoDiscoveredTyranRows, normalizeTyranIdentity, parseTyranChildPage, parseTyranDirectory, parseTyranFullEpisodes, TYRAN_PROTECTED_IDS, TYRAN_PROTECTED_IMAGE_IDS } from "./tyran-auto-discovery.mjs";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { mapDrLydEpisodes, parseDrLydEpisodes, routeEpisodes } from "../supabase/functions/import-podcast-episodes/core.ts";
import { TYRAN_MACIAS_ID } from "./tyran-auto-discovery.mjs";
import { slugFromPodcastId } from "./generate-seo-podcast-pages.mjs";
import { validateCatalogue } from "./seo-podcast-safety.mjs";

const catalogue = JSON.parse(readFileSync(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const coverRegistry = JSON.parse(readFileSync(new URL("../data/auto-discovered-tyran.json", import.meta.url), "utf8"));
const official = Object.fromEntries(coverRegistry.records.map((record) => [record.discovery_key, record.cover_image_id]));
const protectedRows = catalogue.rows.filter((row) => Object.hasOwn(TYRAN_PROTECTED_IDS, normalizeTyranIdentity(row.Titel)));
assert.equal(protectedRows.length, 22);
assert.deepEqual(Object.fromEntries(protectedRows.map((row) => [normalizeTyranIdentity(row.Titel), row["Podcast-ID"]])), TYRAN_PROTECTED_IDS,
  "All PR #243 identities remain exact in the source catalogue");

const parts = protectedRows.map((row, index) => ({
  id: `urn:dr:radio:series:${String(index + 1).padStart(24, "0")}`,
  productionNumber: String(6640000000000 + index), title: `Tyran | ${row.Titel}`,
  presentationUrl: `https://www.dr.dk/lyd/p3/tyran-${index}-${6640000000000 + index}`,
  imageAssets: [{ id: `urn:dr:radio:image:${TYRAN_PROTECTED_IMAGE_IDS[normalizeTyranIdentity(row.Titel)]}`, ratio: "1:1", target: "SquareImage", format: "image/jpeg" }]
}));
const newParts = [
  { id: "urn:dr:radio:series:000000000000000000000023", productionNumber: "6641072699897", title: "Tyran | Macias", presentationUrl: "https://www.dr.dk/lyd/p3/tyran-macias-6641072699897", imageAssets: [{ id: "urn:dr:radio:image:6a4e30ea60319a54701828b9", ratio: "1:1", target: "SquareImage", format: "image/jpeg" }] },
  { id: "urn:dr:radio:series:000000000000000000000024", productionNumber: "6641325831949", title: "Tyran | Marcos", presentationUrl: "https://www.dr.dk/lyd/p3/tyran-marcos-6641325831949", imageAssets: [{ id: "urn:dr:radio:image:6ad8a63dd1248e67782813bf", ratio: "1:1", target: "SquareImage", format: "image/jpeg" }] }
];
const directory = (items = [...parts, ...newParts]) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: {
  pageType: "umbrella", bannerData: { drlyd_itemSlug: "tyran-4747004850000" }, parts: items
} } })}</script>`;
const parsedParts = parseTyranDirectory(directory());
assert.equal(parsedParts.length, 24, "The source directory is read as 24 distinct DR child series");

const childPage = (part, overrides = {}) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: {
  pageType: "series", series: { id: part.dr_series_id, productionNumber: part.production_number, presentationUrl: part.source_url,
    description: "Verified DR description for this exact Tyran child series." },
  bannerData: { drlyd_pageID: "series", drlyd_url: part.source_url },
  episodesGroups: [{ items: [{ id: "urn:dr:radio:episode:fixture", productionNumber: "16122693681", title: `1:4 - ${part.title}`,
    startTime: "2026-08-06T05:00:00+02:00", durationMilliseconds: 2233500,
    presentationUrl: "https://www.dr.dk/lyd/p3/tyran-macias/1-4-macias-16122693681",
    imageAssets: [{ id: "urn:dr:radio:image:6a4e30ea60319a54701828b9", ratio: "1:1", target: "SquareImage" }], ...overrides }] }]
} } })}</script>`;
const selected = parsedParts.filter((part) => ["macias", "marcos"].includes(part.discovery_key));
const childPages = Object.fromEntries(selected.map((part) => [part.discovery_key, parseTyranChildPage(childPage(part), part)]));
const coverChecksums = Object.fromEntries(selected.map((part, index) => [part.cover_image_id, {
  mimeType: "image/jpeg", width: 720, height: 720, byteLength: 50000, sha256: String(index + 1).repeat(64)
}]));
const registry = { version: 1, baseline_published_at: "2026-11-06T00:00:00.000Z", records: [] };
const positive = discoverTyranSeries({ html: directory(), childPages, coverChecksums, catalogueRows: catalogue.rows, registry });
assert.deepEqual(positive.report.created.map((record) => record.discovery_key).sort(), ["macias", "marcos"]);
assert.equal(positive.registry.records.find((record) => record.discovery_key === "macias").podcast_id, TYRAN_MACIAS_ID);
assert.equal(positive.registry.records.find((record) => record.discovery_key === "marcos").podcast_id, "marcos", "Existing Marcos Podcast-ID is adopted exactly");
assert.equal(positive.registry.records.find((record) => record.discovery_key === "macias").description_source_url,
  "https://www.dr.dk/lyd/p3/tyran-macias-6641072699897", "The editorial description carries exact DR child-page provenance");
assert.ok(positive.registry.records.every((record) => record.feed_activation_approved === false));
assert.equal(discoverTyranSeries({ html: directory(), childPages, coverChecksums, catalogueRows: catalogue.rows, registry: positive.registry }).report.created.length, 0,
  "A repeated discovery run creates no duplicate identities");
const sheetFirst = discoverTyranSeries({ html: directory(), childPages, coverChecksums,
  catalogueRows: [...catalogue.rows.filter((row) => row["Podcast-ID"] !== TYRAN_MACIAS_ID),
    { Titel: "Macias", "Podcast-ID": "sheet-assigned-macias", Hovedserie: "Tyran" }], registry });
assert.equal(sheetFirst.registry.records.find((record) => record.discovery_key === "macias").podcast_id, "sheet-assigned-macias",
  "A unique existing Sheet identity is adopted exactly instead of allocating a second ID");
const aliasConflict = discoverTyranSeries({ html: directory(), childPages, coverChecksums, catalogueRows: catalogue.rows, registry, aliases: { "Macias": "old macias alias" } });
assert.ok(aliasConflict.report.collisions.some((item) => item.title === "Macias" && /alias/u.test(item.reason)),
  "A protected identity alias stops automatic registration");

const missingCover = { ...coverChecksums }; delete missingCover["6a4e30ea60319a54701828b9"];
const noCover = discoverTyranSeries({ html: directory(), childPages, coverChecksums: missingCover, catalogueRows: catalogue.rows, registry });
assert.ok(noCover.report.manual_review.some((item) => item.title === "Macias"));
assert.ok(!noCover.registry.records.some((record) => record.discovery_key === "macias"), "A missing official cover is never approved");
const noDescription = discoverTyranSeries({ html: directory(), childPages: { ...childPages, macias: { episodes: childPages.macias.episodes } }, coverChecksums,
  catalogueRows: catalogue.rows, registry });
assert.ok(noDescription.report.manual_review.some((item) => item.title === "Macias" && /description/u.test(item.reason)),
  "A child page without its matching DR series description remains out of the public registry");

const reused = directory([...parts, { ...newParts[0], imageAssets: newParts[1].imageAssets }, newParts[1]]);
const reusedResult = discoverTyranSeries({ html: reused, childPages, coverChecksums, catalogueRows: catalogue.rows, registry });
assert.ok(reusedResult.report.manual_review.some((item) => item.title === "Macias"), "A reused generic image fails the uniqueness gate");
assert.throws(() => parseTyranDirectory(directory([...parts, { ...newParts[0], presentationUrl: "https://example.test/series" }, newParts[1]])), /Unverified Tyran directory entry/);
assert.throws(() => parseTyranFullEpisodes(childPage(selected[0], { productionNumber: "wrong-guid" }), selected[0]), /no verified full episode/);
assert.throws(() => parseTyranFullEpisodes(childPage(selected[0], { title: "Teaser: Macias" }), selected[0]), /no verified full episode/);
assert.throws(() => parseTyranChildPage(childPage(selected[0]).replace("tyran-macias-6641072699897", "tyran-other-6641072699897"), selected[0]), /lacks matching series description/);

const collidingRows = [...catalogue.rows, { Titel: "Macias", "Podcast-ID": "duplicate-macias-id", Hovedserie: "Tyran" },
  { Titel: "Unrelated catalogue row", "Podcast-ID": "duplicate-macias-id", Hovedserie: "Other" }];
const collision = discoverTyranSeries({ html: directory(), childPages, coverChecksums, catalogueRows: collidingRows, registry });
assert.ok(collision.report.collisions.some((item) => item.title === "Macias"));
assert.throws(() => discoverTyranSeries({ html: directory(), childPages, coverChecksums, catalogueRows: catalogue.rows.filter((row) => row["Podcast-ID"] !== "leopold ii"), registry }), /Protected Tyran identity mismatch/);

const mergedRows = [...catalogue.rows, ...positive.registry.records.map((record) => ({ Titel: record.title, "Podcast-ID": record.podcast_id, Hovedserie: record.hovedserie }))];
const feedConfigs = mergeSheetFeedConfigs({ rows: mergedRows }).configs;
assert.equal(feedConfigs.tyran_macias_lyd_full.enabled, false, "A registry row cannot activate an unapproved DR feed");
assert.equal(feedConfigs.tyran_macias_lyd_full.podcast_key, TYRAN_MACIAS_ID);
assert.equal(feedConfigs.tyran_marcos_lyd_full.enabled, false);
const maliciousFeed = mergeSheetFeedConfigs({ rows: [...mergedRows, { Titel: "Macias", "Podcast-ID": TYRAN_MACIAS_ID, Hovedserie: "Tyran", Feed: "https://example.test/rss.xml" }] }).configs;
assert.equal(maliciousFeed.tyran_macias_lyd_full.enabled, false, "Generic Sheet feed discovery cannot activate the static adapter");

const fullPage = childPage(selected.find((part) => part.discovery_key === "macias"));
const mapped = mapDrLydEpisodes(parseDrLydEpisodes(fullPage), feedConfigs.tyran_macias_lyd_full, "2026-11-06T00:00:00.000Z");
assert.equal(mapped.errors.length, 0);
const routed = routeEpisodes(mapped.episodes, feedConfigs.tyran_macias_lyd_full);
assert.equal(routed.episodes[0].podcast_key, TYRAN_MACIAS_ID, "Full DR episodes route to the one exact child Podcast-ID");
assert.equal(routed.episodes.length, 1);

const sheet = [{ Titel: "Preserved row", "Podcast-ID": "unchanged", catalogue_id: "catalogue-original" }];
const appended = mergeAutoDiscoveredTyranRows(sheet, positive.registry);
assert.equal(appended[0].catalogue_id, "catalogue-original", "Sheet rows and catalogue IDs are preserved");
assert.equal(appended.filter((row) => row["Podcast-ID"] === TYRAN_MACIAS_ID).length, 1);
assert.equal(appended.find((row) => row["Podcast-ID"] === TYRAN_MACIAS_ID)["Lang beskrivelse"], "Verified DR description for this exact Tyran child series.");
const seoBaseline = JSON.parse(readFileSync(new URL("./seo-podcast-safety-baseline.json", import.meta.url), "utf8"));
const seoRows = mergeAutoDiscoveredTyranRows(catalogue.rows, positive.registry);
validateCatalogue({ count: seoRows.length, rows: seoRows }, seoBaseline, slugFromPodcastId);
assert.throws(() => mergeAutoDiscoveredTyranRows([], { records: [{ ...positive.registry.records[0], cover_width: 640 }] }), /Unverified or activatable/);

const workflow = readFileSync(new URL("../.github/workflows/discover-bakspejl-children.yml", import.meta.url), "utf8");
assert.match(workflow, /schedule:\s*\n\s*- cron: "47 \*\/6 \* \* \*"/u, "Tyran reuses the existing six-hour workflow schedule");
const tyranJob = workflow.match(/  discover-tyran:\r?\n([\s\S]*?)(?=\r?\n  [a-z0-9_-]+:|$)/u)?.[1] || "";
assert.ok(tyranJob.includes("node scripts/run-tyran-auto-discovery.mjs"));
assert.ok(tyranJob.includes("data/auto-discovered-tyran.json"));
assert.ok(!/cron:/u.test(tyranJob), "Tyran has no separate frequent schedule");
assert.ok(!/run-(?:bakspejl|djaevlen|radio-iiii)-auto-discovery/u.test(tyranJob), "Tyran source failures are isolated from the other discovery jobs");

console.log("Tyran directory, permanent identity, distinct DR artwork, teaser rejection, additive sync, exact full-episode routing, idempotency and disabled-feed regression tests passed.");
