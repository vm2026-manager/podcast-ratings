import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { APPROVED_SHEET_FEED_BASELINE } from "../supabase/functions/import-podcast-episodes/sheet-feed-approval-baseline.ts";
import {
  classifyCandidate, countActiveEpisodes, diffFeedCandidates, extractChangedConfigPodcastKeys,
  getPendingQueueHealth, monitorEpisodeFeedDelta, parsePostImportState, renderProductionMonitorComment,
  serializePostImportState, MAX_EPISODES_PER_RUN,
  PENDING_QUEUE_WARNING_THRESHOLD, PENDING_QUEUE_CAPACITY
} from "./episode-feed-post-import.mjs";

const [podcastKey, feed] = APPROVED_SHEET_FEED_BASELINE[0];
const row = { "Podcast-ID": podcastKey, Titel: podcastKey, Feed: feed };
const payload = { rows: [row] };
const fixedNow = new Date("2026-11-04T12:00:00.000Z");
const candidate = { podcast_key: podcastKey, title: podcastKey, feed, change_type: "catalogue_feed_added",
  observed_at: "2026-11-04T10:00:00.000Z" };
const response = (status, contentRange) => ({ status, ok: status >= 200 && status < 300,
  headers: { get: name => name === "content-range" ? contentRange : null } });
const fetchWith = (...results) => {
  const calls = [];
  return { calls, fetch: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return results.shift() ?? response(500, null);
  } };
};

assert.deepEqual(diffFeedCandidates({ rows: [] }, payload, fixedNow.toISOString()).map(x => x.podcast_key), [podcastKey]);
assert.equal(diffFeedCandidates(payload, payload).length, 0, "unchanged feed does not enqueue a check");
assert.equal(diffFeedCandidates(payload, { rows: [{ ...row, Feed: "https://example.test/new.xml" }] })[0].change_type, "catalogue_feed_changed");
assert.deepEqual(extractChangedConfigPodcastKeys("+ { podcast_key: 'one' }\n  podcast_key: \"context\"\n- podcast_key: `two`"), ["one", "two"]);

const calls401 = fetchWith(response(401, null));
assert.equal((await countActiveEpisodes({ baseUrl: "https://db.example", anonKey: "bad", podcastKey, fetchImpl: calls401.fetch })).status,
  "authorization_denied");
assert.equal(calls401.calls.length, 1);
assert.match(calls401.calls[0].url.searchParams.get("podcast_key"), /^eq\./);
assert.equal(calls401.calls[0].options.method, "HEAD");
assert.equal(calls401.calls[0].options.headers.range, "0-0");
assert.equal((await countActiveEpisodes({ baseUrl: "https://db.example", anonKey: "", podcastKey })).status,
  "authorization_missing");
const failedDbSelect = fetchWith(response(500, null));
assert.equal((await countActiveEpisodes({ baseUrl: "https://db.example", anonKey: "anon", podcastKey,
  fetchImpl: failedDbSelect.fetch })).status, "api_error");
const missingCount = fetchWith(response(200, null));
assert.equal((await countActiveEpisodes({ baseUrl: "https://db.example", anonKey: "anon", podcastKey,
  fetchImpl: missingCount.fetch })).status, "api_error", "200 with no exact count is not treated as zero");
const emptyCount = fetchWith(response(200, "*/0"));
assert.equal((await countActiveEpisodes({ baseUrl: "https://db.example", anonKey: "anon", podcastKey,
  fetchImpl: emptyCount.fetch })).count, 0);
const notFoundFeed = fetchWith(response(404, null));
assert.equal((await countActiveEpisodes({ baseUrl: "https://db.example", anonKey: "anon", podcastKey,
  fetchImpl: notFoundFeed.fetch })).status, "api_error");

assert.equal(classifyCandidate(candidate, { rows: [{ ...row, Status: "Arkiveret" }] }).status, "archived_series");
assert.equal(classifyCandidate(candidate, { rows: [{ ...row, Feed: "", manualEpisodes: ["episode"] }] }).status,
  "catalogue_feed_removed");
assert.equal(classifyCandidate({ ...candidate, podcast_key: "manual source" }, { rows: [{ "Podcast-ID": "manual source",
  Titel: "Manual source", Feed: "https://example.test/feed.xml", manualEpisodes: ["episode"] }] }, { staticConfigs: {} }).status,
  "manual_episode_source");
