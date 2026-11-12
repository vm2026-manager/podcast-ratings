import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createBufferClient, BufferApiError } from "./buffer-graphql.mjs";
import { slugFromPodcastId } from "./generate-seo-podcast-pages.mjs";
import {
  OWNER_TAKE_MAX_LENGTH, PLAN_SIZE, buildEditorialPlan, buildSuggestedHashtags, composeCaption, coverPlacementFingerprint, extractPodcastIdsFromBufferPosts,
  applyReviewCsv, isEligibleCatalogueRow, loadEditorialInputs, nextSuggestedDays, parseEditorialScore,
  serializeReviewCsv, validateEditorialPlan, validateOwnerApproval,
} from "./instagram-editorial-plan.mjs";
import { createReadOnlyInstagramGraphql, scanInstagramChannelHistory } from "./run-instagram-editorial-plan.mjs";

const root = process.cwd();
const planWorkflow = await readFile(path.join(root, ".github/workflows/instagram-editorial-plan.yml"), "utf8");
assert.match(planWorkflow, /^on:\r?\n  workflow_dispatch:\r?\n/m, "editorial planning remains manually triggered only");
assert.doesNotMatch(planWorkflow, /^\s+schedule:/m, "no daily or other automatic schedule is enabled");
assert.doesNotMatch(planWorkflow, /^\s{6}INSTAGRAM_PLAN_OUTPUT_DIR:.*runner\.temp/m,
  "runner.temp is not referenced from the job-level environment");
assert.match(planWorkflow, /^\s{10}INSTAGRAM_PLAN_OUTPUT_DIR: \$\{\{ runner\.temp \}\}\/instagram-editorial-plan/m,
  "artifact output uses runner.temp from the step-level environment where the context is available");
const inputs = await loadEditorialInputs(root);
const now = new Date("2026-11-12T12:00:00.000Z");
const channel = { id: "ig-channel", organizationId: "org-1", service: "instagram", name: "podcastlisten.dk",
  displayName: "@podcastlisten.dk", externalLink: "https://www.instagram.com/podcastlisten.dk/", isDisconnected: false, isLocked: false };
const org = { id: "org-1", name: "Podcastlisten" };
const makeBuffer = ({ channels = [channel], pages = [{ edges: [], pageInfo: { hasNextPage: false, endCursor: null } }] } = {}) => {
  let postPage = 0;
  const calls = [];
  const raw = async (query, variables = {}) => {
    calls.push(query);
    assert.doesNotMatch(query, /\bmutation\b/i);
    if (query.includes("InstagramEditorialOrganizations")) return { account: { organizations: [org] } };
    if (query.includes("InstagramEditorialChannels")) return { channels: channels.map((item) => ({ ...item, organizationId: variables.organizationId })) };
    if (query.includes("InstagramEditorialPosts")) return { posts: pages[postPage++] };
    throw new Error("Unexpected Buffer operation");
  };
  return { raw, calls, graphql: createReadOnlyInstagramGraphql(raw) };
};

assert.equal(parseEditorialScore("7,0"), 7);
assert.equal(parseEditorialScore("7.25"), 7.25);
assert.equal(parseEditorialScore("10"), 10);
for (const invalid of [null, "", "6,", "7,2 points", "11", "-1", "NaN", "7,2,1", "7.123"]) assert.equal(parseEditorialScore(invalid), null);
const row = inputs.podcasts.find((item) => item["Podcast-ID"] === "elizabeth holmes");
assert.equal(isEligibleCatalogueRow(row), true, "an x-marked underrated pearl is eligible below 7.0");
assert.equal(parseEditorialScore(row["Vuring (1-10)"]), 6.8);
assert.equal(isEligibleCatalogueRow({ ...row, "Undervurderet perle": "" }), false, "a low score without the exact pearl flag is excluded");
assert.equal(isEligibleCatalogueRow({ ...row, Uaktuel: "X" }), false, "inactive rows are excluded");
assert.equal(isEligibleCatalogueRow({ ...row, needs_editorial_review: true }), false, "identity-review rows are excluded");
assert.equal(isEligibleCatalogueRow({ ...row, "Vuring (1-10)": "7,0", "Undervurderet perle": "" }), true, "7.0 is included without conflating user or episode ratings");
assert.equal(isEligibleCatalogueRow({ ...row, "Vuring (1-10)": "Afgivet vurdering: 9,9" }), false, "user rating text is never parsed as editorial score");

