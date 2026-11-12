import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { resolveInstagramChannel } from "./instagram-selector.mjs";
import { assertMutationSuccess } from "./buffer-graphql.mjs";
import { slugFromPodcastId } from "./generate-seo-podcast-pages.mjs";

export const SMOKE_PODCAST_ID = "kvinden med den tunge kuffert";
export const SMOKE_TITLE = "Kvinden med den tunge kuffert";
export const SMOKE_PUBLISHER = "Third Ear / Politiken";
export const SMOKE_SCORE = "9,1";
export const SMOKE_MARKER = "PL91_INSTAGRAM_SMOKE_KVINDE_TUNGE_KUFFERT_V1";
export const SMOKE_ASSET_PATH = "assets/instagram/smoke-test.png";
export const SMOKE_CHANNEL_HANDLE = "podcastlisten.dk";
export const SMOKE_RAW_BASE = "https://raw.githubusercontent.com/vm2026-manager/podcast-ratings/";
export const SMOKE_MODE = "smoke-draft";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const normalizedText = (bytes) => Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");

export const smokeQueries = Object.freeze({
  organizations: `query InstagramSmokeOrganizations { account { organizations { id name } } }`,
  channels: `query InstagramSmokeChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName externalLink service organizationId allowedActions isDisconnected isLocked } }`,
  posts: `query InstagramSmokePosts($organizationId: OrganizationId!, $channelId: ChannelId!, $after: String) { posts(first: 100, after: $after, input: { organizationId: $organizationId, filter: { channelIds: [$channelId], status: [draft, scheduled, sent, sending, error, needs_approval] } }) { edges { node { id text status channelId dueAt assets { id mimeType } } } pageInfo { hasNextPage endCursor } } }`,
  createDraft: `mutation CreateInstagramSmokeDraft($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { __typename post { id text status channelId dueAt assets { id mimeType } } } ... on MutationError { __typename message } } }`,
});

export function validateSmokePodcast(rows) {
  const matches = (rows ?? []).filter((row) => row?.["Podcast-ID"] === SMOKE_PODCAST_ID);
  if (matches.length !== 1) throw new Error(`Expected exactly one catalogue row for Podcast-ID ${SMOKE_PODCAST_ID}; found ${matches.length}`);
  const row = matches[0];
  if (row.Titel !== SMOKE_TITLE || row.Udgiver !== SMOKE_PUBLISHER || row["Vuring (1-10)"] !== SMOKE_SCORE) {
    throw new Error("Smoke podcast title, publisher, or editorial catalogue score no longer matches its verified identity");
  }
  const slug = slugFromPodcastId(SMOKE_PODCAST_ID);
  if (slug !== "kvinden-med-den-tunge-kuffert") throw new Error("Smoke podcast canonical slug changed unexpectedly");
  return Object.freeze({ id: SMOKE_PODCAST_ID, title: SMOKE_TITLE, publisher: SMOKE_PUBLISHER,
    score: SMOKE_SCORE, canonicalUrl: `https://podcastlisten.dk/podcast/${slug}/` });
}

export function buildSmokeCaption(podcast) {
  if (podcast?.id !== SMOKE_PODCAST_ID || podcast.title !== SMOKE_TITLE || podcast.publisher !== SMOKE_PUBLISHER || podcast.score !== SMOKE_SCORE ||
      podcast.canonicalUrl !== "https://podcastlisten.dk/podcast/kvinden-med-den-tunge-kuffert/") {
    throw new Error("Smoke caption requires the exact validated podcast identity");
  }
  return [
    "TEKNISK TEST – IKKE TIL PUBLICERING",
    "Dette er en privat, faktuel forbindelsestest af Podcastlistens Buffer-integration.",
    `Podcast: ${podcast.title}`,
    `Podcast-ID: ${podcast.id}`,
    `Udgiver: ${podcast.publisher}`,
    `Podcastlistens redaktionelle katalogscore: ${podcast.score}/10`,
    `Læs mere: ${podcast.canonicalUrl}`,
    `Testmarkør: ${SMOKE_MARKER}`,
  ].join("\n\n");
}

export function smokeRawUrl(commitSha) {
  if (!/^[a-f0-9]{40}$/i.test(commitSha ?? "")) throw new Error("A full GitHub commit SHA is required for the immutable smoke-test media URL");
  return `${SMOKE_RAW_BASE}${commitSha}/${SMOKE_ASSET_PATH}`;
}

