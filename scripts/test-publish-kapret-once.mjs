import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPROVED_CAPTION,
  CHANNEL_HANDLE,
  GRAPHQL,
  IMAGE_URL,
  runKapretOnce,
} from "./publish-kapret-once.mjs";

const imageBytes = await readFile(new URL("../assets/instagram/kapret-9639db3c03-8-9-2x.png", import.meta.url));
const channel = {
  id: "6af5707262b70b94b00466d3",
  name: "@podcastlisten.dk",
  externalLink: "https://www.instagram.com/podcastlisten.dk/",
  service: "instagram",
  organizationId: "org-test",
  isDisconnected: false,
  isLocked: false,
};
const org = { id: "org-test", name: "Podcastlisten" };
const asset = {
  id: "asset-test",
  mimeType: "image/png",
  source: IMAGE_URL,
  type: "image",
  image: { width: 2508, height: 2508 },
};
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

function makeFetch({ existingPages = [], onCreate, createThrows = false } = {}) {
  const calls = { posts: 0, mutations: 0, postQueries: [] };
  const fetchImpl = async (url, init = {}) => {
    if (url === IMAGE_URL) {
      return new Response(imageBytes, { headers: { "content-type": "image/png" } });
    }
    const request = JSON.parse(init.body);
    const query = request.query;
    if (query === GRAPHQL.organizations) return response({ data: { account: { organizations: [org] } } });
    if (query === GRAPHQL.channels) return response({ data: { channels: [channel] } });
    if (query === GRAPHQL.posts) {
      calls.posts += 1;
      calls.postQueries.push(query);
      const pageIndex = Math.min(calls.posts - 1, existingPages.length - 1);
      const page = existingPages[pageIndex] ?? { nodes: [], hasNextPage: false, endCursor: null };
      return response({ data: { posts: {
        edges: page.nodes.map((node) => ({ node })),
        pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
      } } });
    }
    if (query === GRAPHQL.createPost) {
      calls.mutations += 1;
      calls.input = request.variables.input;
      if (createThrows) throw new Error("simulated socket timeout");
      return response({ data: { createPost: { __typename: "PostActionSuccess", post: onCreate(request.variables.input) } } });
    }
    throw new Error(`Unexpected request: ${query}`);
  };
  return { fetchImpl, calls };
}

test("dry-run checks every page/status, the exact channel and locked public image without mutation", async () => {
  const { fetchImpl, calls } = makeFetch({ existingPages: [
    { nodes: [{ id: "old-1", channelId: channel.id, status: "sent", text: "Andre opslag", assets: [] }], hasNextPage: true, endCursor: "next" },
    { nodes: [{ id: "old-2", channelId: channel.id, status: "draft", text: "Andet udkast", assets: [] }], hasNextPage: false, endCursor: null },
  ] });
  const result = await runKapretOnce({ action: "dry-run", token: "test-token", fetchImpl });
  assert.equal(result.action, "dry-run");
  assert.equal(result.channel.name, channel.name);
  assert.equal(result.channel.externalLink, channel.externalLink);
  assert.equal(result.historyCount, 2);
  assert.equal(result.kapretDuplicates, 0);
  assert.equal(result.image.url, IMAGE_URL);
  assert.equal(result.image.width, 2508);
  assert.equal(result.image.height, 2508);
  assert.equal(result.image.sha256, "200e7e9b7ce304e14f87db0fdb961748376a6edaa83ed3696e82ade218c44088");
  assert.equal(calls.mutations, 0);
  assert.equal(calls.posts, 2);
  assert.match(GRAPHQL.posts, /status:\s*\[draft,\s*needs_approval,\s*scheduled,\s*sending,\s*sent,\s*error\]/u);
});

for (const status of ["draft", "needs_approval", "scheduled", "sending", "sent", "error"]) {
  test(`any existing Kapret ${status} post blocks publication`, async () => {
    const duplicate = { id: `kapret-${status}`, channelId: channel.id, status, text: "Kapret", assets: [] };
    const { fetchImpl, calls } = makeFetch({ existingPages: [{ nodes: [duplicate], hasNextPage: false, endCursor: null }] });
    await assert.rejects(
      runKapretOnce({ action: "publish", acknowledgement: "I_APPROVE_ONE_KAPRET_SHARE_NOW", token: "test-token", fetchImpl }),
      new RegExp(`Kapret duplicate.*${status}`, "u"),
    );
    assert.equal(calls.mutations, 0);
  });
}

