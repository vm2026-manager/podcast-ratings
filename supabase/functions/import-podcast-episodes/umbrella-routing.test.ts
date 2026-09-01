import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runEpisodeImport, routeEpisodes, type PodcastEpisodeRow } from "./core.ts";
import { FEED_CONFIGS, type FeedConfig } from "./feed-config.ts";

const transferDescription = "Velkommen til Tipsbladets Transfer Talk.";
const tipsbladetHistory: Array<[string, string, string?]> = [
  ["Buzzsprout-16300923", "Episode 1: Transfer Talk - Superligaens varmeste salgsemner"],
  ["Buzzsprout-16316202", "Episode 2: Transfer Talk: Panik i din Superligaklub?"],
  ["Buzzsprout-16369718", "Episode 3: Transfer Talk: Han er den oplagte Brøndby-træner"],
  ["Buzzsprout-16407958", "Episode 4: Tålmodigheden er opbrugt i FCK \"Farvel og tak\"", transferDescription],
  ["Buzzsprout-16448173", "Episode 5: Brøndby-angriber i vildt skifte: \"Han stod bare bagerst i køen\"", transferDescription],
  ["Buzzsprout-16490052", "Episode 6: 250 Millioner kroner: Derfor scorer Damsgaard gigakontrakt", transferDescription],
  ["Buzzsprout-16532569", "Episode 7: 210 Bundesligakampe - nu nævnes han i FCK", transferDescription],
  ["Buzzsprout-16574975", "Episode 8: Debat om Bischoff-salg: Der er mange ekstra millioner at hente for Brøndby", transferDescription],
  ["Buzzsprout-16602081", "Trash Talk: Brøndby vinder guld - Neestrup/FC København flopper"],
  ["Buzzsprout-16644839", "Trash Talk: Hvad sker der nu med det her Brøndby-hold?"],
  ["Buzzsprout-16689288", "Trash Talk: Rigtig tamt og svagt af Neestrup!"],
  ["Buzzsprout-16731223", "Trash Talk: Fodboldens svar på Paradise Hotel?"],
  ["Buzzsprout-16771961", "Trash Talk: Har røvkedelige Brøndby og Birk kurs mod bundspillet?"],
  ["Buzzsprout-16805680", "Trash Talk: Stor kritik af FCK's sportsdirektør: Useriøst!"],
  ["Buzzsprout-16896326", "Trash Talk: Brøndbys vigtigste mand, Serginho som det næste store salg & spansk peptalk til Osorio"],
  ["Buzzsprout-16937661", "Trash Talk: Kæmpe ros til Neestrup, FCK’s nier i derbyet og Midtjyllands deroute"],
  ["Buzzsprout-16974320", "Trash Talk: Hvem tror Ramaj egentlig han er? Putros' fejlfrie kamp og alt om det vanvittige derby."],
  ["Buzzsprout-17026601", "Trash Talk: Er dansk fodbold det bedste i Skandinavien? Den næste vi ser på landsholdet & seriøs kamp om guldet!"],
  ["Buzzsprout-17064559", "Trash Talk: Hvad er FCKs ansvar i Huescas-sagen? Franculinos vanvidskamp, og ‘usandsynligt lavt’ målmandsniveau i Superligaen"],
  ["Buzzsprout-17107910", "Trash Talk: Hvornår har vi sidst haft en spiller som Froholdt, dårlige Onugkha og et vildt derby!"],
  ["Buzzsprout-17150680", "Trash Talk: Delaney brager FCK på guldkurs, hvordan ser fremtiden ud i AGF og sæsonens spiller i Superligaen?"],
  ["Buzzsprout-17195850", "Trash Talk: Er Neestrup et geni? Kielstrup og Vejle imponerer – Lyngby og AaB skuffer stort!"],
  ["Buzzsprout-17228031", "Trash Talk: Han bliver solgt for +150 millioner, hatten af for FCK, AGF er simpelthen for ringe & et vanvittigt løntilbud"],
  ["Buzzsprout-17260656", "Trash Talk CL Special: Historiens dårligeste præstation, FCK kunne give mere modstand, han kan vinde Ballon D’or & vil du være sød at juble Hakimi!"],
  ["Buzzsprout-19401131", "Livet som fodboldagent – uden filter | SPILLET BAG SPILLET - Episode 1"],
  ["Buzzsprout-19430075", "Sådan vinder klubber kampen om en spiller | SPILLET BAG SPILLET - Episode 2"],
  ["Buzzsprout-19435272", "PC afslører: Sådan presser vi prisen på en spiller op | SPILLET BAG SPILLET - Episode 3"],
  ["Buzzsprout-19503236", "Malte Amundsen om det opkald, der ændrede alt | SPILLET BAG SPILLET - Episode 5"],
  ["Buzzsprout-19507368", "Sådan tjener fodboldagenter penge – og derfor får de kritik | SPILLET BAG SPILLET - Episode 4"],
  ["Buzzsprout-19531766", "FARZAM: Agenter BESTEMMER ikke, hvad jeg afslører! | SPILLET BAG SPILLET - Episode 9"],
  ["Buzzsprout-19531869", "Helenius: Det var IKKE fodbolden, der gjorde mig syg! | SPILLET BAG SPILLET - Episode 6"],
  ["Buzzsprout-19554914", "Har han et horn i siden på Brøndby? | FEMTEDOMMER - Runde 1"],
  ["Buzzsprout-19569541", "FC København har ikke truppen til top 3 | SUPERLIGAENS SANDHEDER - Runde 1"],
  ["Buzzsprout-19590917", "Sæsonens første 3-tal: Dommeren dumper | FEMTEDOMMER - Runde 2"],
  ["Buzzsprout-19599299", "Thomas Nørgaard-effekten buldrer i Brøndby! | SUPERLIGAENS SANDHEDER - Runde 2"],
  ["Buzzsprout-19603409", "- FCK henter en STOR stjerne! | Transfer Talk, Episode 1"],
  ["Buzzsprout-19609303", "Glen Riddersholm: ALLE kan snyde ALLE i fodbold! | SPILLET BAG SPILLET - Episode 7"],
  ["Buzzsprout-19624480", "VAR-kendelse på 6 mm skaber debat i Brøndby-kampen | FEMTEDOMMER - Runde 3"],
  ["Buzzsprout-19631229", "VILD TALENTJAGT: Kontaktet ÉT minut inde i fødselsdagen! | SPILLET BAG SPILLET - Episode 8"],
  ["Buzzsprout-19632126", "Har FCK sikret sig en ny profil? | Superligaens Sandheder - Episode 11"],
  ["Buzzsprout-19636136", "Har FCK ikke råd til at betale 30 mio. for Bruun Larsen? Transfer Talk, Episode 2"],
  ["Buzzsprout-19657719", "Rødt kort eller ej? Vi dissekerer rundens største kendelser | FEMTEDOMMER - Runde 4"],
  ["Buzzsprout-19666116", "De spiller ikke godt nok! | Superligaens Sandheder - Episode 12"],
  ["Buzzsprout-19670139", "FARZAM: Brøndby skal af med tre profiler! | Transfer Talk, Episode 3"],
  ["Buzzsprout-19692271", "DET STØRSTE OVERSETE RØDE KORT I SUPERLIGAENS HISTORIE? | FEMTEDOMMER - Runde 5"],
  ["Buzzsprout-19701192", "Er Brøndby mesterskabskandidat? | Superligaens Sandheder - Episode 13"],
  ["Buzzsprout-19705099", "FARZAM: Brøndby leder efter Wass' afløser på midtbanen | Transfer Talk, Episode 4"],
  ["Buzzsprout-19715507", "FODBOLDAGENTEN: Jeg tror, det bliver EKSTREMT her til sidst! | SPILLET BAG SPILLET - Episode 10"],
  ["Buzzsprout-19728855", "Ny VAR-bommert: De fik sejrsmål annulleret! | FEMTEDOMMER - Runde 6"]
];

