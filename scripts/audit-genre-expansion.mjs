import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payload = JSON.parse(await readFile(path.join(root, "data/podcasts.json"), "utf8"));
const rows = Array.isArray(payload) ? payload : payload.rows;
if (!Array.isArray(rows)) throw new Error("Podcast catalog is missing its rows array.");

const value = (item) => String(item ?? "").trim().replace(/\s+/gu, " ");
const csvCell = (item) => `"${String(item ?? "").replace(/"/gu, '""')}"`;
const genres = new Map();
for (const row of rows) {
  const genre = value(row?.Genre) || "(tom)";
  genres.set(genre, (genres.get(genre) || 0) + 1);
}

// Proposals use exact, structured source genre values only. No title/description
// keyword matching or automatic primary-genre migration is performed.
const proposalByGenre = new Map([
  ["politik", { target: "Politik", reason: "Eksisterende primærgenre er allerede den præcise genreværdi." }],
  ["krig", { target: "Krig", reason: "Eksisterende primærgenre er allerede den præcise genreværdi." }],
  ["finans", { target: "Finans", reason: "Eksisterende primærgenre er allerede den præcise genreværdi." }],
  ["økonomi", { target: "Finans", reason: "Kandidat baseret på den eksisterende strukturerede genreværdi Økonomi; redaktionel kontrol kræves." }],
  ["aktier", { target: "Finans", reason: "Kandidat baseret på den eksisterende strukturerede genreværdi Aktier; redaktionel kontrol kræves." }],
  ["sladder", { target: "", reason: "Beholdes som historisk genre og søgbart indhold indtil en konkret redaktionel omklassificering er godkendt." }]
]);
const candidates = rows.flatMap((row) => {
  const oldGenre = value(row?.Genre);
  const proposal = proposalByGenre.get(oldGenre.toLocaleLowerCase("da-DK"));
  if (!proposal) return [];
  const review = ["økonomi", "aktier", "sladder"].includes(oldGenre.toLocaleLowerCase("da-DK"));
  return [{
    "Podcast-ID": value(row?.["Podcast-ID"]),
    Titel: value(row?.Titel),
    "Gammel primærgenre": oldGenre,
    "Gammel sekundærgenre": value(row?.secondaryGenre),
    "Gammel 3. genre": value(row?.tertiaryGenre),
    "Gamle emner": Array.isArray(row?.topics) ? row.topics.map(value).filter(Boolean).join("; ") : value(row?.Emner),
    "Foreslået primærgenre": proposal.target,
    "Foreslået sekundærgenre": "",
    Begrundelse: proposal.reason,
    "Redaktionel status": review ? "Afventer redaktionel godkendelse" : "Ingen datamigration foreslået"
  }];
});

const output = path.join(root, "audit-genre-expansion");
await mkdir(output, { recursive: true });
const fields = ["Podcast-ID", "Titel", "Gammel primærgenre", "Gammel sekundærgenre", "Gammel 3. genre", "Gamle emner", "Foreslået primærgenre", "Foreslået sekundærgenre", "Begrundelse", "Redaktionel status"];
const csv = [fields.join(";"), ...candidates.map((row) => fields.map((field) => csvCell(row[field])).join(";"))].join("\r\n") + "\r\n";
await writeFile(path.join(output, "genre-reclassification-candidates.csv"), `\uFEFF${csv}`, "utf8");

const counts = [...genres.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"));
const candidateCounts = new Map();
for (const row of candidates) candidateCounts.set(row["Gammel primærgenre"], (candidateCounts.get(row["Gammel primærgenre"]) || 0) + 1);
const report = [
  "# Genre-audit for trinvis genreudvidelse",
  "",
  `Katalog: ${rows.length} podcasts. Kilde: den versionerede Google Sheet-snapshot \`${payload.generatedAt || "ukendt dato"}\`. Auditkørsel: ${new Date().toISOString().slice(0, 10)}.`,
  "",
  "## Eksisterende primærgenrer",
  "",
  "| Genre i kataloget | Antal |",
  "|---|---:|",
  ...counts.map(([genre, count]) => `| ${genre.replace(/\|/gu, "\\|")} | ${count} |`),
  "",
  "## Reviewkandidater",
  "",
  `CSV indeholder ${candidates.length} rækker med præcise, strukturerede kildelabels for de tre nye genrer samt relevante gamle værdier.`,
  "",
  "| Kildelabel | Rækker |",
  "|---|---:|",
  ...[...candidateCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], "da")).map(([genre, count]) => `| ${genre} | ${count} |`),
  "",
  "Politik og Krig findes allerede som primærgenre og kræver ingen Sheet-omskrivning for at blive understøttet. Økonomi og Aktier er kun reviewforslag til Finans. Sladder bevares uændret og får ingen automatisk målgenre.",
  "",
  "Bliv rigere (Podcast-ID: bliv rigere) står med Økonomi og foreslås til Finans i CSV'en. Den er markeret til redaktionel godkendelse; hverken Google Sheet eller katalog-JSON ændres af auditten.",
  "",
  "Ingen automatiske genreændringer blev foretaget. Titler, emneord, podcast-ID'er, episode-ID'er, vurderinger og brugerdata blev ikke brugt som migrationsmål eller skrevet af dette script.",
  ""
].join("\n");
await writeFile(path.join(output, "genre-audit.md"), report, "utf8");
console.log(`Audited ${rows.length} podcasts across ${counts.length} raw primary genres; wrote ${candidates.length} review rows.`);