const plan = buildEditorialPlan({ ...inputs,
  bufferScan: { account: "@podcastlisten.dk", complete: true, scannedAt: now.toISOString(), scanId: "fixture", postCount: 0, posts: [] },
  today: now, root });
assert.equal(plan.posts.length, PLAN_SIZE);
assert.equal(plan.selection.featuredReviewsRequired, false, "catalogue score eligibility does not require a featured review");
assert.equal(plan.rights.approvalCount, 0);
assert.equal(plan.safety.bufferMutations, 0);
assert.equal(plan.safety.publicationEnabled, false);
assert.deepEqual(plan.posts.map((slot) => slot.suggestedDate), [
  "2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23", "2026-11-25",
  "2026-11-27", "2026-11-30", "2026-12-02", "2026-12-04", "2026-12-07",
  "2026-12-09", "2026-12-11", "2026-12-14", "2026-12-16", "2026-12-18",
]);
assert.equal(new Set(plan.posts.map((slot) => slot.podcastId)).size, 15);
assert.ok(plan.posts.every((slot) => slot.canonicalProfileUrl === `https://podcastlisten.dk/podcast/${slot.podcastId.replaceAll(" ", "-")}/` || slot.canonicalProfileUrl.startsWith("https://podcastlisten.dk/podcast/")));
assert.ok(plan.posts.every((slot) => slot.cover.sourceChecksum && inputs.verifiedCoverIds.has(slot.podcastId)));
assert.ok(plan.posts.some((slot) => slot.score.value < 7 && slot.underratedPearl), "low-score x pearls are selected when source-valid");
assert.ok(plan.posts.every((slot) => slot.caption.ownerTake === ""));
assert.ok(plan.posts.every((slot) => slot.caption.publisherMentions.length === 0));
assert.ok(plan.posts.every((slot) => slot.captionDraft.includes("PERSONLIGT TAKE SKAL INDSÆTTES")));
assert.ok(plan.posts.every((slot) => slot.cover.rightsStatus === "blocked-no-documented-reuse-right" && slot.cover.previewPath === null));
assert.ok(plan.posts.every((slot) => slot.readiness.status === "awaiting-owner-take-and-approval"));
assert.ok(plan.posts.every((slot) => slot.caption.hashtags.some((tag) => tag.toLowerCase() === "#podcastlisten")));
assert.ok(plan.posts.every((slot) => slot.caption.hashtags.length >= 3));
assert.ok(plan.posts.some((slot) => slot.mainSeries === "Djævlen i detaljen"));
assert.ok(plan.posts.every((slot) => !Object.hasOwn(slot, "featuredReview")), "featured-reviews.json is not used as a universal gate or caption source");

const lowPearlIds = plan.posts.filter((slot) => slot.score.value < 7).map((slot) => slot.podcastId);
assert.deepEqual(lowPearlIds, ["elizabeth holmes", "manden med den giftige paraply"]);
const firstCover = plan.posts[0].cover;
const originalBytes = await readFile(path.join(root, firstCover.sourcePath));
assert.equal(createHash("sha256").update(originalBytes).digest("hex"), firstCover.sourceChecksum, "source image bytes match the exact manifest checksum");

