import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBufferClient, BufferApiError } from "./buffer-graphql.mjs";
import { resolveInstagramChannel } from "./instagram-selector.mjs";
import {
  SMOKE_MARKER, SMOKE_MODE, SMOKE_PODCAST_ID, SMOKE_TITLE, SMOKE_PUBLISHER, SMOKE_SCORE,
  buildSmokeCaption, buildSmokeDraftInput, runSmokeDraft, smokeQueries, smokeRawUrl,
  validateSmokePodcast, verifySmokeMedia,
} from "./instagram-smoke-draft.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(path.join(root, "data", "podcasts.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "assets", "instagram", "smoke-test-manifest.json"), "utf8"));
const imageBytes = await readFile(path.join(root, "assets", "instagram", "smoke-test.png"));
const commitSha = "a".repeat(40);
const mediaUrl = smokeRawUrl(commitSha);
const podcast = validateSmokePodcast(catalog.rows);
const caption = buildSmokeCaption(podcast);
const expectedChannel = { id: "instagram-channel-1", organizationId: "organization-1", name: "podcastlisten.dk", displayName: "@podcastlisten.dk", externalLink: "https://www.instagram.com/podcastlisten.dk/", service: "instagram", allowedActions: ["createPost"], isDisconnected: false, isLocked: false };
const organization = { id: "organization-1", name: "Podcastlisten" };
const logger = { log() {} };
const fetchImage = async (url, options) => {
  assert.equal(String(url), mediaUrl);
  assert.deepEqual(options, { method: "GET", redirect: "error" });
  return new Response(imageBytes, { status: 200, headers: { "content-type": "image/png", "content-length": String(imageBytes.length) } });
};

assert.equal(podcast.id, SMOKE_PODCAST_ID);
assert.equal(podcast.title, SMOKE_TITLE);
assert.equal(podcast.publisher, SMOKE_PUBLISHER);
assert.equal(podcast.score, SMOKE_SCORE);
assert.equal(podcast.canonicalUrl, "https://podcastlisten.dk/podcast/kvinden-med-den-tunge-kuffert/");
assert.throws(() => validateSmokePodcast([...catalog.rows, catalog.rows.find((row) => row["Podcast-ID"] === SMOKE_PODCAST_ID)]), /found 2/);
assert.throws(() => validateSmokePodcast(catalog.rows.map((row) => row["Podcast-ID"] === SMOKE_PODCAST_ID ? { ...row, Udgiver: "Other" } : row)), /title, publisher, or editorial/);
assert.throws(() => validateSmokePodcast(catalog.rows.map((row) => row["Podcast-ID"] === SMOKE_PODCAST_ID ? { ...row, "Vuring (1-10)": "9,0" } : row)), /title, publisher, or editorial/);
assert.match(caption, /^TEKNISK TEST – IKKE TIL PUBLICERING/u);
assert.ok(caption.includes(`Podcast-ID: ${SMOKE_PODCAST_ID}`));
assert.ok(caption.includes(`Udgiver: ${SMOKE_PUBLISHER}`));
assert.ok(caption.includes("9,1/10"));
assert.ok(caption.includes(podcast.canonicalUrl));
assert.ok(caption.includes(SMOKE_MARKER));
assert.ok(!/\b(jeg|min anmeldelse|jeg anbefaler)\b/iu.test(caption));

const verifiedMedia = await verifySmokeMedia({ root, commitSha, manifest, fetchImpl: fetchImage });
assert.equal(verifiedMedia.url, mediaUrl);
assert.equal(verifiedMedia.sha256, manifest.sha256);
assert.equal(verifiedMedia.bytes, 584448);
assert.throws(() => smokeRawUrl("short"), /full GitHub commit SHA/);
await assert.rejects(verifySmokeMedia({ root, commitSha, manifest: { ...manifest, sha256: "" }, fetchImpl: fetchImage }), /checksum or byte size/);
await assert.rejects(verifySmokeMedia({ root, commitSha, manifest, urlOverride: "http://example.com/test.png", fetchImpl: fetchImage }), /commit-SHA-locked/);
await assert.rejects(verifySmokeMedia({ root, commitSha, manifest, fetchImpl: async () => new Response("missing", { status: 404, headers: { "content-type": "text/plain" } }) }), /unavailable or has the wrong MIME/);
await assert.rejects(verifySmokeMedia({ root, commitSha, manifest, fetchImpl: async () => new Response(imageBytes, { status: 200, headers: { "content-type": "image/jpeg" } }) }), /unavailable or has the wrong MIME/);
await assert.rejects(verifySmokeMedia({ root, commitSha, manifest, fetchImpl: async () => new Response(Buffer.from("wrong"), { status: 200, headers: { "content-type": "image/png" } }) }), /does not match the committed checksum/);

