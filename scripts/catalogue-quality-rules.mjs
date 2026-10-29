import { CANONICAL_GENRES } from "./catalogue-intake.mjs";

const normalize = (input) => String(input ?? "").trim().replace(/\s+/gu, " ");
const rules = [
  ["True Crime", [["genre phrase", /\btrue crime\b|\bsand kriminalsag|\bdokumentarisk kriminal/iu], ["investigation", /\bkriminalefterforsk|\bpolitiefterforsk|\bkriminalsag|\bkriminalhistor/iu], ["serious offense", /\bdrabssag|\bmordgåde|\bseriemorder|\buopklaret drab|\bforbrydelse og straf/iu]]],
  ["Historie", [["period", /\bmiddelalder|\bvikingetid|\bromerrige|\brenæssance|\b1900.tallet|\b1800.tallet/iu], ["source", /\bhistorisk arkiv|\barkivoptagelse|\bdanmarkshistor|\bfortidens|\bfortællinger fra arkivet/iu], ["documented past", /\bverdenskrig|\bborgerkrig|\bbesættelsestid|\bhistoriske begivenheder|\bhistorisk dokumentar/iu]]],
  ["Krig", [["armed conflict", /\bverdenskrig|\bborgerkrig|\bkrigsforbryd|\bkrigszone|\bkrigshandling|\bvæbnet konflikt/iu], ["military", /\bfrontlinje|\bkrigsfotograf|\bsoldat|\bveteran|\bhærfører|\bmilitær operation|\bmilitærhistor/iu], ["invasion and occupation", /\binvasion|\bbesættelsestid|\bmodstandsmand|\bmodstandsbevæg|\bfronten|\bkrigens børn/iu]]],
  ["Politik", [["elections", /\bvalgkamp|\bfolketingsvalg|\bvalgresultat|\bpolitiske partier|\bkandidat til valg/iu], ["government", /\bregering|\bfolketing|\bparlament|\bminister(?:en|iet)?|\blovforslag|\bpolitisk beslutning/iu], ["public affairs", /\bdansk politik|\budenrigspolit|\bpolitisk journalist|\bmagten i danmark/iu]]],
  ["Finans", [["investment", /\binvestering|\baktiehandel|\baktieanalyse|\bportefølje|\bbørsmarked/iu], ["personal finance", /\bprivatøkonomi|\bpension|\bboliglån|\brente(?:n|r)?|\bopsparing/iu], ["markets", /\bmakroøkonomi|\bkonjunktur|\bfinansmarked|\bøkonomisk politik|\bvirksomhedsøkonomi/iu]]],
  ["Samfund", [["institutions", /\bvelfærd|\bsundhedsvæsen|\buddannelsessystem|\bsocialpolitik|\boffentlig sektor/iu], ["social life", /\bidentitet|\bfællesskab|\bulighed|\bklasserejse|\btrivsel|\bmental sundhed/iu], ["societal reporting", /\bsamfundsdebat|\bsamfundsudvikling|\bdanskere og samfund|\baktuelle samfundsforhold/iu]]],
  ["Sport", [["football", /\bfodboldhold|\bfodboldklub|\bsuperliga|\bpremier league|\blandsholdet|\bfodboldkamp/iu], ["other sports", /\bcykelløb|\bcykelsport|\btennisturnering|\bhåndboldhold|\bolympiske lege|\bsportsgren/iu], ["competition", /\bkampreferat|\bturnering|\bmesterskab|\btræningsprogram|\bsportsjournalistik/iu]]],
  ["Dokumentar", [["format", /\bdokumentarserie|\bdokumentarpodcast|\bdokumentarfortælling|\bundersøgende podcast/iu], ["real story", /\bvirkelige historier|\bvirkelige hændelser|\bdokumenteret fortælling|\bjournalistisk undersøg/iu], ["sources", /\binterviews med (?:vidner|overlevende|eksperter)|båndoptagelser|\barkivmateriale|\bpersonlige beretninger/iu]]],
  ["Viden", [["science", /\bforskning|\bforskerne|\bvidenskab|\beksperiment|\bneurovidenskab|\bklimaforskning/iu], ["learning", /\bforklarer|\blær om|\bviden om|\bvidenskabelig forklaring|\bfaglig indsigt/iu], ["technical topic", /\bteknologi|\bbiologi|\bfysik|\bmatematik|\bsprogvidenskab|\bmedicin/iu]]],
  ["Underholdning", [["comedy", /\bkomedie|\bhumor|\bsatire|\bunderholdningsprogram|\bsjov samtale/iu], ["popular culture", /\bpopkultur|\breality.tv|\bkendte danskere|\bfilm og tv|\bmusikscene/iu], ["performance", /\bskønlitterær|\bfiktion|\bdramatisering|\bskuespil|\bfortælling for børn/iu]]]
];
const topicRules = [
  ["2. verdenskrig", /\b2\. verdenskrig|\banden verdenskrig|\bverdenskrig/iu],
  ["Borgerkrig", /\bborgerkrig/iu],
  ["Modstandskamp", /\bmodstandsmand|\bmodstandsbevæg|\bmodstandskamp/iu],
  ["Militærhistorie", /\bmilitærhistor|\bkrigsfotograf|\bhærfører/iu],
  ["Ukraine", /\bukraine|\bukrainsk/iu],
  ["Rusland", /\brusland|\brussisk/iu],
  ["Investering", /\binvestering|\binvestere|\binvesteringsstrateg/iu],
  ["Privatøkonomi", /\bprivatøkonomi|\bpersonlig økonomi/iu],
  ["Aktier", /\baktier|\baktiehandel|\baktieanalyse/iu],
  ["Fodbold", /\bfodboldhold|\bfodboldklub|\bsuperliga|\bfodboldkamp/iu],
  ["Cykling", /\bcykelløb|\bcykelsport|\bcykelryt/iu],
  ["Folketingsvalg", /\bfolketingsvalg|\bvalgkamp til folketing/iu],
  ["Dansk politik", /\bdansk politik|\bdansk politisk|\bdanske politiske partier/iu],
  ["Velfærd", /\bvelfærd|\bsundhedsvæsen|\bsocialpolitik/iu],
  ["Videnskab", /\bvidenskab|\bvidenskabelig|\bforskning/iu],
  ["True crime", /\btrue crime\b|\bkriminalsag|\bdrabssag|\buopklaret drab/iu],
  ["Reality-tv", /\breality.tv|\brealityformat/iu],
  ["Kendisliv", /\bkendisliv|\bkendte danskere|\bkendispodcast/iu]
];

