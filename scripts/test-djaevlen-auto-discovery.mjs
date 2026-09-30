import assert from "node:assert/strict";
import { discoverDjaevlenChildren, mergeAutoDiscoveredDjaevlenRows } from "./djaevlen-auto-discovery.mjs";
import { buildDjaevlenRoutes } from "../supabase/functions/import-podcast-episodes/djaevlen-routing.mjs";

const rated = { Titel: "Eksisterende rated", "Podcast-ID": "rated-key", Hovedserie: "Djævlen i detaljen" };
const original = structuredClone([rated]);
const first = discoverDjaevlenChildren({ catalogueRows: original, episodeTitles: ["Ny dansk Djævlen-serie 1:3 - Første afsnit", "Trailer: Ny dansk Djævlen-serie"] });
assert.equal(first.report.created.length, 1); assert.equal(first.report.special.length, 1);
assert.deepEqual(original, [rated], "sheet rows are immutable");
const id = first.report.created[0].podcast_id;
const second = discoverDjaevlenChildren({ catalogueRows: original, registry: first.registry, episodeTitles: ["Ny dansk Djævlen-serie 2:3 - Andet afsnit"] });
assert.equal(second.report.created.length, 0); assert.equal(second.registry.records.length, 1); assert.equal(second.registry.records[0].podcast_id, id);
const danish = discoverDjaevlenChildren({ catalogueRows: original, episodeTitles: ["Åben Ærø-serie 1:2 - åbenbaring"] });
const merged = mergeAutoDiscoveredDjaevlenRows(original, danish.registry);
assert.equal(merged.at(-1).Titel, "Åben Ærø-serie"); assert.equal(merged.at(-1)["Podcast-ID"], danish.registry.records[0].podcast_id);
assert.equal(buildDjaevlenRoutes(merged).routes.at(-1).podcast_key, danish.registry.records[0].podcast_id);
assert.equal(discoverDjaevlenChildren({ catalogueRows: [rated, { Titel: "Ny, dansk Djævlen-serie", "Podcast-ID": "legacy-rated" }], episodeTitles: ["Ny dansk Djævlen-serie 1:3"] }).report.created.length, 0);
console.log("Djævlen auto-discovery tests passed");