const orgs = [organization];
const channelMap = new Map([[organization.id, [expectedChannel]]]);
assert.equal(resolveInstagramChannel(orgs, channelMap).id, expectedChannel.id);
assert.throws(() => resolveInstagramChannel(orgs, new Map([[organization.id, [{ ...expectedChannel, name: "other", externalLink: "https://instagram.com/other/" }]]])), /found 0/);
assert.throws(() => resolveInstagramChannel(orgs, new Map([[organization.id, [expectedChannel, { ...expectedChannel, id: "another" }]]])), /found 2/);
const wrongHostGraphql = async (query, variables) => {
  if (query === smokeQueries.organizations) return { account: { organizations: orgs } };
  if (query === smokeQueries.channels) return { channels: [{ ...expectedChannel, externalLink: "https://example.com/podcastlisten.dk/" }] };
  throw new Error("wrong Instagram host must stop before post read/write");
};
await assert.rejects(runSmokeDraft({ root, commitSha, graphql: wrongHostGraphql, fetchImpl: fetchImage, logger }), /not the exact @podcastlisten.dk/);

const input = buildSmokeDraftInput({ channelId: expectedChannel.id, caption, media: verifiedMedia });
assert.equal(input.saveToDraft, true);
assert.equal(input.mode, "addToQueue", "Buffer requires ShareMode; the saveToDraft flag must keep the post private");
assert.equal(Object.hasOwn(input, "dueAt"), false);
assert.equal(input.assets.length, 1);
assert.equal(input.assets[0].image.url, mediaUrl);
assert.deepEqual(input.metadata.instagram, { type: "post", shouldShareToFeed: true });
assert.throws(() => buildSmokeDraftInput({ channelId: expectedChannel.id, caption, media: { ...verifiedMedia, url: "" } }), /checksummed, verified/);
assert.throws(() => buildSmokeDraftInput({ channelId: expectedChannel.id, caption }), /checksummed, verified/);
assert.throws(() => buildSmokeDraftInput({ channelId: expectedChannel.id, caption, media: { ...verifiedMedia, sha256: "" } }), /checksummed, verified/);
assert.throws(() => buildSmokeDraftInput({ channelId: expectedChannel.id, caption: "Normal caption", media: verifiedMedia }), /test-only caption/);
await assert.rejects(runSmokeDraft({ mode: "queue", graphql: async () => { throw new Error("must not call Buffer"); } }), /Only isolated smoke-draft mode/);

let mutationCount = 0;
let postReads = 0;
let savedInput;
const createdPost = { id: "buffer-post-1", text: caption, status: "draft", channelId: expectedChannel.id, dueAt: null, assets: [{ id: "asset-1", mimeType: "image/png" }] };
const successGraphql = async (query, variables) => {
  if (query === smokeQueries.organizations) return { account: { organizations: orgs } };
  if (query === smokeQueries.channels) return { channels: channelMap.get(variables.organizationId) };
  if (query === smokeQueries.posts) {
    postReads += 1;
    return { posts: { edges: postReads === 1 ? [] : [{ node: createdPost }], pageInfo: { hasNextPage: false, endCursor: null } } };
  }
  if (query === smokeQueries.createDraft) {
    mutationCount += 1;
    savedInput = variables.input;
    return { createPost: { __typename: "PostActionSuccess", post: createdPost } };
  }
  throw new Error("unexpected GraphQL operation");
};
const result = await runSmokeDraft({ root, commitSha, graphql: successGraphql, fetchImpl: fetchImage, logger });
assert.equal(result.created, true);
assert.equal(result.postId, createdPost.id);
assert.equal(result.status, "draft");
assert.equal(result.dueAt, null);
assert.equal(mutationCount, 1);
assert.equal(savedInput.saveToDraft, true);
assert.equal(Object.hasOwn(savedInput, "dueAt"), false);
assert.equal(savedInput.channelId, expectedChannel.id);
assert.equal(savedInput.assets[0].image.url, mediaUrl);

