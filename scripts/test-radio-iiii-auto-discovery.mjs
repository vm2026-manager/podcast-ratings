import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildRadioIIIIExactGuidRoutes, discoverRadioIIIIChildren,
  mergeAutoDiscoveredRadioIIIIRows, parseRadioIIIIEpisodePage,
  parseRadioIIIISeasonLinks, parseRadioIIIISeasonPage, validateRadioIIIISeason,
  RADIO_IIII_FEED_URL, RADIO_IIII_HOST, RADIO_IIII_MAIN_SERIES, RADIO_IIII_PROGRAM_URL,
  VERIFIED_RADIO_IIII_METADATA
} from "./radio-iiii-auto-discovery.mjs";

const candidateNames = ["Mattias Tesfaye", "Birgithe Kosovic", "Ditlev Tamm", "Sara Blædel"];
const htmlCard = (title, slug) => `<a href="/podcasts/et-kapitel-for-sig/${slug}" class="titleAndPlayLink"><h3>${title}</h3></a>`;
const makeEpisode = (title, n, host = RADIO_IIII_HOST, description = `Beskrivelse ${n}. Vært: ${host} Klipper: Redaktion`) => ({
  title,
  guid: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  source_url: `${RADIO_IIII_PROGRAM_URL}/episode-${n}`,
  audio_url: `https://traffic.omny.fm/d/clips/414edbb4-4b91-4960-8650-ad4000dbc027/51e8702e-5649-4ff8-9681-ad4800b0bb22/00000000-0000-4000-8000-${String(n).padStart(12, "0")}/audio.mp3`,
  description,
  host,
  image_url: "https://radio4data.imgix.net/cover.png"
});
function makeSeason(season, guest, baseGuid) {
  const episodePages = [makeEpisode(`Prolog - ${guest}`, baseGuid)];
  const suffix = guest === "Sara Blædel" ? "" : ` - ${guest}`;
  for (let i = 1; i <= 4; i += 1) episodePages.push(makeEpisode(`Kapitel ${i}: Emne ${i} (${i}:4)${suffix}`, baseGuid + i));
  return { season, episodePages };
}

assert.equal(RADIO_IIII_FEED_URL.includes("2eff567a-f3db-43fe-82be-ad4000bb2c"), true);
assert.deepEqual(parseRadioIIIISeasonLinks(`<a href="/podcasts/et-kapitel-for-sig?season=67">Sæson</a><a href="/podcasts/et-kapitel-for-sig?season=66">Sæson</a>`), [67, 66]);
assert.throws(() => parseRadioIIIISeasonLinks("<h1>Et kapitel for sig</h1>"), /season list/u);
const parsedSeason = parseRadioIIIISeasonPage(htmlCard("Prolog - Sara Blædel", "prolog-sara-bl-del"), 63);
assert.equal(parsedSeason[0].title, "Prolog - Sara Blædel");
assert.equal(parsedSeason[0].source_url, `${RADIO_IIII_PROGRAM_URL}/prolog-sara-bl-del`);
assert.equal(parsedSeason[0].season, 63);
const parsedPage = parseRadioIIIIEpisodePage(
  `<h1>Prolog - Sara Blædel</h1><div class="description">Gæsten fortæller. Vært: Anne Sofie Kragh Klipper: Leo Peter Larsen</div><a class="download" href="https://traffic.omny.fm/d/clips/414edbb4-4b91-4960-8650-ad4000dbc027/51e8702e-5649-4ff8-9681-ad4800b0bb22/450bd9ac-b118-46e8-b74a-b4cd002c177c/audio.mp3" download><img></a>`,
  `${RADIO_IIII_PROGRAM_URL}/prolog-sara-bl-del`
);
assert.equal(parsedPage.guid, "450bd9ac-b118-46e8-b74a-b4cd002c177c");
assert.equal(parsedPage.host, RADIO_IIII_HOST);
assert.throws(() => parseRadioIIIIEpisodePage("<h1>Guest</h1>", "https://example.com/episode"), /Untrusted/u);

