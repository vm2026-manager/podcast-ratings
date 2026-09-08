import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function getPodcastDetailCanonicalGroupKey(");
const end = source.indexOf("function resolvePublicPodcastDisplayItem(", start);
assert.notEqual(start, -1, "Canonical modal-group helper must exist.");
assert.notEqual(end, -1, "Modal recommendation selector must be complete.");

const context = {
  state: { podcastDisplayGroups: [] },
  normalizeText: (value) => String(value || "").trim(),
  normalizeComparable: (value) => String(value || "").trim().toLowerCase(),
  normalizeMatchKey: (value) => String(value || "").trim().toLowerCase(),
  getPodcastKey: (podcast) => podcast?.id || "",
  getDisplayGroupMemberPodcasts: (group) => group.members || []
};
vm.createContext(context);
vm.runInContext(
  `${source.slice(start, end)}; globalThis.select = selectPodcastDetailRecommendations;`,
  context
);

const sourcePodcast = { id: "agent-storm", title: "Agent Storm", mainSeries: "Djævlen i detaljen" };
const candidate = (id, mainSeries, kind = "automatic") => ({
  kind,
  item: { podcast: { id, title: id, mainSeries } }
});
const ids = (results) => Array.from(results, (result) => result.item.podcast.id);
const sameGroup = (result) => result.item.podcast.mainSeries === sourcePodcast.mainSeries;

const agentStormLike = [
  candidate("dj-1", "Djævlen i detaljen"),
  candidate("dj-2", "Djævlen i detaljen"),
  candidate("dj-3", "Djævlen i detaljen"),
  candidate("dj-4", "Djævlen i detaljen"),
  candidate("manual-external", "Anden serie", "manual"),
  candidate("automatic-external-1", "Tredje serie"),
  candidate("automatic-external-2", "Fjerde serie"),
  candidate("automatic-external-3", "Femte serie")
];
const diversified = context.select(agentStormLike, 5, { sourcePodcast });
assert.deepEqual(ids(diversified), ["dj-1", "manual-external", "dj-2", "automatic-external-1", "automatic-external-2"]);
assert.equal(diversified.filter(sameGroup).length, 2, "same-series cap is two");
assert.notEqual(diversified[0].item.podcast.mainSeries, diversified[1].item.podcast.mainSeries);
assert.notEqual(diversified[1].item.podcast.mainSeries, diversified[2].item.podcast.mainSeries);
assert.equal(diversified.length, 5, "normal row limit remains filled");
assert.equal(new Set(ids(diversified)).size, diversified.length, "recommendations remain unique");

const oneSame = context.select(
  [candidate("only-same", "Djævlen i detaljen"), candidate("external", "Anden serie")],
  5,
  { sourcePodcast }
);
assert.deepEqual(ids(oneSame), ["only-same", "external"]);

const sparseExternal = context.select(
  [
    candidate("dj-1", "Djævlen i detaljen"),
    candidate("dj-2", "Djævlen i detaljen"),
    candidate("dj-3", "Djævlen i detaljen"),
    candidate("only-external", "Anden serie")
  ],
  5,
  { sourcePodcast }
);
assert.deepEqual(ids(sparseExternal), ["dj-1", "only-external", "dj-2"]);

context.state.podcastDisplayGroups = [
  {
    id: "agent-storm-group",
    members: [sourcePodcast, { id: "agent-storm-alias", mainSeries: "Different title" }]
  }
];
context.state.podcastDisplayGroups[0].members.push({ id: "agent-storm-alias-2", mainSeries: "Different title" });
const aliasResult = context.select(
  [
    candidate("agent-storm-alias", "Different title"),
    candidate("external", "Anden serie", "manual"),
    candidate("agent-storm-alias-2", "Different title"),
    candidate("automatic", "Tredje serie")
  ],
  4,
  { sourcePodcast }
);
assert.deepEqual(ids(aliasResult), ["agent-storm-alias", "external", "agent-storm-alias-2", "automatic"]);
assert.equal(aliasResult.filter((result) => result.item.podcast.id.startsWith("agent-storm")).length, 2);

assert.match(source, /return candidatePool;/, "full pool must reach the post-collapse selector");
assert.match(source, /\{ sourcePodcast: podcast \}/, "modal must apply source-group diversification");
assert.doesNotMatch(source, /preservePriority/, "modal selector must not bypass diversification");

console.log("Podcast detail recommendation diversity tests passed.");