assert.deepEqual(nextSuggestedDays(now, 3), ["2026-11-16", "2026-11-18", "2026-11-20"]);
assert.deepEqual(nextSuggestedDays(new Date("2026-11-15T23:30:00.000Z"), 3), ["2026-11-23", "2026-11-25", "2026-11-27"], "suggestion dates use Copenhagen calendar time");
assert.deepEqual(buildSuggestedHashtags("Den store historie", "Third Ear / Politiken"), ["#podcastlisten", "#podcast", "#denstorehistorie", "#thirdear", "#politiken"]);

const canonicalPost = { id: "sent-1", status: "sent", channelId: channel.id, text: "Se https://podcastlisten.dk/podcast/elizabeth-holmes/" };
assert.deepEqual([...extractPodcastIdsFromBufferPosts([canonicalPost], inputs.podcasts)], ["elizabeth holmes"]);
const duplicateFiltered = buildEditorialPlan({ ...inputs, publishedPodcastIds: ["elizabeth holmes"],
  bufferScan: { account: "@podcastlisten.dk", complete: true, scannedAt: now.toISOString(), scanId: "fixture", postCount: 1, posts: [canonicalPost] }, today: now, root });
assert.ok(!duplicateFiltered.posts.some((slot) => slot.podcastId === "elizabeth holmes"));
assert.ok(duplicateFiltered.posts.every((slot) => slot.podcastId !== "elizabeth holmes"));
assert.throws(() => buildEditorialPlan({ ...inputs, bufferScan: { account: "@other", complete: true, scannedAt: now.toISOString(), postCount: 0, posts: [] }, today: now, root }), /read-only Buffer history scan/);
assert.throws(() => buildEditorialPlan({ ...inputs, verifiedCoverIds: new Set(), bufferScan: { account: "@podcastlisten.dk", complete: true, scannedAt: now.toISOString(), postCount: 0, posts: [] }, today: now, root }), /Only 0 safe/);

const duplicateRows = [...inputs.podcasts, { ...row }];
const duplicateIdentityPlan = buildEditorialPlan({ ...inputs, podcasts: duplicateRows,
  bufferScan: { account: "@podcastlisten.dk", complete: true, scannedAt: now.toISOString(), scanId: "fixture", postCount: 0, posts: [] }, today: now, root });
assert.ok(!duplicateIdentityPlan.posts.some((slot) => slot.podcastId === row["Podcast-ID"]));
assert.equal(slugFromPodcastId("elizabeth holmes"), slugFromPodcastId("elizabeth-holmes"));
const slugCollisionRows = [...inputs.podcasts, { ...row, "Podcast-ID": "elizabeth-holmes" }];
const slugCollisionPlan = buildEditorialPlan({ ...inputs, podcasts: slugCollisionRows,
  bufferScan: { account: "@podcastlisten.dk", complete: true, scannedAt: now.toISOString(), scanId: "fixture", postCount: 0, posts: [] }, today: now, root });
assert.ok(!slugCollisionPlan.posts.some((slot) => slot.podcastId === "elizabeth holmes"), "canonical slug collisions cannot lose exact identity");

const { graphql, calls } = makeBuffer({ pages: [
  { edges: [{ node: canonicalPost }], pageInfo: { hasNextPage: true, endCursor: "cursor-1" } },
  { edges: [], pageInfo: { hasNextPage: false, endCursor: null } },
] });
const scan = await scanInstagramChannelHistory(graphql, { now, scanId: "test" });
assert.equal(scan.complete, true);
assert.equal(scan.postCount, 1);
assert.equal(scan.posts[0].status, "sent");
assert.ok(calls.every((query) => query.trimStart().startsWith("query ")));
await assert.rejects(graphql("mutation { createPost { id } }"), /read-only.*mutations are forbidden/);
assert.equal(calls.length, 4, "a forbidden mutation is rejected before any request reaches the client");

