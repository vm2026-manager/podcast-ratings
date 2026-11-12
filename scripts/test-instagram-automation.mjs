import assert from "node:assert/strict";
import { createBufferClient, assertMutationSuccess, BufferApiError } from "./buffer-graphql.mjs";
import { resolveInstagramChannel, selectPodcast, validateReviewLinkage, buildCaption } from "./instagram-selector.mjs";
import { performInstagramAction, QUEUE_ACKNOWLEDGEMENT } from "./instagram-actions.mjs";

const id = "test podcast";
const podcast = { "Podcast-ID": id, Titel: "Test Podcast", Udgiver: "Test Publisher", "Kort beskrivelse": "Beskrivelse", Genre: "Dokumentar" };
const review = { Aktiv: "JA", Titel: "Test Podcast", "Auto-udgiver": "Test Publisher", "Auto-genre": "Dokumentar", "Kort vurdering": "En velfortalt serie.", "Samlet score": "8,2", "Anmeldelsesdato": "01-01-2026" };
const sourceChecksum = "a".repeat(64);
const coverChecksum = "b".repeat(64);
const cover = { appPodcastKey: id, title: podcast.Titel, publisher: podcast.Udgiver, genre: podcast.Genre, status: "success", sourceAuditStatus: "valid", qualityCategory: "A", needsPlaceholder: false, originalImageUrl: "https://publisher.example/cover.jpg", sourceChecksum, successfulSourceChecksum: sourceChecksum, variants: { "800": { path: "data/covers/800/test-podcast.webp", actualWidth: 800, checksum: coverChecksum } } };
const approvals = { schemaVersion: 1, approvals: [{ podcastId: id, status: "approved", coverChecksum, evidenceUrl: "https://rights.example/license", approvedBy: "owner", approvedAt: "2026-01-01" }] };
const manifest = { podcasts: [cover] };

const org = { id: "org-1", name: "Podcastlisten" };
const channel = { id: "chan-1", name: "podcastlisten.dk", service: "instagram", externalLink: "https://www.instagram.com/podcastlisten.dk/", organizationId: "org-1", allowedActions: ["createPost"], isDisconnected: false, isLocked: false };
assert.equal(resolveInstagramChannel([org], new Map([[org.id, [channel]]])).id, channel.id);
assert.throws(() => resolveInstagramChannel([org], new Map([[org.id, [{ ...channel, id: "chan-2" }, channel]]])), /found 2/);
assert.throws(() => resolveInstagramChannel([org], new Map([[org.id, [{ ...channel, name: "different", externalLink: "https://instagram.com/different/" }]]])), /found 0/);
assert.throws(() => resolveInstagramChannel([org], new Map([[org.id, [{ ...channel, allowedActions: [] }]]])), /permissions/);
assert.throws(() => resolveInstagramChannel([org], new Map([[org.id, [{ ...channel, externalLink: "https://instagram.com/someone-else/" }]]])), /found 0/);

const selected = validateReviewLinkage(id, { podcasts: [podcast], reviews: [review], manifest, approvals });
assert.equal(selected.id, id);
assert.equal(selected.canonicalUrl, "https://podcastlisten.dk/podcast/test-podcast/");
assert.match(buildCaption(selected), /En velfortalt serie/);
assert.throws(() => validateReviewLinkage(id, { podcasts: [podcast, podcast], reviews: [review], manifest, approvals }), /exactly one catalogue row/);
assert.throws(() => validateReviewLinkage(id, { podcasts: [podcast], reviews: [{ ...review, Titel: "Almost Test Podcast" }], manifest, approvals }), /exactly one active exact editorial review/);
assert.throws(() => validateReviewLinkage(id, { podcasts: [podcast], reviews: [{ ...review, "Auto-udgiver": "Other publisher" }], manifest, approvals }), /exactly one active exact editorial review/);
assert.throws(() => validateReviewLinkage(id, { podcasts: [podcast], reviews: [{ ...review, "Auto-genre": "True Crime" }], manifest, approvals }), /exactly one active exact editorial review/);
assert.throws(() => validateReviewLinkage(id, { podcasts: [podcast], reviews: [review], manifest: { podcasts: [{ ...cover, appPodcastKey: "wrong id" }] }, approvals }), /cover with explicit rights/);
assert.throws(() => validateReviewLinkage(id, { podcasts: [podcast], reviews: [review], manifest: { podcasts: [{ ...cover, qualityCategory: "C" }] }, approvals }), /cover with explicit rights/);
assert.throws(() => validateReviewLinkage(id, { podcasts: [podcast], reviews: [review], manifest, approvals: { approvals: [] } }), /cover with explicit rights/);
assert.throws(() => validateReviewLinkage(id, { podcasts: [podcast], reviews: [review], manifest, approvals: { approvals: [{ ...approvals.approvals[0], coverChecksum: "old-checksum" }] } }), /cover with explicit rights/);
assert.throws(() => selectPodcast({ podcasts: [podcast], reviews: [review], manifest, approvals, usedPodcastIds: [id] }), /No podcast/);
assert.throws(() => selectPodcast({ podcasts: [podcast], reviews: [review], manifest, approvals: { approvals: [] } }), /No podcast/);

