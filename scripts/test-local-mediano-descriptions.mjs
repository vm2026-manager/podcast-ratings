import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf("const LOCAL_CANONICAL_CATALOGUE_ROWS");
const end = app.indexOf("// Registry-derived", start);
assert.ok(start >= 0 && end > start, "local Mediano catalogue rows must exist");

const context = { Object };
vm.runInNewContext(
  app.slice(start, end).replace("const LOCAL_CANONICAL_CATALOGUE_ROWS", "globalThis.rows"),
  context
);

const expected = new Map([
  ["magasinet jennings", {
    title: "Magasinet Jennings",
    manualEpisodes: undefined,
    short: "Medianos kritiske magasin om fodbolden uden for banen – blandt andet FIFA, sportspolitik, ejerskaber, betting og forholdet mellem sport og samfund.",
    long: "Magasinet Jennings er opkaldt efter den undersøgende journalist Andrew Jennings. Formatet behandler de store historier uden for selve fodboldbanen kritisk, nysgerrigt og grundigt – blandt andet FIFA og VM, sportspolitik, fodboldens ejerskaber, betting og ludomani samt sportens rolle i samfundet."
  }],
  ["mediano special", {
    title: "Mediano Special",
    short: "Medianos specialudsendelser, der går i dybden med en aktuel sag, klub eller historie fra fodboldens verden.",
    long: "Mediano Special samler udsendelser, hvor Mediano sætter ekstra tid af til én konkret historie. Det kan være en klub i forandring, ejerskab og strategi, talentudvikling, stadionprojekter eller andre aktuelle fodboldhistorier, som bliver foldet ud med interviews, analyse og perspektiv.",
    manualEpisodes: ["Sagen om de 15 point, forsvandt fra i lommen af Den Gamle Dame", { title: "Mediano special: hvad siger data om superligaen?", manualEpisodeKey: "mediano-special-hvad-siger-data-om-superligaen" }]
  }],
  ["transfer special", {
    title: "Transfer Special",
    short: "Medianos transferserie, hvor eksperter går klubberne efter i sømmene og ser på handler, økonomi, strategi, talentplan og den sportslige retning.",
    long: "Transfer Special går i dybden med klubbernes arbejde på transfermarkedet. Medianos eksperter ser ikke kun på køb og salg, men også på økonomi, strategi, brugen af egne talenter og hvor klubben er på vej hen.",
    manualEpisodes: ["Her er vores bud på de ti spillere, har været de største transfersucceser i Superligaen"]
  }],
  ["bruchmann ringer til", {
    title: "Brüchmann ringer til",
    short: "Peter Brüchmann ringer til profiler i og omkring Superligaen til samtaler om klubber, ledelse, trænerarbejde og aktuelle fodboldspørgsmål.",
    long: "Brüchmann ringer til er Medianos interviewformat om Superligaen, hvor Peter Brüchmann taler med direktører, sportsdirektører, trænere og andre profiler i og omkring ligaen. Udsendelserne kan være et længere enkeltinterview eller et mere magasinagtigt format med flere samtaler og går tæt på klubbernes retning, strategi, transfers og sportslige valg.",
    manualEpisodes: ["Kristjaan Speakmann"]
  }],
  ["der var engang et mal", {
    title: "Der var engang et mål",
    short: "Medianos serie om ikoniske scoringer og historierne omkring dem – med analyse, fodboldhistorie og kontekst.",
    long: "Der var engang et mål tager udgangspunkt i en mindeværdig scoring og bruger den som indgang til en større fodboldhistorie. Værter og eksperter genbesøger kampens og spillerens betydning, den taktiske detalje og den tid, klub eller kultur som målet blev en del af.",
    manualEpisodes: ["Der var engang et mål...af Peter Møller mod Farum"]
  }]
]);

for (const [id, expectedRow] of expected) {
  const row = context.rows.find((candidate) => candidate["Podcast-ID"] === id);
  assert.ok(row, `${id} must retain its canonical local row`);
  assert.equal(row.Titel, expectedRow.title, `${id} must retain its title`);
  assert.equal(row["Kort beskrivelse"], expectedRow.short, `${id} must retain its reviewed short description`);
  assert.equal(row["Lang beskrivelse"], expectedRow.long, `${id} must retain its reviewed long description`);
  if (expectedRow.manualEpisodes !== undefined) {
    assert.deepEqual(JSON.parse(JSON.stringify(row.manualEpisodes)), expectedRow.manualEpisodes, `${id} manual episodes must stay unchanged`);
  }
}

assert.equal(context.rows.find((row) => row["Podcast-ID"] === "magasinet jennings").Link, "https://www.mediano.nu/oversigt/tag/Jennings");
assert.equal(context.rows.find((row) => row["Podcast-ID"] === "magasinet jennings").Feed, "https://www.spreaker.com/show/6169233/episodes/feed");
assert.match(app, /Brüchmann ringer til/u);
assert.match(app, /Der var engang et mål/u);
assert.match(app, /undersøgende/u);
assert.match(app, /økonomi/u);

console.log("Local Mediano description regression checks passed.");
