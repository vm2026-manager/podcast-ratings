// Editorial metadata derived from the official DR Lyd full-episode records.
// Bind every entry to its immutable catalogue ID and full episode URL.
export const VERIFIED_DR_SERIES_METADATA = Object.freeze({
  "djaevlen-auto-v1-1139735b": Object.freeze({
    title: "Kvinden i Isdalen",
    mainSeries: "Djævlen i detaljen",
    sourceEpisodeGuid: "16122692642",
    sourceUrl: "https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/kvinden-i-isdalen-1-5-et-braendt-lig-16122692642",
    genre: "True Crime",
    topics: ["Isdalskvinden", "Bergen", "Norge", "uopklarede kriminalsager", "1970", "falske identiteter", "kodede notesbøger"],
    shortDescription: "I 1970 finder en familie et forbrændt kvindelig i Isdalen ved Bergen. Sporene fører til falske identiteter, kodede notesbøger og en stadig uløst kriminalgåde.",
    longDescription: "Et fund i Isdalen ved Bergen i november 1970 sætter gang i efterforskningen af en ukendt kvinde. Falske identiteter, parykker, kodede notesbøger og rejser gennem Europa er blandt de spor, der undersøges i sagen. Djævlen i detaljen følger historien om Isdalskvinden og spørgsmålet om, hvem hun var.",
    supplementarySimilarities: ["Manden med de mange navne", "Kvinden med den tunge kuffert"],
    needsEditorialReview: false
  }),
  "bakspejl-auto-v1-4962cdc5": Object.freeze({
    title: "Den spanske borgerkrig",
    mainSeries: "Bakspejl",
    sourceEpisodeGuid: "11162611015",
    sourceUrl: "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/den-spanske-borgerkrig-1-3-11162611015",
    genre: "Historie",
    topics: ["Den spanske borgerkrig", "danske frivillige", "Spanien", "1936", "mellemkrigstiden", "brødrene Harald, Aage og Kai"],
    shortDescription: "I 1936 cykler brødrene Harald, Aage og Kai mod Spanien for at kæmpe som frivillige i borgerkrigen. Bakspejl undersøger, hvad der fik dem og andre danskere til at rejse afsted.",
    longDescription: "I 1936 drager brødrene Harald, Aage og Kai mod Spanien på cykler for at deltage som frivillige i den spanske borgerkrig. Flere hundrede danskere rejser også afsted. Bakspejl fortæller brødrenes historie og undersøger, hvad der fik dem til at forlade Danmark for krigen.",
    supplementarySimilarities: ["Franco", "Europa i krig"],
    needsEditorialReview: false
  })
});

export function metadataForVerifiedDrRecord(record) {
  const id = String(record?.podcast_id ?? record?.["Podcast-ID"] ?? "").trim();
  const metadata = VERIFIED_DR_SERIES_METADATA[id];
  if (!metadata) return null;
  const title = String(record?.title ?? record?.Titel ?? "").trim();
  const series = String(record?.hovedserie ?? record?.Hovedserie ?? "").trim();
  if (title !== metadata.title || series !== metadata.mainSeries) {
    throw new Error(`Verified DR metadata identity mismatch for ${id}`);
  }
  return metadata;
}