const wrong = makeBuffer({ channels: [{ ...channel, externalLink: "https://instagram.com/other/" }] });
await assert.rejects(scanInstagramChannelHistory(wrong.graphql, { now }), /found 0/);
const ambiguous = makeBuffer({ channels: [channel, { ...channel, id: "duplicate-channel" }] });
await assert.rejects(scanInstagramChannelHistory(ambiguous.graphql, { now }), /found 2/);
const stalled = makeBuffer({ pages: [{ edges: [], pageInfo: { hasNextPage: true, endCursor: "same" } }, { edges: [], pageInfo: { hasNextPage: true, endCursor: "same" } }] });
await assert.rejects(scanInstagramChannelHistory(stalled.graphql, { now }), /pagination did not advance/);

const incompleteSlot = structuredClone(plan.posts[0]);
const missingTake = validateOwnerApproval(incompleteSlot);
assert.equal(missingTake.approved, false);
assert.ok(missingTake.errors.some((message) => /Owner personal take/.test(message)));
assert.ok(missingTake.errors.some((message) => /reuse rights/.test(message)));
assert.ok(missingTake.errors.some((message) => /link is not verified/.test(message)));

const ownerApprovedSlot = structuredClone(plan.posts[0]);
ownerApprovedSlot.caption.ownerTake = "Jeg blev især hængende ved fortællingens dokumenterede detaljer.";
ownerApprovedSlot.caption.targetLinkStatus = "owner-verified-first-full-episode-or-series";
ownerApprovedSlot.caption.targetLinkEvidenceUrl = "https://official.example/episode";
ownerApprovedSlot.caption.targetLinkVerifiedBy = "Owner";
ownerApprovedSlot.caption.targetLinkVerifiedAt = "2026-11-12T13:00:00.000Z";
ownerApprovedSlot.caption.publisherMentions = ["@third_ear"];
ownerApprovedSlot.caption.publisherMentionEvidence = [{ handle: "@third_ear", evidenceUrl: "https://official.example/social" }];
ownerApprovedSlot.cover.rightsStatus = "documented-cover-right-present";
ownerApprovedSlot.cover.qualityReview = { podcastId: ownerApprovedSlot.podcastId, sourceChecksum: ownerApprovedSlot.cover.sourceChecksum,
  approved: true, approvedBy: "Owner", approvedAt: "2026-11-12T13:00:00.000Z", notes: "Source has sufficient detail and legible composition." };
ownerApprovedSlot.cover.placement = { podcastId: ownerApprovedSlot.podcastId, sourceChecksum: ownerApprovedSlot.cover.sourceChecksum,
  approved: true, approvedBy: "Owner", approvedAt: "2026-11-12T13:00:00.000Z", contrastMode: "light-on-dark", x: 80, y: 80, notes: "Clear dark area, no title art overlap" };
ownerApprovedSlot.cover.approvedForPost = true;
ownerApprovedSlot.cover.outputChecksum = "b".repeat(64);
ownerApprovedSlot.approval = { approved: true, approvedBy: "Owner", approvedAt: "2026-11-12T13:05:00.000Z",
  captionSha256: createHash("sha256").update(composeCaption(ownerApprovedSlot)).digest("hex"),
  placementSha256: coverPlacementFingerprint(ownerApprovedSlot.cover.placement),
  coverSourceChecksum: ownerApprovedSlot.cover.sourceChecksum, coverOutputChecksum: ownerApprovedSlot.cover.outputChecksum };
