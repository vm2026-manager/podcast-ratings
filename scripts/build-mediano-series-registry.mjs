import fs from "node:fs";
const catalogue = JSON.parse(fs.readFileSync("data/podcasts.json", "utf8")).rows;
const reviews = JSON.parse(fs.readFileSync("data/mediano-series-registry-reviews.json", "utf8"));
const cataloguePodcastIds = new Set(catalogue.map((row) => row["Podcast-ID"]));
const known = {
  "ciao gianni": ["Magasinet Jennings", "magasinet jennings", "explicit_hovedserie"],
  "vi præsenterer erik skjærbæk": ["Klub Mediano", "klub mediano", "explicit_hovedserie"],
  "sadan blev han victor froholdt": ["Klub Mediano", "klub mediano", "explicit_hovedserie"],
  "sagen om de 15 point forsvandt fra i lommen af den gamle dame": ["Mediano Special", "mediano special", "explicit_hovedserie"],
  "her er vores bud pa de ti spillere har været de største transfersucceser i superligaen": ["Transfer Special", "transfer special", "explicit_hovedserie"],
  "kristjaan speakmann": ["Brüchmann ringer til", "bruchmann ringer til", "explicit_hovedserie"],
  "der var engang et mal af peter møller mod farum": ["Der var engang et mål", "der var engang et mal", "user_confirmed_series"]
};
for (const row of catalogue.filter((row) => row.Hovedserie === "Jennings")) known[row["Podcast-ID"]] = ["Magasinet Jennings", "magasinet jennings", "explicit_hovedserie"];
const rows = catalogue.filter((row) => /^(mediano|media o)$/iu.test(String(row.Udgiver || ""))).map((row) => {
  const id = row["Podcast-ID"], mapping = known[id], review = reviews[id] || {};
  const canonicalPodcastId = review.canonicalPodcastId ?? mapping?.[1] ?? null;
  const evidenceStatus = review.evidenceStatus ?? (mapping ? "verified" : "unresolved");
  const researchStatus = review.researchStatus ?? (mapping ? "reviewed" : "pending");
  return {
    legacyPodcastId: id, displayTitle: row.Titel, publisher: row.Udgiver,
    hovedserie: row.Hovedserie || null, sourceUrl: row.Link || null,
    episodeCount: Number(row["Antal afsnit"]) || null, year: row["Årstal afspillet"] || null,
    editorialRating: row["Vuring (1-10)"] || null, editorialDate: row["Afgivet vurdering"] || null,
    rowType: mapping ? "historical_episode" : "unresolved",
    canonicalSeriesTitle: mapping?.[0] || null, canonicalPodcastId: mapping?.[1] || null,
    canonicalExists: canonicalPodcastId ? cataloguePodcastIds.has(canonicalPodcastId) : false, evidenceStatus: mapping ? "verified" : "unresolved",
    researchStatus,
    evidence: mapping ? [{ type: mapping[2], detail: row.Hovedserie || "Explicit reviewed product confirmation." }] : [{ type: "unresolved", detail: "Requires original Mediano page/series research; no title-only inference." }],
    suppressFromCurrentCatalogue: Boolean(mapping), preserveAsHistoricalEpisode: Boolean(mapping),
    currentRssRouteKey: null, notes: mapping ? "Existing reviewed mapping; registry only." : "Not implemented in this research pass.",
    ...review,
    canonicalExists: canonicalPodcastId ? cataloguePodcastIds.has(canonicalPodcastId) : false,
    preserveAsHistoricalEpisode: review.preserveAsHistoricalEpisode ?? (evidenceStatus !== "unresolved")
  };
});
fs.writeFileSync("data/mediano-series-registry.json", `${JSON.stringify({ version: 1, generatedFrom: "data/podcasts.json", rows }, null, 2)}\n`);