export async function verifySmokeMedia({ root, commitSha, manifest, fetchImpl = fetch, urlOverride } = {}) {
  const expectedUrl = smokeRawUrl(commitSha);
  const url = urlOverride ?? expectedUrl;
  if (url !== expectedUrl) throw new Error("Smoke-test media URL must be the commit-SHA-locked GitHub raw URL");
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "raw.githubusercontent.com") throw new Error("Smoke-test image URL must be public HTTPS on raw.githubusercontent.com");
  if (!manifest || manifest.schemaVersion !== 1 || manifest.sourceKind !== "original_podcastlisten_test_graphic" ||
      manifest.thirdPartyMaterials !== false || manifest.origin !== "Podcastlisten-owned text, geometric shapes, and palette from style.css" ||
      manifest.width !== 1080 || manifest.height !== 1080 || manifest.format !== "PNG" || manifest.contentType !== "image/png") {
    throw new Error("Smoke-test image source, ownership, or dimensions are not approved");
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.sha256 ?? "") || !Number.isInteger(manifest.bytes) || manifest.bytes < 1024 || manifest.bytes > 5 * 1024 * 1024) {
    throw new Error("Smoke-test image checksum or byte size is missing or invalid");
  }
  const generatorPath = path.join(root, "scripts", "generate-instagram-smoke-test.py");
  const stylePath = path.join(root, "style.css");
  const [generator, style, bytes, fileStat] = await Promise.all([
    readFile(generatorPath), readFile(stylePath), readFile(path.join(root, SMOKE_ASSET_PATH)), stat(path.join(root, SMOKE_ASSET_PATH)),
  ]);
  const normalizedGenerator = normalizedText(generator);
  const normalizedStyle = normalizedText(style);
  if (sha256(normalizedGenerator) !== manifest.generatorSha256 ||
      sha256(Buffer.concat([normalizedGenerator, normalizedStyle])) !== manifest.sourceSha256) {
    throw new Error("Smoke-test image source checksums do not match the generator and site palette");
  }
  if (bytes.length !== manifest.bytes || fileStat.size !== manifest.bytes || sha256(bytes) !== manifest.sha256 ||
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.readUInt32BE(16) !== 1080 || bytes.readUInt32BE(20) !== 1080) {
    throw new Error("Local smoke-test image bytes, checksum, or PNG dimensions do not match the manifest");
  }
  const response = await fetchImpl(url, { method: "GET", redirect: "error" });
  if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/png") {
    throw new Error(`Public smoke-test image is unavailable or has the wrong MIME type (${response.status})`);
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) !== manifest.bytes) throw new Error("Public smoke-test image byte length differs from the manifest");
  if (!response.body) throw new Error("Public smoke-test image has no response body");
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > manifest.bytes) {
      await reader.cancel();
      throw new Error("Public smoke-test image exceeds the manifest byte length");
    }
    chunks.push(Buffer.from(value));
  }
  const publicBytes = Buffer.concat(chunks, totalBytes);
  if (publicBytes.length !== manifest.bytes || sha256(publicBytes) !== manifest.sha256) {
    throw new Error("Public GitHub raw image does not match the committed checksum");
  }
  return Object.freeze({ url, sha256: manifest.sha256, bytes: manifest.bytes, width: 1080, height: 1080, contentType: "image/png" });
}

export async function allSmokeChannelPosts(graphql, organizationId, channelId) {
  const posts = [];
  let after;
  do {
    const data = await graphql(smokeQueries.posts, { organizationId, channelId, ...(after ? { after } : {}) });
    const result = data?.posts;
    if (!result || !Array.isArray(result.edges) || !result.pageInfo) throw new Error("Buffer returned an invalid smoke-test post list");
    posts.push(...result.edges.map((edge) => edge.node).filter(Boolean));
    if (!result.pageInfo.hasNextPage) break;
    if (!result.pageInfo.endCursor || result.pageInfo.endCursor === after) throw new Error("Buffer smoke-test post pagination did not advance");
    after = result.pageInfo.endCursor;
  } while (true);
  return posts;
}

function markedPosts(posts) {
  return (posts ?? []).filter((post) => post.text?.includes(SMOKE_MARKER));
}

function verifyExistingDraft(posts, channelId) {
  const matches = markedPosts(posts);
  if (matches.length > 1) throw new Error(`More than one Buffer post has smoke marker ${SMOKE_MARKER}; no mutation attempted`);
  if (!matches.length) return null;
  const post = matches[0];
  if (!post.id) throw new Error("Existing smoke marker has no Buffer post ID; refusing to retry");
  if (post.channelId !== channelId) throw new Error("Existing smoke marker is attached to an unexpected Buffer channel");
  if (post.status !== "draft") throw new Error(`Smoke marker already exists with status ${post.status}; refusing to create or retry`);
  if (post.dueAt) throw new Error("Existing smoke draft has a dueAt value; refusing to create or retry");
  return Object.freeze({ created: false, postId: post.id, status: post.status, dueAt: null });
}

