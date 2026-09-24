import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function extract(name) { const start = app.indexOf(`async function ${name}(`); let depth = 0; for (let i = start; i < app.length; i += 1) { if (app[i] === "{") depth += 1; if (app[i] === "}" && --depth === 0) return app.slice(start, i + 1); } throw new Error(name); }
const state = { communityStatsRequestToken: 1, podcastDisplayGroupsReady: false, podcastDisplayGroupsVersion: 0, displayGroupCommunityStatsById: { narkobetjenten: { averageRating: 7.45, ratingCount: 1 } }, communityStatsByKey: { ordinary: { averageRating: 8, ratingCount: 2 } }, podcastDetailRecommendationCache: new Map(), supabase: { rpc: async () => { throw new Error("must not call while unready"); } } };
const context = { DISPLAY_GROUP_COMMUNITY_STATS_RPC: "get_display_group_community_stats", state, buildDisplayGroupCommunityStatsRequest: () => ["narkobetjenten"], normalizeText: String, parseNumber: Number, Math, Object, console: { warn() {} } };
vm.createContext(context); vm.runInContext(extract("fetchDisplayGroupCommunityStats"), context);
await context.fetchDisplayGroupCommunityStats(1);
assert.equal(state.displayGroupCommunityStatsById.narkobetjenten.averageRating, 7.45, "unready refresh preserves valid group stats");
state.podcastDisplayGroupsReady = true; state.podcastDisplayGroupsVersion = 1; let calls = 0;
state.supabase.rpc = async () => ({ data: (++calls, [{ display_group_id: "narkobetjenten", average_rating: 7.45, rating_count: 1 }]), error: null });
await context.fetchDisplayGroupCommunityStats(1);
assert.equal(calls, 1); assert.equal(state.displayGroupCommunityStatsById.narkobetjenten.ratingCount, 1);
console.log("Display-group community readiness race regression checks passed.");
