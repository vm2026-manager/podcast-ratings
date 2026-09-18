import { readFile, writeFile } from "node:fs/promises";

const CATEGORY = {
  A: "EXISTING CANONICAL SERIES — SAFE ROUTE EXTENSION",
  B: "EXISTING DISTINCT PODCAST IN CATALOGUE",
  C: "REAL SERIES, BUT NOT IN CATALOGUE",
  D: "DEDICATED-FEED OVERLAP",
  E: "GENERIC / ONE-OFF / SPECIAL CONTENT",
  F: "NEEDS MANUAL EDITORIAL DECISION"
};

function classify(title) {
  if (/^(MAX UPDATE|Max Update|MAX MEDIANO SPECIAL|Mediano PL Special)/iu.test(title)) {
    return ["A", "Verified explicit format name for an existing canonical destination; added as a bounded title-prefix alias."];
  }
  if (/^(Superliga for Voksne(?:\s*(?:#|:|-|–|—))|MINI MAX|Fodbold var værre i 70)/iu.test(title)) {
    return ["B", "Distinct Mediano series with a current, verified catalogue Podcast-ID; enabled through its explicit title prefix."];
  }
  // Explicitly named, recurring tournament coverage remains pending until a
  // catalogue identity exists. Date/country variants deliberately do not get
  // a broad routing expression.
  if (/^(PL PREVIEW|Premier League Update|DET SPILLER IKKE|MEDIANO CL|Mediano Futsal|Mediano VM|Mediano Sócrates|Mediano Talks|HILLSBOROUGH|SUPERLIGAENS STØRSTE ØJEBLIKKE)/iu.test(title)) {
    return ["C", "Clearly recurring named Mediano format without a current catalogue identity; it is held pending, never routed to a parent show."];
  }
  if (/^EM MORGENSHOW\s/u.test(title) || /^EM OPTAKT\s/u.test(title)) {
    return ["C", "Recurring EM coverage, but no catalogue destination; variable date/country prefixes are intentionally not generalized."];
  }
  if (/^(MEDIANO CL|Mediano Doc|Mediano Special|MEDIANO SPECIAL|Europa Special|EUROPA SPECIAL|Pokal Special|VM Special|EM Special|Champions League Special|Premier League Special|LA LIGA SPECIAL|Brøndby Special|FC Midtjylland Special|Finale Special|Lørdag Special|Søndags Special|Julefrokost Special|Træner Special|HILLSBOROUGH|BONUS|MÅNEDENS STØT|TEASER|Teaser|SUPERLIGAENS MEST|MAX TRANSFER|MAX MEDIANO SPECIAL|Mediano PL Special|Mediano Superliga \d|SUPERLIGA \d|Superliga \d|SUPERLIGAEN|Superligaen|SUPERLIGA OPTAKT|SUPERLIGA-OPTAKT|SUPERLIGA STATUS|STATUS PÅ SUPERLIGAEN|DEN STORE|Pokal Preview|Mediano Superliga Update|EfB Special|Mediano Talks|Mediano Futsal|Mediano VM|Mediano Sócrates|MINI MAX|Fodbold var værre)/u.test(title)) {
    return ["E", "Special, event, teaser, recap, or legacy-format presentation without a remaining safe standalone canonical route."];
  }
  return ["F", "Title does not establish a safe recurring identity or canonical destination from the current catalogue."];
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) throw new Error("Usage: node scripts/review-mediano-unmatched.mjs <audit.json> <review.json>");
  const audit = JSON.parse(await readFile(inputPath, "utf8"));
  const items = audit.unmatchedItems.map((item) => {
    const [category, rationale] = classify(item.title);
    return { ...item, category, categoryLabel: CATEGORY[category], rationale };
  });
  const counts = Object.fromEntries(Object.keys(CATEGORY).map((key) => [key, items.filter((item) => item.category === key).length]));
  await writeFile(outputPath, `${JSON.stringify({ sourceAudit: inputPath, total: items.length, categories: CATEGORY, counts, items }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ total: items.length, counts }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