export function buildSmokeDraftInput({ channelId, caption, media } = {}) {
  if (!channelId) throw new Error("A uniquely verified Instagram channel ID is required");
  if (!media?.url || !/^[a-f0-9]{64}$/i.test(media.sha256 ?? "") || media.contentType !== "image/png" || media.width !== 1080 || media.height !== 1080) {
    throw new Error("A checksummed, verified 1080x1080 PNG image is required for the smoke draft");
  }
  if (typeof caption !== "string" || !caption.startsWith("TEKNISK TEST – IKKE TIL PUBLICERING") || !caption.includes(SMOKE_MARKER)) {
    throw new Error("Smoke draft must use the exact test-only caption and stable deduplication marker");
  }
  return Object.freeze({
    text: caption,
    channelId,
    schedulingType: "automatic",
    mode: "addToQueue", // Buffer requires ShareMode; saveToDraft below guarantees the post remains a draft.
    saveToDraft: true,
    assets: [{ image: { url: media.url } }],
    metadata: { instagram: { type: "post", shouldShareToFeed: true } },
  });
}

export async function runSmokeDraft({ mode = SMOKE_MODE, root, commitSha, graphql, fetchImpl = fetch, logger = console } = {}) {
  if (mode !== SMOKE_MODE) throw new Error("Only isolated smoke-draft mode is supported; queue and publication are unavailable");
  if (typeof graphql !== "function") throw new Error("Buffer GraphQL client is required");
  const catalog = JSON.parse(await readFile(path.join(root, "data", "podcasts.json"), "utf8"));
  const podcast = validateSmokePodcast(catalog.rows);
  const manifest = JSON.parse(await readFile(path.join(root, "assets", "instagram", "smoke-test-manifest.json"), "utf8"));
  const media = await verifySmokeMedia({ root, commitSha, manifest, fetchImpl });

  const orgData = await graphql(smokeQueries.organizations);
  const organizations = orgData?.account?.organizations;
  if (!Array.isArray(organizations) || organizations.length === 0) throw new Error("Buffer returned no readable organizations");
  const channelsByOrganization = new Map();
  for (const organization of organizations) {
    const channelData = await graphql(smokeQueries.channels, { organizationId: organization.id });
    if (!Array.isArray(channelData?.channels)) throw new Error("Buffer returned an invalid channel list");
    channelsByOrganization.set(organization.id, channelData.channels);
  }
  const channel = resolveInstagramChannel(organizations, channelsByOrganization);
  if (channel.service !== "instagram" || textHandle(channel) !== SMOKE_CHANNEL_HANDLE) {
    throw new Error("Resolved Buffer channel is not the exact @podcastlisten.dk Instagram account");
  }
  const existing = await allSmokeChannelPosts(graphql, channel.organizationId, channel.id);
  const duplicate = verifyExistingDraft(existing, channel.id);
  if (duplicate) {
    logger.log(JSON.stringify({ ...duplicate, marker: SMOKE_MARKER, channel: "@podcastlisten.dk" }));
    return duplicate;
  }

  const input = buildSmokeDraftInput({ channelId: channel.id, caption: buildSmokeCaption(podcast), media });
  const mutationData = await graphql(smokeQueries.createDraft, { input });
  const created = assertMutationSuccess(mutationData, "createPost");
  if (created.channelId !== channel.id || created.status !== "draft" || created.dueAt != null) {
    throw new Error(`Buffer returned unexpected smoke post state for ${created.id}; status=${created.status}; dueAt=${created.dueAt ?? "null"}. Do not retry.`);
  }
  const assets = created.assets ?? [];
  if (assets.length !== 1 || assets[0].mimeType !== "image/png") {
    throw new Error(`Buffer returned unexpected smoke-test media for ${created.id}; do not retry.`);
  }

  const after = await allSmokeChannelPosts(graphql, channel.organizationId, channel.id);
  const afterMatches = markedPosts(after);
  if (afterMatches.length !== 1) throw new Error(`Buffer read-back found ${afterMatches.length} posts for the unique smoke marker; do not retry.`);
  const saved = afterMatches[0];
  if (saved.id !== created.id || saved.channelId !== channel.id || saved.status !== "draft" || saved.dueAt != null ||
      ["scheduled", "sending", "sent"].includes(saved.status) || (saved.assets ?? []).length !== 1 || saved.assets[0].mimeType !== "image/png") {
    throw new Error(`Buffer read-back could not verify a private, unscheduled draft for ${created.id}; do not retry.`);
  }
  const result = Object.freeze({ created: true, postId: saved.id, status: saved.status, dueAt: null,
    channel: "@podcastlisten.dk", podcastId: podcast.id, mediaUrl: media.url, mediaSha256: media.sha256,
    marker: SMOKE_MARKER, published: false });
  logger.log(JSON.stringify(result, null, 2));
  return result;
}

function textHandle(channel) {
  const name = String(channel?.name ?? "").replace(/^@/, "").toLowerCase();
  let linked = "";
  let host = "";
  let protocol = "";
  try {
    const url = new URL(channel?.externalLink);
    linked = url.pathname.split("/").filter(Boolean).join("/").toLowerCase();
    host = url.hostname.toLowerCase();
    protocol = url.protocol;
  } catch {}
  return name === SMOKE_CHANNEL_HANDLE && protocol === "https:" && ["instagram.com", "www.instagram.com"].includes(host) && linked === SMOKE_CHANNEL_HANDLE ? name : "";
}