let mutations = 0;
const actionSelected = { ...selected, caption: buildCaption(selected) };
const actionHistory = { posts: [], usedPodcastIds: new Set(), persist: async () => {} };
const fakeGraphql = async (query) => {
  if (query.includes("mutation")) mutations += 1;
  return { createPost: { __typename: "PostActionSuccess", post: { id: "post-1", text: actionSelected.caption, status: "draft", assets: [{ id: "asset-1", mimeType: "image/webp" }] } } };
};
const imageVerified = async () => {};
const dryRunResult = await performInstagramAction({ mode: "dry-run", channel, selected: actionSelected, graphql: fakeGraphql, verifyImage: imageVerified, history: actionHistory, logger: { log() {} } });
assert.equal(dryRunResult.wrote, false);
assert.equal(mutations, 0, "dry-run must not submit a Buffer mutation");
await assert.rejects(performInstagramAction({ mode: "queue", channel, selected: actionSelected, graphql: fakeGraphql, verifyImage: imageVerified, history: actionHistory }), /Queue mode is locked/);
assert.equal(mutations, 0, "queue stays blocked without explicit owner gates");
let draftInput;
const draftClient = async (_query, variables) => {
  draftInput = variables.input;
  return { createPost: { __typename: "PostActionSuccess", post: { id: "post-1", text: draftInput.text, status: "draft", assets: [{ id: "asset-1", mimeType: "image/webp" }] } } };
};
const draftResult = await performInstagramAction({ mode: "draft", channel, selected: actionSelected, graphql: draftClient, verifyImage: imageVerified, history: actionHistory, logger: { log() {} } });
assert.equal(draftResult.output.status, "draft");
assert.equal(draftInput.saveToDraft, true);
assert.equal(draftInput.dueAt, undefined);
assert.deepEqual(draftInput.assets, [{ image: { url: selected.cover.url } }]);
assert.ok(actionHistory.usedPodcastIds.has(id));
await assert.rejects(performInstagramAction({ mode: "draft", channel, selected: actionSelected, graphql: draftClient, verifyImage: imageVerified, history: { ...actionHistory, posts: [{ id: "old", text: actionSelected.canonicalUrl }] }, logger: { log() {} } }), /Duplicate Buffer post/);
await assert.rejects(performInstagramAction({ mode: "draft", channel, selected: actionSelected, graphql: async () => { throw new Error("must not write"); }, verifyImage: async () => { throw new Error("image unavailable"); }, history: actionHistory, logger: { log() {} } }), /image unavailable/);
let queueInput;
const queueClient = async (_query, variables) => { queueInput = variables.input; return { createPost: { __typename: "PostActionSuccess", post: { id: "scheduled-1", status: "scheduled" } } }; };
await performInstagramAction({ mode: "queue", queueEnabled: true, queueAcknowledgement: QUEUE_ACKNOWLEDGEMENT, channel, selected: actionSelected, graphql: queueClient, verifyImage: imageVerified, history: { posts: [], usedPodcastIds: new Set(), persist: async () => {} }, logger: { log() {} } });
assert.equal(queueInput.saveToDraft, undefined, "only explicit queue mode omits saveToDraft");
for (const [response, code] of [
  [{ ok: false, status: 500 }, "http_error"], [{ ok: false, status: 401 }, "unauthorized"], [{ ok: false, status: 403 }, "forbidden"],
  [{ ok: true, status: 200, json: async () => ({ errors: [{ message: "denied" }] }) }, "graphql_error"],
  [{ ok: true, status: 200, json: async () => ({ data: { createPost: { __typename: "MutationError", message: "not allowed" } } }) }, "mutation_error"],
]) {
  const client = createBufferClient({ token: "test", fetchImpl: async () => response });
  if (code === "mutation_error") await assert.rejects(async () => assertMutationSuccess(await client("mutation { createPost }"), "createPost"), (error) => error instanceof BufferApiError && error.code === code);
  else await assert.rejects(client("query { ping }"), (error) => error instanceof BufferApiError && error.code === code);
}
assert.throws(() => createBufferClient({}), /BUFFER_API_KEY/);
assert.equal(assertMutationSuccess({ createPost: { __typename: "PostActionSuccess", post: { id: "x", status: "draft" } } }, "createPost").id, "x");
console.log("Instagram selector and Buffer API tests passed");