test("ambiguous channel identity fails closed", async () => {
  const duplicates = [channel, { ...channel, id: "different-channel-id", organizationId: "org-test-2" }];
  const { fetchImpl, calls } = makeFetch();
  const fetchWithAmbiguousChannels = async (url, init) => {
    if (url === "https://api.buffer.com" && JSON.parse(init.body).query === GRAPHQL.organizations) {
      return response({ data: { account: { organizations: [org, { id: "org-test-2", name: "Other" }] } } });
    }
    if (url === "https://api.buffer.com" && JSON.parse(init.body).query === GRAPHQL.channels) {
      const id = JSON.parse(init.body).variables.organizationId;
      return response({ data: { channels: id === "org-test" ? [duplicates[0]] : [duplicates[1]] } });
    }
    return fetchImpl(url, init);
  };
  await assert.rejects(runKapretOnce({ token: "test-token", fetchImpl: fetchWithAmbiguousChannels }), /Expected exactly one Instagram channel/u);
  assert.equal(calls.mutations, 0);
});

test("publish issues one exact automatic shareNow mutation and verifies sent content/media/link", async () => {
  const sentAt = "2026-11-14T12:00:00Z";
  const instagramLink = "https://www.instagram.com/p/ABC123/";
  const makePost = (status) => ({
    id: "buffer-post-id",
    text: APPROVED_CAPTION,
    status,
    channelId: channel.id,
    createdAt: "2026-11-14T11:59:00Z",
    sentAt: status === "sent" ? sentAt : null,
    externalLink: status === "sent" ? instagramLink : null,
    shareMode: "shareNow",
    schedulingType: "automatic",
    sharedNow: true,
    assets: [asset],
  });
  let postPage = 0;
  const { fetchImpl, calls } = makeFetch({
    existingPages: [],
    onCreate: () => makePost("sending"),
  });
  const fetchImplWithPostState = async (url, init = {}) => {
    if (url === "https://api.buffer.com") {
      const request = JSON.parse(init.body);
      if (request.query === GRAPHQL.posts) {
        postPage += 1;
        calls.posts += 1;
        calls.postQueries.push(request.query);
        const initialPreflightPages = 1;
        const nodes = postPage <= initialPreflightPages ? [] : [makePost("sent")];
        return response({ data: { posts: { edges: nodes.map((node) => ({ node })), pageInfo: { hasNextPage: false, endCursor: null } } } });
      }
    }
    return fetchImpl(url, init);
  };
  const result = await runKapretOnce({
    action: "publish",
    acknowledgement: "I_APPROVE_ONE_KAPRET_SHARE_NOW",
    token: "test-token",
    fetchImpl: fetchImplWithPostState,
    sleepImpl: async () => {},
    pollAttempts: 2,
  });
  assert.equal(calls.mutations, 1);
  assert.equal(calls.input.text, APPROVED_CAPTION);
  assert.equal(calls.input.channelId, channel.id);
  assert.equal(calls.input.schedulingType, "automatic");
  assert.equal(calls.input.mode, "shareNow");
  assert.equal(calls.input.saveToDraft, false);
  assert.equal(calls.input.needsApproval, false);
  assert.deepEqual(calls.input.assets, [{ image: { url: IMAGE_URL } }]);
  assert.equal(result.postId, "buffer-post-id");
  assert.equal(result.status, "sent");
  assert.equal(result.sentAt, sentAt);
  assert.equal(result.externalLink, instagramLink);
  assert.equal(result.text, APPROVED_CAPTION);
  assert.equal(result.assets[0].source, IMAGE_URL);
});

test("a mutation timeout is not retried", async () => {
  const { fetchImpl, calls } = makeFetch({ createThrows: true });
  await assert.rejects(
    runKapretOnce({
      action: "publish",
      acknowledgement: "I_APPROVE_ONE_KAPRET_SHARE_NOW",
      token: "test-token",
      fetchImpl,
    }),
    /do not retry any publish action/u,
  );
  assert.equal(calls.mutations, 1);
});

test("missing publish acknowledgement fails before a Buffer request", async () => {
  let requests = 0;
  await assert.rejects(
    runKapretOnce({ action: "publish", token: "test-token", fetchImpl: async () => { requests += 1; } }),
    /Missing exact publish acknowledgement/u,
  );
  assert.equal(requests, 0);
  assert.equal(CHANNEL_HANDLE, "podcastlisten.dk");
});

test("workflow is manual-only, dry-run-first by default, and has a permanent publish lock", async () => {
  const workflow = await readFile(new URL("../.github/workflows/instagram-kapret-publish-once.yml", import.meta.url), "utf8");
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /default:\s*dry-run/u);
  assert.doesNotMatch(workflow, /^\s*schedule:/mu);
  assert.match(workflow, /secrets\.BUFFER_API_KEY/u);
  assert.match(workflow, /actions\/cache\/restore@v4/u);
  assert.match(workflow, /actions\/cache\/save@v4/u);
  assert.match(workflow, /KAPRET_PUBLISH_ACTION:\s*publish/u);
  assert.doesNotMatch(workflow, /scripts\/run-instagram-automation\.mjs/u);
});
