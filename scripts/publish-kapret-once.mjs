import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BUFFER_ENDPOINT = "https://api.buffer.com";
export const CHANNEL_HANDLE = "podcastlisten.dk";
export const LOCKED_COMMIT = "11cfdaa2f40045ecf84595d0ec99e61de0081245";
export const IMAGE_URL = `https://raw.githubusercontent.com/vm2026-manager/podcast-ratings/${LOCKED_COMMIT}/assets/instagram/kapret-9639db3c03-8-9-2x.png`;
export const IMAGE_SHA256 = "200e7e9b7ce304e14f87db0fdb961748376a6edaa83ed3696e82ade218c44088";
export const IMAGE_GIT_BLOB_SHA = "11863d932b11437e26162adac709c2f1ba243745";
export const APPROVED_CAPTION = `KAPRET – EN OVERSET PERLE FRA 2021

Februar 2011. Marie har ikke hørt fra sin kæreste Rane, som sejler mod Adenbugten. Hans båd bliver kapret af somaliske pirater, og et dramatisk gidseldrama begynder.

Gennem seks afsnit fortæller Rane og Marie selv historien om kapringen og den frygtelige tid, der fulgte.

Podcastlistens vurdering: 8,9/10

Kapret er efter min mening blandt de allerbedste podcasts, jeg har hørt. En klart overset perle fra 2021, som alle bør høre.

Udgiver: DR
6 afsnit · Dokumentar · True Crime

Hør hele serien hos DR Lyd – søg efter Kapret.

#Kapret #DRLyd #DR #Podcastlisten #Podcastanbefaling #DanskePodcasts #Dokumentar #TrueCrime`;

const STATUS_VALUES = "[draft, needs_approval, scheduled, sending, sent, error]";
const ACKNOWLEDGEMENT = "I_APPROVE_ONE_KAPRET_SHARE_NOW";
const sleepDefault = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const GRAPHQL = Object.freeze({
  organizations: `query KapretOrganizations { account { organizations { id name } } }`,
  channels: `query KapretChannels($organizationId: OrganizationId!) {
    channels(input: { organizationId: $organizationId }) {
      id name displayName externalLink service organizationId isDisconnected isLocked
    }
  }`,
  posts: `query KapretPosts($organizationId: OrganizationId!, $channelId: ChannelId!, $after: String) {
    posts(first: 100, after: $after, input: {
      organizationId: $organizationId,
      filter: { channelIds: [$channelId], status: ${STATUS_VALUES} }
    }) {
      edges { node {
        id text status channelId createdAt sentAt externalLink shareMode schedulingType sharedNow
        assets { id mimeType source type ... on ImageAsset { image { width height } } }
      } }
      pageInfo { hasNextPage endCursor }
    }
  }`,
  createPost: `mutation PublishKapretOnce($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { __typename post {
        id text status channelId createdAt sentAt externalLink shareMode schedulingType sharedNow
        assets { id mimeType source type ... on ImageAsset { image { width height } } }
      } }
      ... on MutationError { __typename message }
    }
  }`,
});

function fail(message) {
  throw new Error(message);
}

export function isKapretDuplicate(post) {
  const text = typeof post?.text === "string" ? post.text : "";
  if (/kapret/iu.test(text)) return true;
  if (/https?:\/\/(?:www\.)?podcastlisten\.dk\/podcast\/kapret(?:\/|\b)/iu.test(text)) return true;
  return (Array.isArray(post?.assets) ? post.assets : []).some((asset) => {
    const source = typeof asset?.source === "string" ? asset.source : "";
    return source === IMAGE_URL || /kapret-9639db3c03-8-9(?:-2x)?\.png/iu.test(source);
  });
}