ownerApprovedSlot.captionDraft = composeCaption(ownerApprovedSlot);
assert.equal(validateOwnerApproval(ownerApprovedSlot).approved, true);
const editedCaption = structuredClone(ownerApprovedSlot);
editedCaption.caption.ownerTake = "Ny tekst efter godkendelse.";
assert.ok(validateOwnerApproval(editedCaption).errors.some((message) => /Caption changed/.test(message)));
const changedSource = structuredClone(ownerApprovedSlot);
changedSource.cover.sourceChecksum = "c".repeat(64);
assert.ok(validateOwnerApproval(changedSource).errors.some((message) => /source checksum changed/.test(message)));
const missingQuality = structuredClone(ownerApprovedSlot);
missingQuality.cover.qualityReview.approved = false;
assert.ok(validateOwnerApproval(missingQuality).errors.some((message) => /image-quality approval/.test(message)));
const movedOverlay = structuredClone(ownerApprovedSlot);
movedOverlay.cover.placement.x += 20;
assert.ok(validateOwnerApproval(movedOverlay).errors.some((message) => /placement changed/.test(message)));
assert.equal(validateEditorialPlan({ ...plan, posts: [] }).ready, false);
const currentPlanValidation = validateEditorialPlan(plan, { ...inputs, now });
assert.equal(currentPlanValidation.ready, false, "unapproved planning output can never pass final readiness");
assert.ok(currentPlanValidation.slots.every((slot) => !slot.errors.some((message) => /Catalogue identity, score/.test(message))),
  "the final validator matches the exact editorial score field to the catalogue master");
const wrongAccountPlan = validateEditorialPlan({ ...plan, account: "@someone_else" }, { ...inputs, now });
assert.ok(wrongAccountPlan.errors.some((message) => /exact Instagram account/.test(message)));
const incompleteHistoryPlan = validateEditorialPlan({ ...plan, bufferHistory: { ...plan.bufferHistory, complete: false } }, { ...inputs, now });
assert.ok(incompleteHistoryPlan.errors.some((message) => /complete Buffer history scan/.test(message)));
const changedScorePlan = structuredClone(plan);
changedScorePlan.posts[0].score.display = "9.9";
const changedScoreValidation = validateEditorialPlan(changedScorePlan, { ...inputs, now });
assert.ok(changedScoreValidation.slots[0].errors.some((message) => /Catalogue identity, score/.test(message)),
  "edited scores cannot detach a slot from its exact catalogue identity");

let apiCalls = 0;
const deniedClient = createBufferClient({ token: "not-a-real-secret", fetchImpl: async () => { apiCalls += 1; return new Response("", { status: 403 }); } });
await assert.rejects(deniedClient("query ReadOnlyTest { account { id } }"), (error) => error instanceof BufferApiError && error.code === "forbidden");
assert.equal(apiCalls, 1, "API access denial is surfaced and is not retried");

const temp = await mkdtemp(path.join(os.tmpdir(), "instagram-editorial-plan-"));
try {
  const csv = serializeReviewCsv(plan);
  assert.equal(csv.trimEnd().split("\r\n").length, 16);
  assert.match(csv, /"ownerTake"/);
  assert.match(csv, /PERSONLIGT TAKE SKAL INDSÆTTES/);
  const edited = structuredClone(plan);
  edited.posts[0].caption.ownerTake = "En kort personlig take fra ejeren.";
  const imported = applyReviewCsv(plan, serializeReviewCsv(edited));
  assert.equal(imported.posts[0].caption.ownerTake, edited.posts[0].caption.ownerTake);
  assert.equal(imported.posts[0].approval.approved, false, "CSV import never grants owner approval");
  assert.notEqual(imported.posts[0].captionDraft, plan.posts[0].captionDraft);
  const invalidIdsCsv = csv.replace(plan.posts[0].podcastId, "not-an-exact-id");
  assert.throws(() => applyReviewCsv(plan, invalidIdsCsv), /do not exactly match/);
  const overlong = structuredClone(plan);
  overlong.posts[0].caption.ownerTake = "x".repeat(OWNER_TAKE_MAX_LENGTH + 1);
  assert.throws(() => applyReviewCsv(plan, serializeReviewCsv(overlong)), /exceeds 240 characters/);
} finally { await rm(temp, { recursive: true, force: true }); }

console.log(`Instagram editorial pipeline tests passed: 15 exact identities, scoring/perle selection, Buffer history exclusions, cover checksums, owner-bound approvals, and read-only mutation guard (${inputs.verifiedCoverIds.size} verified source covers)`);