export function suggestGenres(row, sourceVerified = false) {
  const fields = [
    ["Titel", normalize(row?.Titel)],
    ["Kort beskrivelse", normalize(row?.["Kort beskrivelse"])],
    ["Lang beskrivelse", normalize(row?.["Lang beskrivelse"])],
    ["Emner", Array.isArray(row?.topics) ? row.topics.map(normalize).join("; ") : normalize(row?.Emner)]
  ].filter((item) => item[1]);
  const found = [];
  for (const [genre, families] of rules) {
    const hits = [];
    const usedFields = new Set();
    for (const [family, pattern] of families) {
      const matches = fields.filter((item) => pattern.test(item[1]));
      if (matches.length) {
        hits.push(family);
        matches.forEach((item) => usedFields.add(item[0]));
      }
    }
    if (hits.length >= 2 && usedFields.size >= 2) {
      found.push({
        genre,
        evidence: hits.join(", ") + "; felter: " + [...usedFields].join(", "),
        confidence: hits.length >= 3 && usedFields.size >= 3 && sourceVerified ? "Høj" : "Middel",
        score: hits.length
      });
    }
  }
  return found.sort((a, b) => b.score - a.score || CANONICAL_GENRES.indexOf(a.genre) - CANONICAL_GENRES.indexOf(b.genre));
}

export function suggestSearchTopics(row, currentTopics = []) {
  const fields = [
    ["Titel", normalize(row?.Titel)],
    ["Kort beskrivelse", normalize(row?.["Kort beskrivelse"])],
    ["Lang beskrivelse", normalize(row?.["Lang beskrivelse"])],
    ["Emner", Array.isArray(row?.topics) ? row.topics.map(normalize).join("; ") : normalize(row?.Emner)]
  ].filter((item) => item[1]);
  const existing = new Set(currentTopics.map((topic) => normalize(topic).normalize("NFKC").toLocaleLowerCase("da-DK")));
  return topicRules.flatMap(([topic, pattern]) => {
    const matches = fields.filter((item) => pattern.test(item[1]));
    const matchedFields = [...new Set(matches.map((item) => item[0]))];
    const currentTopicAlreadyCoversConcept = currentTopics.some((item) => pattern.test(normalize(item)));
    if (matchedFields.length < 2 || existing.has(topic.normalize("NFKC").toLocaleLowerCase("da-DK")) || currentTopicAlreadyCoversConcept) return [];
    return [{ topic, evidence: "Felter: " + matchedFields.join(", "), confidence: "Middel" }];
  });
}