assert.equal(classifyCandidate(candidate, { rows: [row, { ...row, Titel: "duplicate" }] }).status, "identity_collision");
assert.equal(classifyCandidate(candidate, { rows: [row, { ...row, "Podcast-ID": podcastKey.toUpperCase() }] }).status,
  "identity_collision", "normalized identity collision is withheld");

const liveCatalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const sharedCandidate = { podcast_key: "grebet af gvfb", feed: liveCatalogue.rows.find(x => x["Podcast-ID"] === "grebet af gvfb").Feed,
  change_type: "adapter_config_changed", observed_at: candidate.observed_at };
assert.equal(classifyCandidate(sharedCandidate, liveCatalogue).status, "ready_for_production_count",
  "approved shared adapter owners remain individually identifiable");
const sharedFetch = fetchWith(response(200, "0-0/4"), response(200, "*/0"));
const sharedReport = await monitorEpisodeFeedDelta({ candidates: [sharedCandidate], payload: liveCatalogue,
  baseUrl: "https://db.example", anonKey: "anon", fetchImpl: sharedFetch.fetch, now: () => fixedNow });
assert.equal(sharedReport.candidates[0].status, "active_episodes_preexisting_import_unverified");
assert.ok(sharedFetch.calls.every(call => call.url.searchParams.get("podcast_key") === "eq.grebet af gvfb"),
  "a shared source probe remains scoped to one exact Podcast-ID");

const noCalls = { fetch: async () => { throw new Error("API must not be called for review-only sources"); } };
const review = await monitorEpisodeFeedDelta({ candidates: [candidate], payload: { rows: [row] }, staticConfigs: {},
  baseUrl: "https://db.example", anonKey: "anon", fetchImpl: noCalls.fetch, now: () => fixedNow });
assert.equal(review.api_request_count, 0);
assert.equal(review.candidates[0].status, "review_required");

const noAuth = await monitorEpisodeFeedDelta({ candidates: [candidate], payload, baseUrl: "https://db.example", anonKey: "",
  fetchImpl: noCalls.fetch, now: () => fixedNow });
assert.equal(noAuth.candidates[0].status, "authorization_missing");
assert.equal(noAuth.api_request_count, 0, "missing auth is distinct from a zero count and makes no API call");
const zero = fetchWith(response(200, "*/0"));
const zeroReport = await monitorEpisodeFeedDelta({ candidates: [candidate], payload, baseUrl: "https://db.example", anonKey: "anon",
  fetchImpl: zero.fetch, now: () => fixedNow });
assert.equal(zeroReport.candidates[0].status, "awaiting_existing_import_window");
assert.equal(zeroReport.candidates[0].inactive_or_teaser_status, "not_visible_under_anon_rls");
assert.equal(zero.calls.length, 1, "RLS-hidden inactive records are never queried or inferred");

const positive = fetchWith(response(200, "0-0/3"), response(200, "*/0"));
const positiveReport = await monitorEpisodeFeedDelta({ candidates: [candidate], payload, baseUrl: "https://db.example", anonKey: "anon",
  fetchImpl: positive.fetch, now: () => fixedNow });
assert.equal(positiveReport.candidates[0].status, "active_episodes_preexisting_import_unverified");
assert.equal(positiveReport.candidates[0].active_episode_count, 3);
assert.equal(positiveReport.api_request_count, 2);
assert.equal(positive.calls.every(x => x.url.searchParams.get("is_active") === "eq.true"), true);
assert.equal(positive.calls[1].url.searchParams.has("imported_at"), true);

const recovered = fetchWith(response(200, "0-0/2"), response(200, "0-0/1"));
const recoveredReport = await monitorEpisodeFeedDelta({ candidates: [], pending: [{ ...candidate, status: "zero_active_episodes",
  last_checked_at: "2026-11-03T10:00:00.000Z" }], payload, baseUrl: "https://db.example", anonKey: "anon",
fetchImpl: recovered.fetch, now: () => fixedNow });
assert.equal(recoveredReport.candidates[0].status, "post_change_episodes_observed", "pending zero recovers when usable post-change episodes appear");

const collisionCalls = { count: 0 };
const collisionPending = await monitorEpisodeFeedDelta({ candidates: [candidate],
  payload: { rows: [row, { ...row, Titel: "duplicate exact ID" }] }, baseUrl: "https://db.example", anonKey: "anon",
  fetchImpl: async () => { collisionCalls.count++; throw new Error("identity collision must never query the API"); },
  now: () => fixedNow });
assert.equal(collisionPending.candidates[0].status, "identity_collision");
assert.equal(collisionPending.api_request_count, 0);
assert.equal(collisionCalls.count, 0, "identity collisions stay out of the pending production-query queue");