const seasons = candidateNames.map((guest, index) => makeSeason([67, 66, 65, 63][index], guest, 100 + index * 10));
const valid = validateRadioIIIISeason(seasons[3]);
assert.equal(valid.safe, true, "Sara Blædel chapters may omit the guest surname when the official season prolog identifies her");
assert.deepEqual(valid.chapters.map((episode) => episode.title.match(/^Kapitel (\d+)/u)[1]), ["1", "2", "3", "4"]);
assert.equal(validateRadioIIIISeason({ ...seasons[0], episodePages: seasons[0].episodePages.slice(0, 4) }).safe, false, "incomplete 1:N sequence is withheld");
assert.equal(validateRadioIIIISeason({ ...seasons[0], episodePages: [...seasons[0].episodePages, makeEpisode("Teaser - Mattias Tesfaye", 999)] }).safe, false, "teasers are withheld");
assert.equal(validateRadioIIIISeason({ ...seasons[0], episodePages: seasons[0].episodePages.map((ep, i) => i === 0 ? { ...ep, title: "Prolog - Genhør: Mattias Tesfaye" } : ep) }).safe, false, "reprise seasons are withheld");
assert.equal(validateRadioIIIISeason({ ...seasons[0], episodePages: seasons[0].episodePages.map((ep, i) => i === 2 ? { ...ep, title: "Kapitel 2: Omlagt (3:4) - Mattias Tesfaye" } : ep) }).safe, false, "overlapping chapter sequence is withheld");
assert.equal(validateRadioIIIISeason({ ...seasons[1], episodePages: seasons[1].episodePages.map((ep, i) => i === 2 ? { ...ep, host: "En anden vært" } : ep) }).safe, false, "source host conflict is withheld");
assert.equal(validateRadioIIIISeason({ ...seasons[2], episodePages: seasons[2].episodePages.map((ep, i) => i === 3 ? { ...ep, guid: seasons[2].episodePages[2].guid } : ep) }).safe, false, "duplicate official GUID is withheld");
assert.equal(validateRadioIIIISeason({ ...seasons[2], episodePages: seasons[2].episodePages.map((ep, i) => i === 2 ? { ...ep, title: "Kapitel 2: Opgør (2:4) - En anden gæst" } : ep) }).safe, false, "conflicting explicit guest is withheld");

