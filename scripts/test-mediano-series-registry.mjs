import assert from "node:assert/strict";
import fs from "node:fs";
const catalogue = JSON.parse(fs.readFileSync("data/podcasts.json", "utf8")).rows.filter((row) => /^(mediano|media o)$/iu.test(String(row.Udgiver || "")));
const registry = JSON.parse(fs.readFileSync("data/mediano-series-registry.json", "utf8")).rows;
assert.equal(registry.length, 68); assert.equal(new Set(registry.map((r) => r.legacyPodcastId)).size, 68);
assert.deepEqual(new Set(registry.map((r) => r.legacyPodcastId)), new Set(catalogue.map((r) => r["Podcast-ID"])));
assert(registry.every((row) => ["pending", "reviewed"].includes(row.researchStatus)), "every row has a valid researchStatus");
for (const row of registry) { if (row.evidenceStatus === "verified") assert.ok(row.canonicalSeriesTitle && row.canonicalPodcastId); if (row.evidenceStatus === "unresolved") assert.equal(row.suppressFromCurrentCatalogue, false); }
assert.equal(registry.filter((r) => r.canonicalPodcastId === "magasinet jennings").length, 18);
assert.equal(registry.find((r) => r.legacyPodcastId === "kristjaan speakmann").canonicalSeriesTitle, "Brüchmann ringer til");
const byId = new Map(registry.map((row) => [row.legacyPodcastId, row]));
for (const id of ["hammer og bruchmann", "superliga for voksne", "superzoom", "mediano moneyball", "mediano superliga"]) assert.equal(byId.get(id).evidenceStatus, "verified", `${id} keeps its prior verified classification`);
for (const id of ["mediano special hvad siger data om superligaen", "mediano business", "mediano transfer", "superliga preview", "minimax"]) assert.equal(byId.get(id).evidenceStatus, "verified", `${id} is verified by the final strong-row review`);
for (const id of ["mediano em speciel 2021", "mediano landshold", "mediano championship"]) assert.equal(byId.get(id).evidenceStatus, "strong", `${id} remains strong without a deterministic canonical relationship`);
assert.equal(byId.get("mediano special hvad siger data om superligaen").suppressFromCurrentCatalogue, true, "the verified Mediano Special episode is eligible for explicit local suppression");
assert.equal(byId.get("mediano special hvad siger data om superligaen").editorialRating, "8,3", "the historical editorial score remains registry metadata");
const selectedResults = new Map([
  ["super", "unresolved"], ["troels bech i en samtale", "unresolved"], ["fredagsfrokosten", "verified"], ["mediano transfer", "verified"], ["mediano waiting", "verified"], ["mediano marketing", "verified"], ["max mediano", "verified"], ["superliga preview", "verified"], ["fodboldministeriet", "verified"], ["mediano 1 division", "verified"]
]);
for (const [id, status] of selectedResults) {
  const row = byId.get(id);
  assert.equal(row.evidenceStatus, status, `${id} has its reviewed result`);
  assert.equal(row.suppressFromCurrentCatalogue, false, `${id} remains unsuppressed in the research registry`);
  if (status !== "unresolved") assert.equal(row.preserveAsHistoricalEpisode, true, `${id} preserves its reviewed historical identity`);
  assert.equal(row.researchStatus, "reviewed", `${id} remains reviewed`);
}
for (const id of ["super", "troels bech i en samtale"]) {
  assert.equal(byId.get(id).evidenceStatus, "unresolved", `${id} remains unresolved after its prior research`);
  assert.equal(byId.get(id).researchStatus, "reviewed", `${id} is not eligible for a repeated pending-only batch`);
}
const pendingBatchResults = new Map([
  ["camp canada", "verified"], ["danskertjek", "verified"], ["fodbold var værre i 70 erne", "verified"], ["mediano bossword", "verified"], ["minimax", "verified"], ["den store talentserie", "verified"], ["vm manager special", "unresolved"], ["hammers kaffebar", "verified"], ["europa rundt med hebo", "verified"], ["souplesse", "verified"]
]);
for (const [id, status] of pendingBatchResults) {
  const row = byId.get(id);
  assert.equal(row.evidenceStatus, status, `${id} has its pending-only batch result`);
  assert.equal(row.researchStatus, "reviewed", `${id} is marked reviewed after source research`);
  assert.equal(row.suppressFromCurrentCatalogue, false, `${id} remains unsuppressed in the research registry`);
  if (status !== "unresolved") assert.equal(row.preserveAsHistoricalEpisode, true, `${id} preserves its reviewed historical identity`);
}
const thirdPendingBatchResults = new Map([
  ["fodbold var bedre i 90 erne", "verified"], ["mediano pl", "verified"], ["klub mediano", "verified"], ["mediano landshold", "strong"], ["mediano breaking", "verified"], ["mediano serie a", "verified"], ["mediano la liga", "verified"], ["bold boger", "verified"], ["mediano bundesliga", "verified"], ["mediano garra", "verified"]
]);
for (const [id, status] of thirdPendingBatchResults) {
  const row = byId.get(id);
  assert.equal(row.evidenceStatus, status, `${id} has its pending-only batch result`);
  assert.equal(row.researchStatus, "reviewed", `${id} is marked reviewed after source research`);
  assert.equal(row.suppressFromCurrentCatalogue, false, `${id} remains unsuppressed in the research registry`);
  assert.equal(row.preserveAsHistoricalEpisode, true, `${id} preserves its reviewed historical identity`);
}
const finalPendingBatchResults = new Map([
  ["superliga special", "verified"], ["mediano 2 division", "verified"], ["fredagsbold", "verified"], ["mediano championship", "strong"], ["mediano sport og perspektiv", "verified"], ["mediano q", "verified"]
]);
for (const [id, status] of finalPendingBatchResults) {
  const row = byId.get(id);
  assert.equal(row.evidenceStatus, status, `${id} has its final pending-only batch result`);
  assert.equal(row.researchStatus, "reviewed", `${id} is marked reviewed after source research`);
  assert.equal(row.suppressFromCurrentCatalogue, false, `${id} remains unsuppressed in the research registry`);
  assert.equal(row.preserveAsHistoricalEpisode, true, `${id} preserves its reviewed historical identity`);
}
assert.equal(registry.filter((row) => row.researchStatus === "reviewed").length, 68, "all identities have now been individually reviewed");
assert.equal(registry.filter((row) => row.researchStatus === "pending").length, 0, "no identity remains pending");
console.log("Mediano series registry validation passed.");