const repeatedFailure = await monitorEpisodeFeedDelta({ candidates: [], pending: [{ ...candidate, status: "api_error",
  last_checked_at: "2026-11-01T10:00:00.000Z" }], payload, baseUrl: "https://db.example", anonKey: "anon",
  fetchImpl: fetchWith(response(500, null)).fetch, now: () => fixedNow });
assert.equal(repeatedFailure.candidates[0].status, "api_error");
assert.ok(repeatedFailure.pending.some(item => item.podcast_key === podcastKey),
  "API failures remain queued beyond the 36-hour episode alarm grace until rechecked");
const notYetDue = await monitorEpisodeFeedDelta({ candidates: [], pending: [{ ...candidate, status: "api_error",
  last_checked_at: "2026-11-04T01:00:00.000Z" }], payload, baseUrl: "https://db.example", anonKey: "anon",
  fetchImpl: noCalls.fetch, now: () => fixedNow });
assert.equal(notYetDue.api_request_count, 0, "daily retry cadence is at least 18 hours");

const many = Array.from({ length: MAX_EPISODES_PER_RUN + 3 }, (_, i) => ({ ...candidate, podcast_key: `missing-${i}` }));
const bounded = await monitorEpisodeFeedDelta({ candidates: many, payload: { rows: [] }, fetchImpl: noCalls.fetch,
  baseUrl: "https://db.example", anonKey: "anon", now: () => fixedNow });
assert.equal(bounded.api_request_count, 0, "IDs absent from exact catalogue scope never query Supabase");
assert.equal(bounded.candidate_count, MAX_EPISODES_PER_RUN + 3);
assert.equal(bounded.scope_limit_exceeded, true);
assert.match(renderProductionMonitorComment(positiveReport), /ikke synlige med anon-adgang/u);

const backlogIds = Array.from({ length: 31 }, (_, index) => `queue-test-${String(index).padStart(2, "0")}`);
const backlogPayload = { rows: backlogIds.map(id => ({ "Podcast-ID": id, Titel: id,
  Feed: `https://example.test/${id}.xml` })) };
const backlogCandidates = backlogPayload.rows.map(item => ({ podcast_key: item["Podcast-ID"], title: item.Titel,
  feed: item.Feed, change_type: "catalogue_feed_added", observed_at: fixedNow.toISOString() }));
const backlogConfigs = Object.fromEntries(backlogIds.map(id => [id, { podcast_key: id,
  source: `synthetic-${id}`, feed_url: `https://example.test/${id}.xml`, enabled: true }]));
let backlogPending = [];
const backlogDailyReports = [];
for (let day = 0; day < 4; day++) {
  const dayNow = new Date(fixedNow.getTime() + day * 24 * 60 * 60 * 1000);
  let requests = 0;
  const checkedIds = new Set();
  const daily = await monitorEpisodeFeedDelta({
    candidates: day === 0 ? backlogCandidates : [],
    pending: backlogPending,
    payload: backlogPayload,
    staticConfigs: backlogConfigs,
    baseUrl: "https://db.example",
    anonKey: "anon",
    now: () => dayNow,
    fetchImpl: async url => {
      requests++;
      checkedIds.add(new URL(url).searchParams.get("podcast_key")?.replace(/^eq\./u, ""));
      return response(200, "*/0");
    }
  });
  assert.ok(daily.api_request_count <= 20, `day ${day + 1} exceeded the 20-HEAD-call budget`);
  assert.ok(checkedIds.size <= 10,
    `day ${day + 1} checked more than 10 Podcast-IDs`);
  backlogPending = daily.pending;
  backlogDailyReports.push({ daily, requests, checkedIds: [...checkedIds] });
}
assert.equal(backlogDailyReports[0].daily.pending.length, 31, "the initial 31-ID backlog is retained");
assert.equal(backlogDailyReports[2].daily.pending.length, 31,
  "all 31 exact IDs must remain queued after the third daily run");
assert.equal(backlogDailyReports[3].daily.pending.length, 31,
  "the fourth run must still see every delayed exact ID after the change delta expires");
assert.ok(backlogDailyReports.slice(0, 3).some(({ daily }) => daily.pending.some(item =>
  item.status === "deferred_by_daily_budget")), "the reproduction must exercise deferred_by_daily_budget");
assert.ok(backlogDailyReports.every(({ requests }) => requests <= 20), "daily queue must preserve the request budget");
assert.deepEqual(new Set(backlogDailyReports.flatMap(({ checkedIds }) => checkedIds)), new Set(backlogIds),
  "31 simultaneous approved changes are all checked within four daily runs");