let duplicateMutationCount = 0;
const duplicatePost = { ...createdPost, id: "buffer-existing-draft", text: `${caption}\n${SMOKE_MARKER}` };
const duplicateGraphql = async (query, variables) => {
  if (query === smokeQueries.organizations) return { account: { organizations: orgs } };
  if (query === smokeQueries.channels) return { channels: channelMap.get(variables.organizationId) };
  if (query === smokeQueries.posts) return { posts: { edges: [{ node: duplicatePost }], pageInfo: { hasNextPage: false, endCursor: null } } };
  if (query === smokeQueries.createDraft) duplicateMutationCount += 1;
  throw new Error("duplicate check must stop before mutation");
};
const duplicateResult = await runSmokeDraft({ root, commitSha, graphql: duplicateGraphql, fetchImpl: fetchImage, logger });
assert.equal(duplicateResult.created, false);
assert.equal(duplicateResult.postId, duplicatePost.id);
assert.equal(duplicateResult.status, "draft");
assert.equal(duplicateMutationCount, 0);

const wrongChannelGraphql = async (query, variables) => {
  if (query === smokeQueries.organizations) return { account: { organizations: orgs } };
  if (query === smokeQueries.channels) return { channels: [{ ...expectedChannel, name: "someone-else", externalLink: "https://instagram.com/someone-else/" }] };
  throw new Error("wrong channel must stop before post read/write");
};
await assert.rejects(runSmokeDraft({ root, commitSha, graphql: wrongChannelGraphql, fetchImpl: fetchImage, logger }), /found 0/);

let deniedMutationCount = 0;
const deniedGraphql = async (query, variables) => {
  if (query === smokeQueries.organizations) return { account: { organizations: orgs } };
  if (query === smokeQueries.channels) return { channels: channelMap.get(variables.organizationId) };
  if (query === smokeQueries.posts) return { posts: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } };
  if (query === smokeQueries.createDraft) {
    deniedMutationCount += 1;
    throw new BufferApiError("Buffer rejected the token or required permissions (HTTP 403)", { status: 403, code: "forbidden" });
  }
  throw new Error("unexpected GraphQL operation");
};
await assert.rejects(runSmokeDraft({ root, commitSha, graphql: deniedGraphql, fetchImpl: fetchImage, logger }), /HTTP 403/);
assert.equal(deniedMutationCount, 1, "permission failure is not retried");

let unexpectedMutationCount = 0;
const unexpectedGraphql = async (query, variables) => {
  if (query === smokeQueries.organizations) return { account: { organizations: orgs } };
  if (query === smokeQueries.channels) return { channels: channelMap.get(variables.organizationId) };
  if (query === smokeQueries.posts) return { posts: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } };
  if (query === smokeQueries.createDraft) {
    unexpectedMutationCount += 1;
    return { createPost: { __typename: "PostActionSuccess", post: { ...createdPost, status: "scheduled", dueAt: "2026-11-13T08:00:00Z" } } };
  }
  throw new Error("unexpected GraphQL operation");
};
await assert.rejects(runSmokeDraft({ root, commitSha, graphql: unexpectedGraphql, fetchImpl: fetchImage, logger }), /unexpected smoke post state/);
assert.equal(unexpectedMutationCount, 1, "unexpected post state is never retried");

let createCalls = 0;
const forbiddenApi = createBufferClient({ token: "not-a-real-token", fetchImpl: async () => new Response("", { status: 403 }) });
await assert.rejects(forbiddenApi("mutation { createPost { __typename } }"), (error) => error instanceof BufferApiError && error.code === "forbidden");
assert.equal(createCalls, 0);

console.log("Instagram isolated smoke-draft tests passed: exact identity, checksum, raw URL, channel, draft-only mutation, duplicate, API denial, and unexpected-status guards");
