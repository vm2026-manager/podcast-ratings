import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { APPROVED_SHEET_FEED_BASELINE } from "../supabase/functions/import-podcast-episodes/sheet-feed-approval-baseline.ts";
import {
  classifyCandidate, countActiveEpisodes, diffFeedCandidates, extractChangedConfigPodcastKeys,
  monitorEpisodeFeedDelta, renderProductionMonitorComment, MAX_EPISODES_PER_RUN
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

const repeatedFailure = await monitorEpisodeFeedDelta({ candidates: [], pending: [{ ...candidate, status: "api_error",
  last_checked_at: "2026-11-03T10:00:00.000Z" }], payload, baseUrl: "https://db.example", anonKey: "anon",
  fetchImpl: fetchWith(response(500, null)).fetch, now: () => fixedNow });
assert.equal(repeatedFailure.candidates[0].status, "api_error");
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

console.log("Bounded production post-import monitor regression: PASS");