function episode(external_guid: string, title: string, description = ""): PodcastEpisodeRow {
  return {
    podcast_key: "tipsbladet lyd", source: "buzzsprout_tipsbladet_lyd_rss", external_guid,
    external_episode_id: null, title, description, published_at: null, duration_seconds: null,
    episode_url: null, audio_url: null, image_url: null, is_active: true, metadata: {}
  };
}

async function runUmbrellaStatus(options: {
  routes: NonNullable<FeedConfig["routes"]>;
  title: string;
  description?: string;
  existing?: PodcastEpisodeRow[];
}) {
  const writes: PodcastEpisodeRow[][] = [];
  const logs: Record<string, unknown>[] = [];
  const repository = {
    createImportRun: async () => ({ id: "run-1" }),
    loadExistingEpisodes: async () => options.existing || [],
    upsertEpisodes: async (rows: PodcastEpisodeRow[]) => { writes.push(rows); },
    updateImportRun: async (_id: string, input: Record<string, unknown>) => { logs.push(input); }
  };
  const config: FeedConfig = {
    podcast_key: "umbrella", source: "umbrella_rss", feed_url: "https://example.test/feed", routes: options.routes
  };
  const result = await runEpisodeImport({
    feedKey: "umbrella", repository, feedConfigs: { umbrella: config }, now: () => "2026-09-01T00:00:00.000Z",
    fetchText: async () => `<rss><channel><title>Umbrella</title><item><guid>guid-1</guid><title>${options.title}</title><description>${options.description || ""}</description></item></channel></rss>`
  });
  return { result, writes, logs };
}