assert.ok(backlogDailyReports.every(({ checkedIds }) => checkedIds.length <= MAX_EPISODES_PER_RUN),
  "the queue never checks more than ten exact IDs per daily run");
assert.ok(backlogDailyReports[0].daily.backlog_warning, "large pending queue is explicitly flagged on day one");
assert.match(renderProductionMonitorComment(backlogDailyReports[0].daily), /Backlog-advarsel/u);
assert.equal(PENDING_QUEUE_WARNING_THRESHOLD, 20);
assert.equal(PENDING_QUEUE_CAPACITY, 400);

const overCapacityPending = Array.from({ length: PENDING_QUEUE_CAPACITY + 1 }, (_, index) => ({
  ...backlogDailyReports[0].daily.pending[index % backlogDailyReports[0].daily.pending.length],
  podcast_key: `capacity-${index}`,
  feed: `https://example.test/${createHash("sha256").update(String(index)).digest("hex")}.xml`
}));
const capacityHealth = getPendingQueueHealth(overCapacityPending);
assert.equal(capacityHealth.backlog_count, PENDING_QUEUE_CAPACITY + 1);
assert.equal(capacityHealth.queue_capacity_exceeded, true, "capacity crossing is an explicit owner-review condition");
assert.equal(overCapacityPending.length, PENDING_QUEUE_CAPACITY + 1,
  "crossing the warning capacity never discards exact IDs from durable state");
assert.ok(serializePostImportState({ pending: overCapacityPending }).startsWith("zlib-base64:"),
  "the synthetic over-capacity payload exercises compressed state storage");
const overCapacityComment = renderProductionMonitorComment({ ...backlogDailyReports[0].daily, ...capacityHealth,
  pending: overCapacityPending });
assert.match(overCapacityComment, /Køkapaciteten er overskredet/u);
assert.ok(Buffer.byteLength(overCapacityComment, "utf8") < 65_536,
  "bounded GitHub comment state stays below the issue-comment payload limit at queue capacity");
const compressedStateMatch = overCapacityComment.match(/<!-- episode-feed-post-import-state-begin -->([\s\S]*?)<!-- episode-feed-post-import-state-end -->/u);
const compressedState = compressedStateMatch?.[1].trim();
assert.ok(compressedState?.startsWith("zlib-base64:"), "large durable state is compressed before GitHub comment storage");
assert.deepEqual(parsePostImportState(compressedStateMatch[1]), JSON.parse(JSON.stringify({ pending: overCapacityPending })),
  "compressed GitHub queue state round-trips every exact deferred Podcast-ID");
assert.deepEqual(parsePostImportState(JSON.stringify({ pending: [{ podcast_key: "legacy-state" }] })),
  { pending: [{ podcast_key: "legacy-state" }] }, "legacy plain JSON state remains readable");
assert.ok(serializePostImportState({ pending: overCapacityPending }).startsWith("zlib-base64:"));

let recoveryPending = backlogPending;
let recoveryReports = [];
for (let day = 4; day < 10; day++) {
  const dayNow = new Date(fixedNow.getTime() + day * 24 * 60 * 60 * 1000);
  const checkedIds = new Set();
  const recovered = await monitorEpisodeFeedDelta({ candidates: [], pending: recoveryPending,
    payload: backlogPayload, staticConfigs: backlogConfigs, baseUrl: "https://db.example", anonKey: "anon",
    now: () => dayNow,
    fetchImpl: async url => {
      const parsed = new URL(url);
      checkedIds.add(parsed.searchParams.get("podcast_key")?.replace(/^eq\./u, ""));
      return parsed.searchParams.has("imported_at") ? response(200, "0-0/1") : response(200, "0-0/2");
    } });
  assert.ok(recovered.api_request_count <= 20, `recovery day ${day + 1} exceeded the 20-HEAD-call budget`);
  assert.ok(checkedIds.size <= 10,
    `recovery day ${day + 1} exceeded the ten-ID work budget`);
  recoveryPending = recovered.pending;
  recoveryReports.push(recovered);
}
assert.ok(recoveryReports.some(report => report.backlog_count < 31),
  "verified post-change episodes drain the durable queue after the separate 36-hour handoff window");
assert.equal(recoveryReports.at(-1).backlog_count, 0, "the queue recovers to empty once every source verifies usable new episodes");

console.log("Bounded production post-import monitor regression: PASS");
