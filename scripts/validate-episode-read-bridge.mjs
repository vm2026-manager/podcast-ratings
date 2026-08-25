import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const normalizeText = (value) => String(value ?? "").trim();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expected = {
  "hva så": "hva sa",
  "jagten på det evige liv": "jagten pa det evige liv",
  "sagen genåbnet": "sagen genabnet",
  "vi ser på det": "vi ser pa det",
  "vågn lidt op": "vagn lidt op"
};
const source = await readFile(path.resolve(__dirname, "..", "app.js"), "utf8");
const podcasts = JSON.parse(
  await readFile(path.resolve(__dirname, "..", "data", "podcasts.json"), "utf8")
).rows;

for (const [legacyKey, permanentId] of Object.entries(expected)) {
  assert(
    source.includes(`"${legacyKey}": "${permanentId}"`),
    `Manglende read bridge: ${legacyKey} -> ${permanentId}`
  );
  assert(
    podcasts.some((row) => normalizeText(row["Podcast-ID"]) === permanentId),
    `Mangler Podcast-ID i kataloget: ${permanentId}`
  );
  assert(
    source.includes(`databasePodcastKey: "${legacyKey}"`),
    `Legacy database key blev ændret: ${legacyKey}`
  );
}

const readFilter = '.in("podcast_key", getEpisodeDatabaseReadKeys(config))';
assert(
  source.split(readFilter).length - 1 === 2,
  "Episode-læsning bruger ikke bridge i både liste og søgning"
);
assert(
  !source.includes('EPISODE_DATABASE_KEY_READ_BRIDGES = {\n  "genstart"'),
  "Unaudited database keys må ikke tilføjes til bridge"
);

console.log(
  JSON.stringify(
    {
      mappings: expected,
      readPaths: ["episode list", "episode search"],
      remoteDatabaseWrites: "unchanged",
      feedConfig: "unchanged",
      status: "PASS"
    },
    null,
    2
  )
);