const catalogue = JSON.parse(await readFile("data/podcasts.json", "utf8"));
const currentGuests = catalogue.rows.filter((row) => row.Hovedserie === RADIO_IIII_MAIN_SERIES);
const catalogueCandidates = currentGuests.filter((row) => candidateNames.includes(row.Titel));
assert.ok(catalogueCandidates.length === 0 || catalogueCandidates.length === candidateNames.length, "catalogue sync adds all four verified candidates together");
assert.equal(catalogueCandidates.every((row) => row["Podcast-ID"].startsWith("radio-iiii-auto-v1-")), true, "verified candidate rows retain their generated stable IDs");
const existingGuests = currentGuests.filter((row) => !candidateNames.includes(row.Titel));
assert.equal(existingGuests.length, 60, "the 60 original guest catalog rows remain the protected baseline after candidates arrive");
const baseline = structuredClone(existingGuests);
const discovered = discoverRadioIIIIChildren({ seasons, catalogueRows: existingGuests, registry: { version: 1, records: [] }, knownGuests: candidateNames });
assert.equal(discovered.report.created.length, 4);
assert.deepEqual(existingGuests, baseline, "discovery never mutates the existing 60 rows, IDs, ratings, or sources");
assert.equal(discovered.registry.records.some((record) => record.title === RADIO_IIII_MAIN_SERIES), false, "no generic parent podcast is created");
assert.equal(discovered.report.created.every((record) => record.hovedserie === RADIO_IIII_MAIN_SERIES && record.publisher === "RADIO IIII" && record.host === RADIO_IIII_HOST), true);
assert.equal(discovered.report.created.every((record) => record.episodes.length === 5 && record.manual_episodes.length === 5), true);
assert.equal(discovered.report.created.every((record) => record.episodes[0].role === "prolog" && record.episodes.slice(1).every((episode, index) => episode.role === "chapter" && episode.chapter === index + 1)), true);
assert.equal(discovered.report.created.every((record) => record.source_episode_guid === record.episodes[1].guid), true);
assert.equal(discovered.report.created.every((record) => VERIFIED_RADIO_IIII_METADATA[record.discovery_key]?.topics.length >= 4), true);
assert.equal(discovered.report.created.every((record) => record.episodes.every((episode) => /^https:\/\/radio4\.dk\/podcasts\/et-kapitel-for-sig\//u.test(episode.source_url))), true);
assert.equal(discovered.report.created.every((record) => record.episodes.every((episode) => /^[0-9a-f-]{36}$/iu.test(episode.guid))), true);

const merged = mergeAutoDiscoveredRadioIIIIRows(existingGuests, discovered.registry);
assert.equal(merged.length, 64);
assert.deepEqual(merged.slice(0, existingGuests.length), existingGuests);
assert.equal(merged.some((row) => row.Titel === RADIO_IIII_MAIN_SERIES && row.Hovedserie === ""), false);
assert.equal(merged.every((row) => row.Titel === RADIO_IIII_MAIN_SERIES || row.Hovedserie === RADIO_IIII_MAIN_SERIES), true);
const secondPass = discoverRadioIIIIChildren({ seasons, catalogueRows: existingGuests, registry: discovered.registry, knownGuests: candidateNames });
assert.deepEqual(secondPass.report.created, [], "second discovery pass creates no duplicate candidates");
assert.deepEqual(secondPass.registry, discovered.registry, "repeated discovery is idempotent");
assert.deepEqual(mergeAutoDiscoveredRadioIIIIRows(existingGuests, secondPass.registry), merged);
const future = discoverRadioIIIIChildren({ seasons: [makeSeason(69, "Ny gæst", 900)], catalogueRows: existingGuests, registry: { version: 1, records: [] } });
assert.equal(future.report.created.length, 1, "future official guest seasons are discovered without a hard-coded name list");
assert.equal(future.registry.records[0].genre, "Portræt");
assert.equal(future.registry.records[0].topics.length, 4, "future guest topics come from the exact official chapter titles");
assert.equal(buildRadioIIIIExactGuidRoutes(discovered.registry).length, 20);
assert.equal(new Set(buildRadioIIIIExactGuidRoutes(discovered.registry).map((route) => route.external_guids[0])).size, 20);

const rated = { Titel: "Mattias Tesfaye", "Podcast-ID": "mattias tesfaye", Hovedserie: RADIO_IIII_MAIN_SERIES, "Vurdering (1-10)": "9,2", UUID: "rating-identity" };
const ratedMerge = mergeAutoDiscoveredRadioIIIIRows([rated], discovered.registry);
assert.equal(ratedMerge[0]["Vurdering (1-10)"], "9,2");
assert.equal(ratedMerge[0].UUID, "rating-identity");
assert.equal(ratedMerge.length, 4, "the other three verified candidates remain eligible when one owner-authored guest already exists");
assert.equal(ratedMerge.filter((row) => row.Titel === "Mattias Tesfaye").length, 1, "an exact owner-authored row is never duplicated");
assert.equal(ratedMerge[0]["Podcast-ID"], "mattias tesfaye", "owner Podcast-ID remains the destination for exact season episodes");
assert.equal(ratedMerge[0].radioIIIIEpisodes.length, 5, "verified exact source routes enrich an approved row without changing its catalog cells");
assert.equal(rated.radioIIIIEpisodes, undefined, "source metadata enrichment does not mutate the caller's sheet row");
const titleCollision = discoverRadioIIIIChildren({ seasons: [seasons[0]], catalogueRows: [{ Titel: "Mattias Tesfaye", "Podcast-ID": "unrelated-id", Hovedserie: "En anden serie" }], registry: { version: 1, records: [] }, knownGuests: candidateNames });
assert.equal(titleCollision.report.created.length, 0);
assert.equal(titleCollision.report.collisions.length, 1);
const seasonCollision = discoverRadioIIIIChildren({ seasons: [seasons[0], { ...seasons[0], season: 69 }], registry: { version: 1, records: [] }, knownGuests: candidateNames });
assert.equal(seasonCollision.report.created.length, 0);
assert.equal(seasonCollision.report.collisions.length, 1);
const joachim = existingGuests.find((row) => row["Podcast-ID"] === "joachim b olsen");
assert.equal(joachim?.Titel, "Joachim B. Olsen");
assert.equal(joachim?.Hovedserie, RADIO_IIII_MAIN_SERIES);

console.log("RADIO IIII discovery regression passed: four source-verified guests, 60 protected guests, exact GUID routing, safe season rejection, and idempotency.");