function instagramHandle(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    if (!["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase())) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 1 ? parts[0].replace(/^@/u, "").toLowerCase() : "";
  } catch {
    return value.replace(/^@/u, "").replace(/\/$/u, "").toLowerCase();
  }
}

export function resolveExactChannel(organizations, channelsByOrganization) {
  const matches = [];
  for (const organization of organizations ?? []) {
    const channels = channelsByOrganization.get(organization.id);
    if (!Array.isArray(channels)) fail(`Buffer channel response invalid for organization ${organization.id}`);
    for (const channel of channels) {
      const nameHandle = typeof channel.name === "string" ? channel.name.replace(/^@/u, "").toLowerCase() : "";
      if (channel.service === "instagram" && nameHandle === CHANNEL_HANDLE && channel.organizationId !== organization.id) {
        fail("Instagram channel organization identity mismatch");
      }
      if (channel.service === "instagram" && nameHandle === CHANNEL_HANDLE &&
          instagramHandle(channel.externalLink) === CHANNEL_HANDLE) {
        matches.push({ ...channel, organizationName: organization.name });
      }
    }
  }
  if (matches.length !== 1) fail(`Expected exactly one Instagram channel @${CHANNEL_HANDLE}; found ${matches.length}`);
  const channel = matches[0];
  if (!channel.id || channel.isDisconnected || channel.isLocked) fail("Exact Instagram channel is missing, disconnected, or locked");
  return channel;
}

function sha1GitBlob(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

export async function verifyApprovedImage({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(IMAGE_URL, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) fail(`Approved image is not publicly reachable (HTTP ${response.status})`);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
  if (contentType !== "image/png") fail(`Approved image has unexpected Content-Type ${contentType || "(missing)"}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") fail("Approved asset is not a PNG");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 2508 || height !== 2508) fail(`Approved PNG dimensions are ${width}x${height}, expected 2508x2508`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== IMAGE_SHA256) fail(`Approved PNG checksum mismatch: ${sha256}`);
  const gitBlobSha = sha1GitBlob(bytes);
  if (gitBlobSha !== IMAGE_GIT_BLOB_SHA) fail(`Approved PNG Git blob mismatch: ${gitBlobSha}`);
  return { url: IMAGE_URL, bytes: bytes.length, width, height, sha256, gitBlobSha };
}

export async function createBufferGraphql({ token, fetchImpl = fetch, endpoint = BUFFER_ENDPOINT }) {
  if (!token) fail("BUFFER_API_KEY is missing");
  return async (query, variables = {}) => {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new Error(`Buffer request failed (${error.message}); do not retry any publish action without checking Buffer`, { cause: error });
    }
    if (response.status === 429) {
      const wait = response.headers.get("retry-after");
      fail(`Buffer rate limit reached${wait ? `; Retry-After ${wait}` : ""}; stop without retrying`);
    }
    if (!response.ok) fail(`Buffer HTTP ${response.status}`);
    const payload = await response.json();
    if (Array.isArray(payload?.errors) && payload.errors.length) {
      fail(`Buffer GraphQL error: ${payload.errors.map((item) => item?.message || "unknown").join("; ")}`);
    }
    if (!payload || !Object.hasOwn(payload, "data")) fail("Buffer response is missing data");
    return payload.data;
  };
}

async function findChannel(graphql) {
  const organizations = (await graphql(GRAPHQL.organizations)).account?.organizations;
  if (!Array.isArray(organizations) || organizations.length === 0) fail("No accessible Buffer organization");
  const channelsByOrganization = new Map();
  for (const organization of organizations) {
    const result = await graphql(GRAPHQL.channels, { organizationId: organization.id });
    channelsByOrganization.set(organization.id, result.channels);
  }
  return resolveExactChannel(organizations, channelsByOrganization);
}

export async function listAllChannelPosts(graphql, channel) {
  const output = [];
  let after;
  for (let page = 0; page < 100; page += 1) {
    const result = await graphql(GRAPHQL.posts, {
      organizationId: channel.organizationId,
      channelId: channel.id,
      ...(after ? { after } : {}),
    });
    const connection = result.posts;
    if (!connection || !Array.isArray(connection.edges) || !connection.pageInfo) fail("Buffer post history response is invalid");
    for (const edge of connection.edges) {
      if (!edge?.node?.id || edge.node.channelId !== channel.id) fail("Buffer returned a malformed or cross-channel post; stop");
      output.push(edge.node);
    }
    if (!connection.pageInfo.hasNextPage) return output;
    if (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after) fail("Buffer post pagination did not advance");
    after = connection.pageInfo.endCursor;
  }
  fail("Buffer post history exceeded 100 pages; refusing to assume the channel is duplicate-free");
}

export async function preflight({ token, fetchImpl = fetch, endpoint = BUFFER_ENDPOINT }) {
  const graphql = await createBufferGraphql({ token, fetchImpl, endpoint });
  const channel = await findChannel(graphql);
  const history = await listAllChannelPosts(graphql, channel);
  const matches = history.filter(isKapretDuplicate);
  if (matches.length) {
    const summary = matches.map(({ id, status, createdAt, sentAt, externalLink }) => ({ id, status, createdAt, sentAt, externalLink }));
    fail(`Kapret duplicate(s) exist in Buffer; no post created. Inspect these records before proceeding: ${JSON.stringify(summary)}`);
  }
  const image = await verifyApprovedImage({ fetchImpl });
  return {
    channel: { id: channel.id, name: channel.name, externalLink: channel.externalLink, organizationId: channel.organizationId },
    historyCount: history.length,
    kapretDuplicates: 0,
    image,
    caption: APPROVED_CAPTION,
  };
}

function verifyReturnedPost(post, channel) {
  if (!post?.id) fail("Buffer did not return a post ID; mutation outcome is uncertain. Inspect Buffer; never retry blindly.");
  if (post.channelId !== channel.id) fail(`Buffer returned post ${post.id} on an unexpected channel; inspect it and do not retry`);
  if (post.text !== APPROVED_CAPTION) fail(`Buffer returned post ${post.id} with a caption mismatch; inspect it and do not retry`);
  if (post.shareMode !== "shareNow" || post.schedulingType !== "automatic" || post.sharedNow !== true) {
    fail(`Buffer returned post ${post.id} without verified automatic shareNow semantics; inspect it and do not retry`);
  }
  if (!Array.isArray(post.assets) || post.assets.length !== 1) fail(`Buffer post ${post.id} does not have exactly one image asset; inspect it and do not retry`);
  const asset = post.assets[0];
  if (asset.mimeType !== "image/png" || asset.source !== IMAGE_URL || asset.image?.width !== 2508 || asset.image?.height !== 2508) {
    fail(`Buffer post ${post.id} image does not match the locked 2508x2508 PNG; inspect it and do not retry`);
  }
  if (!["sending", "sent"].includes(post.status)) fail(`Buffer post ${post.id} has status ${post.status}; it is not confirmed sent. Do not retry.`);
  return post;
}

function isInstagramPermalink(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return ["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase()) &&
      /^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/u.test(url.pathname);
  } catch {
    return false;
  }
}

export async function runKapretOnce({
  action = "dry-run",
  acknowledgement = "",
  token,
  fetchImpl = fetch,
  endpoint = BUFFER_ENDPOINT,
  sleepImpl = sleepDefault,
  pollAttempts = 12,
  pollIntervalMs = 10_000,
} = {}) {
  if (!["dry-run", "preflight", "publish"].includes(action)) fail(`Unsupported action: ${action}`);
  if (!token) fail("BUFFER_API_KEY is missing");
  if (action === "publish" && acknowledgement !== ACKNOWLEDGEMENT) fail("Missing exact publish acknowledgement");

  const before = await preflight({ token, fetchImpl, endpoint });
  if (action !== "publish") return { action, ...before };

  const graphql = await createBufferGraphql({ token, fetchImpl, endpoint });
  const channel = await findChannel(graphql);
  const createResult = await graphql(GRAPHQL.createPost, {
    input: {
      text: APPROVED_CAPTION,
      channelId: channel.id,
      schedulingType: "automatic",
      mode: "shareNow",
      saveToDraft: false,
      needsApproval: false,
      assets: [{ image: { url: IMAGE_URL } }],
    },
  });
  const payload = createResult.createPost;
  if (payload?.__typename !== "PostActionSuccess") {
    fail(`Buffer createPost failed or returned an unknown result (${JSON.stringify(payload)}); inspect Buffer; never retry blindly`);
  }
  let post;
  try {
    post = verifyReturnedPost(payload.post, channel);
  } catch (error) {
    fail(`${error.message}; Buffer mutation already ran once, never retry`);
  }

  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    if (attempt > 0) await sleepImpl(pollIntervalMs);
    const current = await listAllChannelPosts(graphql, channel);
    const published = current.find((item) => item.id === post.id);
    if (!published) continue;
    verifyReturnedPost(published, channel);
    if (published.status === "sent") {
      if (!published.sentAt || !isInstagramPermalink(published.externalLink)) {
        fail(`Buffer says ${published.id} is sent but lacks a verified timestamp or Instagram permalink; inspect it and do not retry`);
      }
      return {
        action,
        postId: published.id,
        channel: before.channel,
        status: published.status,
        sentAt: published.sentAt,
        externalLink: published.externalLink,
        text: published.text,
        assets: published.assets,
        shareMode: published.shareMode,
        schedulingType: published.schedulingType,
        sharedNow: published.sharedNow,
      };
    }
    if (published.status !== "sending") fail(`Buffer post ${post.id} is ${published.status}, not sent; inspect it and never retry`);
  }
  fail(`Buffer post ${post.id} remains sending or unobservable; do not create another post. Inspect this ID in Buffer.`);
}

const directPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (directPath === fileURLToPath(import.meta.url)) {
  const action = process.env.KAPRET_PUBLISH_ACTION || "dry-run";
  runKapretOnce({
    action,
    acknowledgement: process.env.KAPRET_PUBLISH_ACK,
    token: process.env.BUFFER_API_KEY,
  }).then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(error.stack || String(error));
    process.exitCode = 1;
  });
}
