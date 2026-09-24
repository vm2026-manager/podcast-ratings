import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function extract(name) { const start = app.indexOf(`async function ${name}(`); assert.ok(start >= 0); let depth = 0; for (let i = start; i < app.length; i += 1) { if (app[i] === "{") depth += 1; if (app[i] === "}" && --depth === 0) return app.slice(start, i + 1); } throw new Error(name); }
function deferred() { let resolve; return { promise: new Promise((done) => { resolve = done; }), resolve }; }
const initial = () => ({ narkobetjenten: { averageRating: 7.45, ratingCount: 1 } });
const state = { communityStatsRequestToken: 1, podcastDisplayGroupsReady: false, podcastDisplayGroupsVersion: 0, displayGroupCommunityStatsById: initial(), communityStatsByKey: { ordinary: { averageRating: 8, ratingCount: 2 } }, podcastDetailRecommendationCache: new Map(), supabase: {} };
let ids = ["narkobetjenten"], modalRefreshes = 0, calls = 0, next;
const context = { DISPLAY_GROUP_COMMUNITY_STATS_RPC: "get_display_group_community_stats", state, buildDisplayGroupCommunityStatsRequest: () => ids, normalizeText: (v) => String(v ?? ""), parseNumber: Number, Math, Object, refreshOpenPodcastDetailSheet: () => { modalRefreshes += 1; }, console: { warn() {} } };
vm.createContext(context); vm.runInContext(extract("fetchDisplayGroupCommunityStats"), context);
state.supabase.rpc = () => { calls += 1; return next.promise; };
next = deferred(); await context.fetchDisplayGroupCommunityStats(1);
assert.equal(calls, 0); assert.deepEqual(state.displayGroupCommunityStatsById, initial()); assert.equal(modalRefreshes, 0);
state.podcastDisplayGroupsReady = true; state.podcastDisplayGroupsVersion = 1; next = deferred(); const pending = context.fetchDisplayGroupCommunityStats(1);
assert.equal(calls, 1); assert.deepEqual(state.displayGroupCommunityStatsById, initial()); assert.equal(modalRefreshes, 0);
next.resolve({ data: [{ display_group_id: "narkobetjenten", average_rating: 8.15, rating_count: 2 }], error: null }); await pending;
assert.equal(JSON.stringify(state.displayGroupCommunityStatsById), JSON.stringify({ narkobetjenten: { averageRating: 8.15, ratingCount: 2 } })); assert.equal(modalRefreshes, 1);
state.displayGroupCommunityStatsById = initial(); modalRefreshes = 0; next = deferred(); const failed = context.fetchDisplayGroupCommunityStats(1); assert.deepEqual(state.displayGroupCommunityStatsById, initial()); next.resolve({ data: null, error: new Error("fail") }); await failed;
assert.deepEqual(state.displayGroupCommunityStatsById, {}); assert.deepEqual(state.communityStatsByKey, { ordinary: { averageRating: 8, ratingCount: 2 } }); assert.equal(modalRefreshes, 1);
state.displayGroupCommunityStatsById = initial(); ids = []; modalRefreshes = 0; await context.fetchDisplayGroupCommunityStats(1); assert.deepEqual(state.displayGroupCommunityStatsById, {}); assert.equal(modalRefreshes, 1); ids = ["narkobetjenten"];
state.displayGroupCommunityStatsById = initial(); state.podcastDisplayGroupsVersion = 2; modalRefreshes = 0; next = deferred(); const staleVersion = context.fetchDisplayGroupCommunityStats(1); state.podcastDisplayGroupsVersion = 3; next.resolve({ data: [{ display_group_id: "narkobetjenten", average_rating: 1, rating_count: 9 }], error: null }); await staleVersion;
assert.deepEqual(state.displayGroupCommunityStatsById, initial()); assert.equal(modalRefreshes, 0);
next = deferred(); const staleToken = context.fetchDisplayGroupCommunityStats(1); state.communityStatsRequestToken = 2; next.resolve({ data: null, error: new Error("old") }); await staleToken; assert.deepEqual(state.displayGroupCommunityStatsById, initial()); assert.equal(modalRefreshes, 0);
console.log("Display-group community readiness race regression checks passed.");