Deno.test("Tipsbladet Lyd's 49 inspected episodes route deterministically", () => {
  const routed = routeEpisodes(tipsbladetHistory.map(([guid, title, description]) => episode(guid, title, description)), FEED_CONFIGS.tipsbladet_lyd);
  const report = routed.report!;
  assertEquals(tipsbladetHistory.length, 49);
  assertEquals(routed.episodes.length, 33);
  assertEquals(report.route_counts, {
    transfer_talk: 12, spillet_bag_spillet: 10, superligaens_sandheder: 5, femtedommer: 6
  });
  assertEquals(report.known_no_destination_counts, { trash_talk: 16 });
  assertEquals(report.known_no_destination.length, 16);
  assertEquals(report.unmatched.length, 0);
  assertEquals(report.ambiguous.length, 0);
});

Deno.test("normal feeds retain their direct podcast destination", () => {
  const directConfig: FeedConfig = { podcast_key: "normal", source: "normal_rss", feed_url: "https://example.test/feed" };
  const original = episode("normal-1", "Normal episode");
  assertEquals(routeEpisodes([original], directConfig), { episodes: [original], report: null });
});

Deno.test("clean deterministic umbrella routing reports success", async () => {
  const { result, writes } = await runUmbrellaStatus({
    title: "Clean title", routes: [{ key: "clean", podcast_key: "target", title: { aliases: ["clean title"] } }]
  });
  assertEquals(result.status, "success");
  assertEquals(result.error_count, 0);
  assertEquals(writes.length, 1);
});

Deno.test("known no-destination routing remains successful without persistence", async () => {
  const { result, writes } = await runUmbrellaStatus({
    title: "Known title", routes: [{ key: "known", podcast_key: null, title: { aliases: ["known title"] } }]
  });
  assertEquals(result.status, "success");
  assertEquals(result.error_count, 0);
  assertEquals(writes, []);
});

Deno.test("unmatched umbrella routing reports partial without persistence", async () => {
  const { result, writes } = await runUmbrellaStatus({
    title: "Absent episode", routes: [{ key: "known", podcast_key: "target", title: { aliases: ["known title"] } }]
  });
  assertEquals(result.status, "partial");
  assertEquals(result.error_count, 1);
  assertEquals(writes, []);
});

Deno.test("ambiguous umbrella routing reports partial without persistence", async () => {
  const { result, writes } = await runUmbrellaStatus({
    title: "Shared title",
    routes: [
      { key: "first", podcast_key: "first", title: { aliases: ["shared title"] } },
      { key: "second", podcast_key: "second", title: { aliases: ["shared title"] } }
    ]
  });
  assertEquals(result.status, "partial");
  assertEquals(result.error_count, 1);
  assertEquals(writes, []);
});

Deno.test("an umbrella routing conflict is reported and never upserted", async () => {
  const { result, writes, logs } = await runUmbrellaStatus({
    title: "Transfer Talk", existing: [episode("guid-1", "Transfer Talk", "")],
    routes: [{ key: "target", podcast_key: "correct target", title: { aliases: ["Transfer Talk"] } }]
  });
  assertEquals(writes, []);
  assertEquals(result.status, "partial");
  assertEquals(result.error_count, 1);
  assertEquals((result.details?.routing as Record<string, unknown>).routing_conflict_count, 1);
  assertEquals(logs.length, 1);
});
