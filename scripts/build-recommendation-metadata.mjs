import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_INPUT_PATH = path.join(REPO_ROOT, "data", "podcasts.json");
const DEFAULT_ALIAS_PATH = path.join(REPO_ROOT, "config", "recommendation-topic-aliases.json");
const DEFAULT_GENRE_MAPPING_PATH = path.join(
  REPO_ROOT,
  "config",
  "recommendation-genre-mapping.json"
);
const DEFAULT_OUTPUT_PATH = path.join(REPO_ROOT, "data", "recommendation-metadata.json");
const DEFAULT_READINESS_PATH = path.join(
  REPO_ROOT,
  "audit-recommendation-metadata",
  "recommendation-readiness.md"
);
const DEFAULT_IDENTITY_CSV_PATH = path.join(
  REPO_ROOT,
  "audit-recommendation-metadata",
  "recommendation-identity-collisions.csv"
);
const DEFAULT_IDENTITY_REPORT_PATH = path.join(
  REPO_ROOT,
  "audit-recommendation-metadata",
  "recommendation-identity.md"
);
const DEFAULT_GENRE_CSV_PATH = path.join(
  REPO_ROOT,
  "audit-recommendation-metadata",
  "recommendation-genre-migration.csv"
);
const DEFAULT_GENRE_UNMAPPED_CSV_PATH = path.join(
  REPO_ROOT,
  "audit-recommendation-metadata",
  "recommendation-genre-unmapped.csv"
);
const DEFAULT_GENRE_REPORT_PATH = path.join(
  REPO_ROOT,
  "audit-recommendation-metadata",
  "recommendation-genre-migration.md"
);
const DEFAULT_TOPIC_COLLISION_CSV_PATH = path.join(
  REPO_ROOT,
  "audit-recommendation-metadata",
  "topic-key-collisions.csv"
);
const DEFAULT_TOPIC_COLLISION_REPORT_PATH = path.join(
  REPO_ROOT,
  "audit-recommendation-metadata",
  "topic-key-collisions.md"
);

const ALLOWED_GENRES = Object.freeze([
  "True Crime",
  "Historie",
  "Samfund",
  "Sport",
  "Dokumentar",
  "Viden",
  "Underholdning",
  "Sladder"
]);
const ALIAS_TYPES = new Set([
  "capitalization",
  "whitespace",
  "spelling",
  "singular_plural",
  "synonym",
  "broader_narrower",
  "deprecated"
]);
const ALIAS_STATUSES = new Set(["approved", "review", "rejected"]);
const GENRE_MAPPING_TYPES = new Set([
  "canonical",
  "capitalization",
  "spelling",
  "direct",
  "conditional_default"
]);
const GENRE_MAPPING_STATUSES = new Set(["approved", "review", "rejected"]);

function normalizeText(value) {
  return String(value ?? "").normalize("NFC").trim();
}

function collapseWhitespace(value) {
  return normalizeText(value).replace(/\s+/gu, " ");
}

function aliasKey(value) {
  return collapseWhitespace(value).normalize("NFKC").toLocaleLowerCase("da-DK");
}

function topicDisplay(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function topicIdentity(value) {
  return topicDisplay(value).toLocaleLowerCase("da-DK");
}

function podcastKey(value) {
  return normalizeText(value)
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/&/gu, " og ")
    .replace(/[^a-z0-9æøå ]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function topicKey(value) {
  const key = collapseWhitespace(value)
    .toLocaleLowerCase("da-DK")
    .replace(/æ/gu, "ae")
    .replace(/ø/gu, "oe")
    .replace(/å/gu, "aa")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/&/gu, " og ")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-+/gu, "-");

  if (!key) {
    throw new Error(`Topic key is empty for canonical topic ${JSON.stringify(value)}.`);
  }
  return key;
}

const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "yclid",
  "ttclid",
  "twclid",
  "wbraid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
  "ref",
  "referrer"
]);

function normalizeIdentityText(value) {
  return collapseWhitespace(value).normalize("NFKC").toLocaleLowerCase("da-DK");
}

function normalizeHostIdentity(value) {
  const normalized = normalizeIdentityText(value);
  if (!normalized) return [];
  return normalized
    .split(/\s*(?:&|,|;|\||\/|\bog\b)\s*/gu)
    .map(collapseWhitespace)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "da"));
}

function normalizeUrlIdentity(value) {
  const raw = normalizeText(value);
  if (!raw) return "";

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Cannot normalize identity URL ${JSON.stringify(raw.slice(0, 180))}.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported identity URL protocol in ${JSON.stringify(raw.slice(0, 180))}.`);
  }

  url.hostname = url.hostname.toLocaleLowerCase("en-US");
  url.hash = "";
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/gu, "");
  }

  const retained = Array.from(url.searchParams.entries())
    .filter(([key]) => {
      const normalizedKey = key.toLocaleLowerCase("en-US");
      return !normalizedKey.startsWith("utm_") && !TRACKING_QUERY_KEYS.has(normalizedKey);
    })
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    );
  url.search = "";
  retained.forEach(([key, queryValue]) => url.searchParams.append(key, queryValue));
  return url.toString();
}

function normalizeImageIdentity(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  if (/^https?:\/\//iu.test(raw)) return normalizeUrlIdentity(raw);
  return raw.replace(/\\/gu, "/").replace(/\/+/gu, "/").toLocaleLowerCase("da-DK");
}

function recommendationSlug(value) {
  return topicKey(value).slice(0, 56);
}

function identityHash(material) {
  return createHash("sha256").update(JSON.stringify(material), "utf8").digest("hex");
}

function buildBaseIdentityMaterial(sourceRow, title, mainSeries) {
  return {
    version: 1,
    title: podcastKey(title),
    mainSeries: normalizeIdentityText(mainSeries),
    publisher: normalizeIdentityText(sourceRow?.Udgiver),
    hosts: normalizeHostIdentity(sourceRow?.["Vært"] ?? sourceRow?.Vaert),
    link: normalizeUrlIdentity(sourceRow?.Link),
    year: normalizeIdentityText(sourceRow?.["Årstal afspillet"]),
    episodes: normalizeIdentityText(sourceRow?.["Antal afsnit"])
  };
}

function buildIdentityMaterials(sourceRow, title, mainSeries) {
  const expanded = buildBaseIdentityMaterial(sourceRow, title, mainSeries);
  if (expanded.link) {
    return {
      primary: {
        version: 1,
        strategy: "title-link",
        title: expanded.title,
        link: expanded.link
      },
      primaryBasis: "title+link",
      expanded,
      expandedBasis: "title+mainSeries+publisher+hosts+link+year+episodes"
    };
  }
  return {
    primary: {
      version: 1,
      strategy: "metadata-without-link",
      title: expanded.title,
      mainSeries: expanded.mainSeries,
      publisher: expanded.publisher,
      hosts: expanded.hosts,
      year: expanded.year,
      episodes: expanded.episodes
    },
    primaryBasis: "title+mainSeries+publisher+hosts+year+episodes",
    expanded,
    expandedBasis: "title+mainSeries+publisher+hosts+link+year+episodes"
  };
}

function assignRecommendationIds(rows) {
  const byPrimaryMaterial = new Map();
  rows.forEach((row) => {
    const serialized = JSON.stringify(row._identity.primary);
    if (!byPrimaryMaterial.has(serialized)) byPrimaryMaterial.set(serialized, []);
    byPrimaryMaterial.get(serialized).push(row);
  });

  rows.forEach((row) => {
    const primarySerialized = JSON.stringify(row._identity.primary);
    const primaryCollision = byPrimaryMaterial.get(primarySerialized).length > 1;
    row._identity.selected = primaryCollision ? row._identity.expanded : row._identity.primary;
    row._identity.selectedBasis = primaryCollision
      ? row._identity.expandedBasis
      : row._identity.primaryBasis;
  });

  const bySelectedMaterial = new Map();
  rows.forEach((row) => {
    const serialized = JSON.stringify(row._identity.selected);
    if (!bySelectedMaterial.has(serialized)) bySelectedMaterial.set(serialized, []);
    bySelectedMaterial.get(serialized).push(row);
  });

  rows.forEach((row) => {
    const selectedSerialized = JSON.stringify(row._identity.selected);
    const selectedCollision = bySelectedMaterial.get(selectedSerialized).length > 1;
    const material = selectedCollision
      ? { ...row._identity.selected, image: row._identity.image }
      : row._identity.selected;
    if (selectedCollision && !row._identity.image) {
      throw new Error(
        `Recommendation identity needs a discriminator for ${JSON.stringify(row.title)} ` +
          `(${JSON.stringify(row.id)}), but its image identity is empty.`
      );
    }
    const hash = identityHash(material);
    row.recommendationId = `rec-${recommendationSlug(row.title)}-${hash.slice(0, 32)}`;
    row.recommendationIdentityBasis = selectedCollision
      ? `${row._identity.selectedBasis}+image`
      : row._identity.selectedBasis;
    delete row._identity;
  });

  const recommendationIds = new Map();
  rows.forEach((row) => {
    if (!row.recommendationId) {
      throw new Error(`Empty recommendationId for ${JSON.stringify(row.title)}.`);
    }
    const previous = recommendationIds.get(row.recommendationId);
    if (previous) {
      throw new Error(
        `RecommendationId collision ${JSON.stringify(row.recommendationId)} between ` +
          `${JSON.stringify(previous.title)} and ${JSON.stringify(row.title)}.`
      );
    }
    recommendationIds.set(row.recommendationId, row);
  });
  if (recommendationIds.size !== rows.length) {
    throw new Error(
      `Recommendation identity count mismatch: ${recommendationIds.size} ids for ${rows.length} rows.`
    );
  }
}

function preserveExistingRecommendationIds(rows, existingPayload) {
  const existingRows = Array.isArray(existingPayload?.rows) ? existingPayload.rows : [];
  if (!existingRows.length) return 0;
  const existingById = new Map();
  const currentById = new Map();
  existingRows.forEach((row) => {
    if (!existingById.has(row.id)) existingById.set(row.id, []);
    existingById.get(row.id).push(row);
  });
  rows.forEach((row) => {
    if (!currentById.has(row.id)) currentById.set(row.id, []);
    currentById.get(row.id).push(row);
  });

  let preserved = 0;
  currentById.forEach((currentRows, id) => {
    const previousRows = existingById.get(id) ?? [];
    if (currentRows.length !== 1 || previousRows.length !== 1) return;
    const previousId = normalizeText(previousRows[0].recommendationId);
    if (!previousId) return;
    currentRows[0].recommendationId = previousId;
    preserved += 1;
  });

  const seen = new Map();
  rows.forEach((row) => {
    const previous = seen.get(row.recommendationId);
    if (previous) {
      throw new Error(
        `RecommendationId collision ${JSON.stringify(row.recommendationId)} between ` +
          `${JSON.stringify(previous.title)} and ${JSON.stringify(row.title)} after preservation.`
      );
    }
    seen.set(row.recommendationId, row);
  });
  return preserved;
}

function sortedDistinct(values) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean))).sort((left, right) =>
    normalizeIdentityText(left).localeCompare(normalizeIdentityText(right), "da")
  );
}

function classifyExistingIdCollision(existingId, entries) {
  const sources = entries.map((entry) => entry.sourceRow);
  const links = sortedDistinct(sources.map((row) => row?.Link));
  const publishers = sortedDistinct(sources.map((row) => row?.Udgiver));
  const images = sortedDistinct(sources.map((row) => row?.Billedlink));
  const normalizedLinks = new Set(links.map(normalizeUrlIdentity).filter(Boolean));
  const normalizedPublishers = new Set(publishers.map(normalizeIdentityText).filter(Boolean));
  const normalizedImages = new Set(images.map(normalizeImageIdentity).filter(Boolean));
  let classification = "unresolved";
  let severity = "review";
  let note =
    "Titel-nøglen er ens, men de tilgængelige identitetsfelter er utilstrækkelige til sikker gruppering.";

  if (
    normalizedLinks.size === 1 &&
    sources.every((row) => normalizeText(row?.Link)) &&
    normalizedPublishers.size <= 1
  ) {
    classification = "exact_duplicate";
    severity = "informational";
    note =
      "Samme titel, udgiver og konkrete link peger på samme podcast; posterne bevares separat.";
  } else if (normalizedPublishers.size === 1 || normalizedImages.size === 1) {
    classification = "likely_duplicate";
    note =
      "Samme titel og udgiver eller cover peger på en sandsynlig dublet, men metadata afviger.";
  }

  const collision = {
    existing_id: existingId,
    row_count: entries.length,
    titles: sortedDistinct(sources.map((row) => row?.Titel)).join(" | "),
    hosts: sortedDistinct(sources.map((row) => row?.["Vært"] ?? row?.Vaert)).join(" | "),
    publishers: publishers.join(" | "),
    main_series: sortedDistinct(sources.map((row) => row?.Hovedserie)).join(" | "),
    years: sortedDistinct(sources.map((row) => row?.["Årstal afspillet"])).join(" | "),
    links: links.join(" | "),
    classification,
    proposed_identity_basis: sortedDistinct(
      entries.map((entry) => entry.outputRow.recommendationIdentityBasis)
    ).join(" | "),
    severity,
    note
  };

  if (classification === "exact_duplicate") {
    const duplicateGroup = `dup-${identityHash({ version: 1, existingId }).slice(0, 20)}`;
    entries.forEach((entry) => {
      entry.outputRow.identityDuplicateGroup = duplicateGroup;
    });
  }
  return collision;
}

function auditExistingIds(sourceRows, outputRows) {
  const groups = new Map();
  outputRows.forEach((outputRow, index) => {
    if (!groups.has(outputRow.id)) groups.set(outputRow.id, []);
    groups.get(outputRow.id).push({ sourceRow: sourceRows[index], outputRow });
  });
  return Array.from(groups, ([existingId, entries]) => ({ existingId, entries }))
    .filter((group) => group.entries.length > 1)
    .sort((left, right) => left.existingId.localeCompare(right.existingId, "da"))
    .map((group) => classifyExistingIdCollision(group.existingId, group.entries));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[;"\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function renderIdentityCsv(collisions) {
  const fields = [
    "existing_id",
    "row_count",
    "titles",
    "hosts",
    "publishers",
    "main_series",
    "years",
    "links",
    "classification",
    "proposed_identity_basis",
    "severity",
    "note"
  ];
  const lines = [
    fields.join(";"),
    ...collisions.map((collision) =>
      fields.map((field) => csvCell(collision[field])).join(";")
    )
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

function renderIdentityReport(collisions, summary) {
  const sections = collisions.map(
    (collision, index) => `### ${index + 1}. \`${collision.existing_id}\`

- Titler: ${collision.titles || "—"}
- Værter: ${collision.hosts || "—"}
- Udgivere: ${collision.publishers || "—"}
- Hovedserier: ${collision.main_series || "—"}
- Årstal: ${collision.years || "—"}
- Links: ${collision.links || "—"}
- Klassifikation: \`${collision.classification}\`
- Alvor: \`${collision.severity}\`
- Anvendt/foreslået identitetsgrundlag: \`${collision.proposed_identity_basis}\`
- Vurdering: ${collision.note}
`
  );
  return `# Recommendation identity audit

## Resultat

- Podcastposter: ${summary.podcasts}
- Unikke eksisterende \`id\`: ${summary.uniqueExistingIds}
- Dublerede eksisterende \`id\`: ${summary.duplicateStableIdValues}
- Poster berørt af dublerede eksisterende \`id\`: ${summary.podcastsSharingStableId}
- Unikke \`recommendationId\`: ${summary.uniqueRecommendationIds}
- \`recommendationId\`-kollisioner: ${summary.recommendationIdCollisions}
- Eksakte dubletgrupper: ${summary.exactDuplicateGroups}
- Sandsynlige dubletgrupper: ${summary.likelyDuplicateGroups}
- Uafklarede identitetsgrupper: ${summary.unresolvedIdentityGroups}

Kildedata indeholder intet sikkert source-id. \`recommendationId\` bruger derfor en trinvis,
deterministisk SHA-256-fingerprint. Poster med link bruger normaliseret titel og link først.
Poster uden link bruger titel, hovedserie, udgiver, værter, årstal og antal afsnit. Hvis det
primære materiale kolliderer, udvides fingerprinten med alle disse metadatafelter og link.
Kun hvis det stadig kolliderer, tilføjes normaliseret coveridentitet som discriminator.
Arrayposition, ranglisteplacering og buildtid indgår aldrig.

Eksakte dubletter bevares som separate poster og får forskellige \`recommendationId\`.
\`identityDuplicateGroup\` sættes kun for de sikre \`exact_duplicate\`-grupper. Sandsynlige og
uafklarede grupper markeres til review og grupperes ikke automatisk.

## De 11 eksisterende titel-id-kollisioner

${sections.join("\n")}
`;
}

function validateAliasConfig(config) {
  if (!config || typeof config !== "object" || !Number.isInteger(config.version)) {
    throw new Error("Alias config must contain an integer version.");
  }
  if (!Array.isArray(config.aliases)) {
    throw new Error("Alias config must contain an aliases array.");
  }

  const approvedLookup = new Map();
  const configuredLookup = new Map();
  config.aliases.forEach((entry, index) => {
    const alias = normalizeText(entry?.alias);
    const canonical = normalizeText(entry?.canonical);
    const type = normalizeText(entry?.type);
    const status = normalizeText(entry?.status);
    if (!alias || !canonical) {
      throw new Error(`Alias entry ${index + 1} must contain alias and canonical values.`);
    }
    if (!ALIAS_TYPES.has(type)) {
      throw new Error(`Alias entry ${index + 1} has unsupported type ${JSON.stringify(type)}.`);
    }
    if (!ALIAS_STATUSES.has(status)) {
      throw new Error(`Alias entry ${index + 1} has unsupported status ${JSON.stringify(status)}.`);
    }

    const key = aliasKey(alias);
    if (configuredLookup.has(key)) {
      throw new Error(`Duplicate configured alias after normalization: ${JSON.stringify(alias)}.`);
    }
    const normalizedEntry = {
      alias,
      canonical,
      type,
      status,
      note: normalizeText(entry?.note)
    };
    configuredLookup.set(key, normalizedEntry);
    if (status === "approved") approvedLookup.set(key, normalizedEntry);
  });

  return { approvedLookup, configuredLookup };
}

function validateGenreConfig(config) {
  if (!config || typeof config !== "object" || !Number.isInteger(config.version)) {
    throw new Error("Genre config must contain an integer version.");
  }
  if (
    !Array.isArray(config.allowedGenres) ||
    config.allowedGenres.length !== ALLOWED_GENRES.length ||
    config.allowedGenres.some((genre, index) => genre !== ALLOWED_GENRES[index])
  ) {
    throw new Error(
      `Genre config allowedGenres must exactly equal ${JSON.stringify(ALLOWED_GENRES)}.`
    );
  }

  const sections = [
    ["technicalAliases", "spelling"],
    ["directMappings", "direct"],
    ["conditionalMappings", "conditional_default"]
  ];
  const approvedLookup = new Map();
  const entries = [];

  sections.forEach(([section, expectedType]) => {
    if (!Array.isArray(config[section])) {
      throw new Error(`Genre config must contain a ${section} array.`);
    }
    config[section].forEach((rawEntry, index) => {
      const entry = {
        source: collapseWhitespace(rawEntry?.source),
        target: collapseWhitespace(rawEntry?.target),
        type: collapseWhitespace(rawEntry?.type),
        status: collapseWhitespace(rawEntry?.status),
        reviewReason: collapseWhitespace(rawEntry?.reviewReason),
        note: collapseWhitespace(rawEntry?.note),
        section
      };
      if (!entry.source || !entry.target || !entry.type || !entry.status || !entry.note) {
        throw new Error(
          `Genre ${section} entry ${index + 1} must contain source, target, type, status and note.`
        );
      }
      if (!GENRE_MAPPING_TYPES.has(entry.type) || entry.type !== expectedType) {
        throw new Error(
          `Genre ${section} entry ${index + 1} has invalid type ${JSON.stringify(entry.type)}.`
        );
      }
      if (!GENRE_MAPPING_STATUSES.has(entry.status)) {
        throw new Error(
          `Genre ${section} entry ${index + 1} has invalid status ${JSON.stringify(entry.status)}.`
        );
      }
      if (!ALLOWED_GENRES.includes(entry.target)) {
        throw new Error(
          `Genre ${section} entry ${index + 1} has unknown target ${JSON.stringify(entry.target)}.`
        );
      }
      const canonicalSource = ALLOWED_GENRES.find(
        (genre) => aliasKey(genre) === aliasKey(entry.source)
      );
      if (canonicalSource && canonicalSource !== entry.target) {
        throw new Error(
          `Canonical genre ${JSON.stringify(canonicalSource)} cannot map to ` +
            `${JSON.stringify(entry.target)}.`
        );
      }
      if (entry.type === "conditional_default" && !entry.reviewReason) {
        throw new Error(
          `Conditional genre mapping ${JSON.stringify(entry.source)} must have a reviewReason.`
        );
      }

      const key = aliasKey(entry.source);
      if (entry.status === "approved") {
        const previous = approvedLookup.get(key);
        if (previous) {
          throw new Error(
            `Multiple approved genre mappings for ${JSON.stringify(entry.source)}: ` +
              `${JSON.stringify(previous.target)} and ${JSON.stringify(entry.target)}.`
          );
        }
        approvedLookup.set(key, entry);
      }
      entries.push(entry);
    });
  });

  return { approvedLookup, entries };
}

function mapPrimaryGenre(rawValue, genreLookup) {
  const primaryGenreRaw = String(rawValue ?? "").normalize("NFC");
  const trimmed = collapseWhitespace(primaryGenreRaw);
  const native = ALLOWED_GENRES.find((genre) => genre === trimmed);
  if (native) {
    return {
      primaryGenreRaw,
      primaryGenre: native,
      primaryGenreValid: true,
      primaryGenreMappingType: "native",
      primaryGenreMappingSource: primaryGenreRaw,
      primaryGenreNeedsReview: false,
      primaryGenreReviewReason: ""
    };
  }

  const capitalization = ALLOWED_GENRES.find(
    (genre) => aliasKey(genre) === aliasKey(trimmed)
  );
  if (capitalization) {
    return {
      primaryGenreRaw,
      primaryGenre: capitalization,
      primaryGenreValid: true,
      primaryGenreMappingType: "capitalization",
      primaryGenreMappingSource: primaryGenreRaw,
      primaryGenreNeedsReview: false,
      primaryGenreReviewReason: ""
    };
  }

  const mapping = genreLookup.get(aliasKey(trimmed));
  if (mapping) {
    const needsReview = mapping.type === "conditional_default";
    return {
      primaryGenreRaw,
      primaryGenre: mapping.target,
      primaryGenreValid: true,
      primaryGenreMappingType: mapping.type,
      primaryGenreMappingSource: mapping.source,
      primaryGenreNeedsReview: needsReview,
      primaryGenreReviewReason: needsReview ? mapping.reviewReason : ""
    };
  }

  return {
    primaryGenreRaw,
    primaryGenre: "",
    primaryGenreValid: false,
    primaryGenreMappingType: "unmapped",
    primaryGenreMappingSource: primaryGenreRaw,
    primaryGenreNeedsReview: true,
    primaryGenreReviewReason: "unmapped_primary_genre"
  };
}

function extractRows(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload)) return payload;
  throw new Error("Podcast input must be an array or an object with a rows array.");
}

function isHttpUrl(value) {
  try {
    const url = new URL(normalizeText(value));
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function hasUsableImage(value, repoRoot = REPO_ROOT) {
  const image = normalizeText(value);
  if (isHttpUrl(image)) return true;
  if (!image || image.startsWith("data:")) return false;
  return existsSync(path.resolve(repoRoot, image.replace(/\//gu, path.sep)));
}

function topicLabelPreference(value) {
  const label = topicDisplay(value);
  const letters = label.match(/\p{L}/gu) ?? [];
  const upperLetters = letters.filter((letter) => letter === letter.toLocaleUpperCase("da-DK"));
  const lowerLetters = letters.filter((letter) => letter === letter.toLocaleLowerCase("da-DK"));
  const isShortAcronym =
    /^[\p{Lu}\p{N}]{2,6}$/u.test(label) && upperLetters.length > 0 && lowerLetters.length === 0;
  const isAllUpper = letters.length > 1 && upperLetters.length === letters.length;
  const isAllLower = letters.length > 0 && lowerLetters.length === letters.length;
  const startsUpper = /^\p{Lu}/u.test(label);
  return isShortAcronym ? 4 : startsUpper && !isAllUpper ? 3 : !isAllLower && !isAllUpper ? 2 : isAllLower ? 1 : 0;
}

function stableUnicodeCompare(left, right) {
  const leftValue = topicDisplay(left);
  const rightValue = topicDisplay(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function chooseCanonicalTopicLabel(group) {
  if (group.approvedCanonicalLabels.size) {
    return Array.from(group.approvedCanonicalLabels).sort(stableUnicodeCompare)[0];
  }
  return Array.from(group.displayCounts, ([label, count]) => ({ label, count })).sort(
    (left, right) =>
      right.count - left.count ||
      topicLabelPreference(right.label) - topicLabelPreference(left.label) ||
      stableUnicodeCompare(left.label, right.label)
  )[0].label;
}

function buildTopicCatalog(sourceRows, approvedLookup) {
  const identityGroups = new Map();
  const occurrences = [];
  sourceRows.forEach((row) => {
    const title = normalizeText(row?.Titel ?? row?.Title);
    const rawTopics = Array.isArray(row?.topics) ? row.topics : [];
    rawTopics.forEach((value) => {
      const raw = String(value ?? "");
      const display = topicDisplay(raw);
      if (!display) return;
      const identity = topicIdentity(raw);
      const approved = approvedLookup.get(identity);
      const resolvedIdentity = approved ? topicIdentity(approved.canonical) : identity;
      if (!identityGroups.has(resolvedIdentity)) {
        identityGroups.set(resolvedIdentity, {
          identity: resolvedIdentity,
          displayCounts: new Map(),
          rawVariants: new Set(),
          sourceIdentities: new Set(),
          approvedCanonicalLabels: new Set(),
          podcastTitles: new Set()
        });
      }
      const group = identityGroups.get(resolvedIdentity);
      group.displayCounts.set(display, (group.displayCounts.get(display) ?? 0) + 1);
      group.rawVariants.add(raw);
      group.sourceIdentities.add(identity);
      group.podcastTitles.add(title);
      if (approved) group.approvedCanonicalLabels.add(topicDisplay(approved.canonical));
      occurrences.push({ raw, display, identity, resolvedIdentity, approved, title });
    });
  });

  const canonicalByIdentity = new Map();
  identityGroups.forEach((group, identity) => {
    canonicalByIdentity.set(identity, chooseCanonicalTopicLabel(group));
  });
  return { identityGroups, canonicalByIdentity, occurrences };
}

function classifySafeTopicGroup(group, occurrences) {
  if (occurrences.some((occurrence) => occurrence.approved)) return "approved_alias";
  if (group.rawVariants.size === 1) return "exact_duplicate";
  const raw = Array.from(group.rawVariants);
  const whitespaceNormalized = new Set(raw.map((value) => String(value).trim().replace(/\s+/gu, " ")));
  if (whitespaceNormalized.size === 1) return "whitespace_only";
  const nfkcNormalized = new Set(raw.map((value) => String(value).normalize("NFKC")));
  if (nfkcNormalized.size === 1) return "unicode_equivalent";
  return "capitalization_only";
}

function classifyUnsafeTopicGroup(groups) {
  const identities = groups.map((group) => group.identity);
  const transliterated = identities.map((identity) =>
    identity.replace(/æ/gu, "ae").replace(/ø/gu, "oe").replace(/å/gu, "aa")
  );
  if (new Set(transliterated).size === 1) return "transliteration_collision";
  const withoutPunctuation = identities.map((identity) =>
    identity.replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  );
  if (new Set(withoutPunctuation).size === 1) return "punctuation_difference";
  if (
    identities.length === 2 &&
    (identities[0] === `${identities[1]}s` || identities[1] === `${identities[0]}s`)
  ) {
    return "singular_plural";
  }
  return "unresolved";
}

function buildTopicCollisionAudit(topicCatalog) {
  const byTopicKey = new Map();
  topicCatalog.identityGroups.forEach((group, identity) => {
    const label = topicCatalog.canonicalByIdentity.get(identity);
    const key = topicKey(label);
    if (!byTopicKey.has(key)) byTopicKey.set(key, []);
    byTopicKey.get(key).push(group);
  });

  return Array.from(byTopicKey, ([key, groups]) => {
    const related = topicCatalog.occurrences.filter((occurrence) =>
      groups.some((group) => group.identity === occurrence.resolvedIdentity)
    );
    const displayVariants = new Set(related.map((occurrence) => occurrence.display));
    if (groups.length === 1 && displayVariants.size < 2) return null;
    const safe = groups.length === 1;
    const classification = safe
      ? classifySafeTopicGroup(groups[0], related)
      : classifyUnsafeTopicGroup(groups);
    return {
      topic_key: key,
      raw_variants: sortedDistinct(related.map((occurrence) => occurrence.raw)).join(" | "),
      normalized_identity_variants: Array.from(
        new Set(related.map((occurrence) => occurrence.identity))
      )
        .sort(stableUnicodeCompare)
        .join(" | "),
      podcast_count: new Set(related.map((occurrence) => occurrence.title)).size,
      podcast_titles: sortedDistinct(related.map((occurrence) => occurrence.title)).join(" | "),
      classification,
      selected_canonical_label: safe
        ? topicCatalog.canonicalByIdentity.get(groups[0].identity)
        : "",
      safe_to_merge: safe,
      resolution_source:
        classification === "approved_alias"
          ? "approved_alias"
          : safe
            ? "topic_identity_normalization"
            : "manual_review_required",
      severity: safe ? "informational" : "error",
      note: safe
        ? "Varianterne deler sikker emneidentitet og samles deterministisk."
        : "Forskellige emneidentiteter producerer samme topic key; builderen stopper."
    };
  })
    .filter(Boolean)
    .sort(
      (left, right) =>
        stableUnicodeCompare(left.topic_key, right.topic_key) ||
        stableUnicodeCompare(left.classification, right.classification)
    );
}

function normalizeTopics(rawTopics, approvedLookup, canonicalByIdentity = new Map()) {
  const topicsRaw = Array.isArray(rawTopics)
    ? rawTopics.map((topic) => String(topic ?? ""))
    : [];
  const topicsCanonical = [];
  const seen = new Set();
  let aliasApplied = false;
  let duplicateAfterAlias = false;

  topicsRaw.forEach((rawTopic) => {
    const identity = topicIdentity(rawTopic);
    const configured = approvedLookup.get(identity);
    const resolvedIdentity = configured ? topicIdentity(configured.canonical) : identity;
    const canonical =
      canonicalByIdentity.get(resolvedIdentity) ??
      (configured ? topicDisplay(configured.canonical) : topicDisplay(rawTopic));
    if (configured && canonical !== rawTopic) aliasApplied = true;

    const key = resolvedIdentity;
    if (!key || seen.has(key)) {
      if (key) duplicateAfterAlias = true;
      return;
    }
    seen.add(key);
    topicsCanonical.push(canonical);
  });

  return { topicsRaw, topicsCanonical, aliasApplied, duplicateAfterAlias };
}

function buildRecommendationData(
  podcastPayload,
  aliasConfig,
  genreConfig,
  { repoRoot = REPO_ROOT, existingMetadata = null } = {}
) {
  const sourceRows = extractRows(podcastPayload);
  const { approvedLookup } = validateAliasConfig(aliasConfig);
  const { approvedLookup: approvedGenreLookup } = validateGenreConfig(genreConfig);
  const topicCatalog = buildTopicCatalog(sourceRows, approvedLookup);
  const topicCollisions = buildTopicCollisionAudit(topicCatalog);
  const unsafeTopicCollisions = topicCollisions.filter((collision) => !collision.safe_to_merge);
  if (unsafeTopicCollisions.length) {
    const first = unsafeTopicCollisions[0];
    throw new Error(
      `Topic key collision for ${JSON.stringify(first.topic_key)}: ` +
        `${JSON.stringify(first.normalized_identity_variants)}.`
    );
  }
  const topicStats = new Map();
  const rawTopicForms = new Set();
  let rawTopicOccurrences = 0;
  let canonicalTopicOccurrences = 0;
  let podcastsWithAliasApplied = 0;

  const rows = sourceRows.map((sourceRow) => {
    const title = normalizeText(sourceRow?.Titel ?? sourceRow?.Title);
    const id = podcastKey(title);
    const mappedGenre = mapPrimaryGenre(sourceRow?.Genre, approvedGenreLookup);
    const {
      primaryGenreRaw,
      primaryGenre,
      primaryGenreValid,
      primaryGenreMappingType,
      primaryGenreMappingSource,
      primaryGenreNeedsReview,
      primaryGenreReviewReason
    } = mappedGenre;
    const secondaryGenre = normalizeText(sourceRow?.secondaryGenre);
    const secondaryGenreValid =
      !secondaryGenre || ALLOWED_GENRES.includes(secondaryGenre);
    let mainSeries = normalizeText(
      sourceRow?.Hovedserie ??
        sourceRow?.["Hoved serie"] ??
        sourceRow?.mainSeries
    );
    if (!mainSeries && aliasKey(sourceRow?.Udgiver) === aliasKey("Third Ear")) {
      mainSeries = "Third Ear";
    }
    const normalizedTopics = normalizeTopics(
      sourceRow?.topics,
      approvedLookup,
      topicCatalog.canonicalByIdentity
    );
    const topicsCanonical = normalizedTopics.topicsCanonical;
    const topicKeys = topicsCanonical.map(topicKey);

    rawTopicOccurrences += normalizedTopics.topicsRaw.length;
    canonicalTopicOccurrences += topicsCanonical.length;
    normalizedTopics.topicsRaw.forEach((topic) => rawTopicForms.add(topic));
    if (normalizedTopics.aliasApplied) podcastsWithAliasApplied += 1;

    const hasLink = isHttpUrl(sourceRow?.Link);
    const hasImage = hasUsableImage(sourceRow?.Billedlink, repoRoot);
    topicsCanonical.forEach((topic) => {
      if (!topicStats.has(topic)) {
        topicStats.set(topic, { podcasts: 0, usableRows: 0 });
      }
      const stat = topicStats.get(topic);
      stat.podcasts += 1;
      if (hasLink && hasImage) stat.usableRows += 1;
    });

    const metadataIssues = [];
    if (!id) metadataIssues.push("missing_stable_id");
    if (!primaryGenreValid) metadataIssues.push("invalid_primary_genre");
    if (!secondaryGenreValid) metadataIssues.push("invalid_secondary_genre");
    if (
      primaryGenreRaw &&
      secondaryGenre &&
      aliasKey(primaryGenreRaw) === aliasKey(secondaryGenre)
    ) {
      metadataIssues.push("same_primary_secondary_genre");
    }
    if (!topicsCanonical.length) metadataIssues.push("missing_topics");
    if (normalizedTopics.aliasApplied) metadataIssues.push("topic_alias_applied");
    if (normalizedTopics.duplicateAfterAlias) {
      metadataIssues.push("duplicate_topic_after_alias");
    }

    const topicEligible = topicsCanonical.length > 0;
    const genreEligible = primaryGenreValid;
    const identityMaterials = buildIdentityMaterials(sourceRow, title, mainSeries);
    return {
      id,
      recommendationId: "",
      recommendationIdentityBasis: "",
      identityDuplicateGroup: "",
      title,
      mainSeries,
      primaryGenreRaw,
      primaryGenre,
      primaryGenreValid,
      primaryGenreMappingType,
      primaryGenreMappingSource,
      primaryGenreNeedsReview,
      primaryGenreReviewReason,
      secondaryGenre,
      secondaryGenreValid,
      topicsRaw: normalizedTopics.topicsRaw,
      topicsCanonical,
      topicKeys,
      topicEligible,
      genreEligible,
      recommendationMetadataEligible: topicEligible && genreEligible,
      metadataIssues,
      _identity: {
        ...identityMaterials,
        image: normalizeImageIdentity(sourceRow?.Billedlink)
      }
    };
  });
  if (rows.length !== sourceRows.length) {
    throw new Error(
      `Recommendation row count changed during build: ${rows.length} for ${sourceRows.length} source rows.`
    );
  }

  assignRecommendationIds(rows);
  preserveExistingRecommendationIds(rows, existingMetadata);
  const identityCollisions = auditExistingIds(sourceRows, rows);
  const approvedAliases = aliasConfig.aliases.filter((entry) => entry.status === "approved").length;
  const mappingCounts = Object.fromEntries(
    ["native", "capitalization", "spelling", "direct", "conditional_default", "unmapped"].map(
      (type) => [type, rows.filter((row) => row.primaryGenreMappingType === type).length]
    )
  );
  const genreEligibleBeforeMapping = sourceRows.filter((sourceRow) =>
    ALLOWED_GENRES.includes(normalizeText(sourceRow?.Genre))
  ).length;
  const recommendationMetadataEligibleBeforeMapping = rows.filter(
    (row) =>
      ALLOWED_GENRES.includes(normalizeText(row.primaryGenreRaw)) &&
      row.topicsCanonical.length > 0
  ).length;
  const genreMigrationRows = rows.map((row) => ({
    recommendation_id: row.recommendationId,
    title: row.title,
    primary_genre_raw: row.primaryGenreRaw,
    primary_genre_canonical: row.primaryGenre,
    mapping_type: row.primaryGenreMappingType,
    mapping_status: row.primaryGenreMappingType === "unmapped" ? "unmapped" : "approved",
    needs_review: row.primaryGenreNeedsReview,
    review_reason: row.primaryGenreReviewReason,
    secondary_genre: row.secondaryGenre,
    topic_count: row.topicsCanonical.length,
    genre_eligible: row.genreEligible,
    recommendation_metadata_eligible: row.recommendationMetadataEligible,
    note:
      row.primaryGenreMappingType === "unmapped"
        ? "Ingen godkendt mapping; værdien er ikke gættet."
        : row.primaryGenreNeedsReview
          ? "Godkendt standardmapping; konkret genrevalg kræver senere review."
          : ""
  }));
  const genreValueStats = new Map();
  rows.forEach((row) => {
    const key = row.primaryGenreRaw;
    if (!genreValueStats.has(key)) {
      genreValueStats.set(key, {
        primaryGenreRaw: row.primaryGenreRaw,
        podcastCount: 0,
        target: row.primaryGenre,
        mappingType: row.primaryGenreMappingType,
        needsReview: row.primaryGenreNeedsReview,
        titles: []
      });
    }
    const stat = genreValueStats.get(key);
    stat.podcastCount += 1;
    stat.titles.push(row.title);
  });
  const genreValues = Array.from(genreValueStats.values()).sort(
    (left, right) =>
      aliasKey(left.primaryGenreRaw).localeCompare(aliasKey(right.primaryGenreRaw), "da") ||
      left.primaryGenreRaw.localeCompare(right.primaryGenreRaw, "da")
  );
  const unmappedGenres = genreValues
    .filter((item) => item.mappingType === "unmapped")
    .map((item) => ({
      primary_genre_raw: item.primaryGenreRaw,
      podcast_count: item.podcastCount,
      podcast_titles: sortedDistinct(item.titles).join(" | "),
      suggested_action: "Tilføj kun en eksplicit godkendt regel efter separat gennemgang.",
      severity: "review",
      note: "Builderen gætter ikke en kanonisk genre."
    }));
  const stableIdCounts = new Map();
  rows.forEach((row) => {
    if (row.id) stableIdCounts.set(row.id, (stableIdCounts.get(row.id) ?? 0) + 1);
  });
  const topicFrequency = Array.from(topicStats, ([topic, stats]) => ({ topic, ...stats })).sort(
    (left, right) =>
      right.podcasts - left.podcasts ||
      aliasKey(left.topic).localeCompare(aliasKey(right.topic), "da")
  );
  const candidateRows = topicFrequency.filter(
    (item) => item.podcasts >= 3 && item.usableRows >= 3
  );
  const summary = {
    podcasts: rows.length,
    validPrimaryGenres: rows.filter((row) => row.primaryGenreValid).length,
    invalidPrimaryGenres: rows.filter((row) => !row.primaryGenreValid).length,
    genreEligibleBeforeMapping,
    genreEligibleAfterMapping: rows.filter((row) => row.genreEligible).length,
    recommendationMetadataEligibleBeforeMapping,
    recommendationMetadataEligibleAfterMapping: rows.filter(
      (row) => row.recommendationMetadataEligible
    ).length,
    primaryGenreMappingNative: mappingCounts.native,
    primaryGenreMappingCapitalization: mappingCounts.capitalization,
    primaryGenreMappingSpelling: mappingCounts.spelling,
    primaryGenreMappingDirect: mappingCounts.direct,
    primaryGenreMappingConditionalDefault: mappingCounts.conditional_default,
    primaryGenreMappingUnmapped: mappingCounts.unmapped,
    uniqueUnmappedPrimaryGenres: unmappedGenres.length,
    conditionalGenreReviews: mappingCounts.conditional_default,
    withSecondaryGenre: rows.filter((row) => Boolean(row.secondaryGenre)).length,
    withRawTopics: rows.filter((row) => row.topicsRaw.length > 0).length,
    withCanonicalTopics: rows.filter((row) => row.topicsCanonical.length > 0).length,
    topicEligible: rows.filter((row) => row.topicEligible).length,
    genreEligible: rows.filter((row) => row.genreEligible).length,
    recommendationMetadataEligible: rows.filter(
      (row) => row.recommendationMetadataEligible
    ).length,
    approvedAliases,
    podcastsWithAliasApplied,
    rawTopicOccurrences,
    rawUniqueTopicForms: rawTopicForms.size,
    canonicalTopicOccurrences,
    canonicalUniqueTopics: topicStats.size,
    normalizedTopicIdentities: topicCatalog.identityGroups.size,
    topicVariantGroups: topicCollisions.length,
    topicCollisionGroups: topicCollisions.filter(
      (collision) => collision.classification !== "approved_alias"
    ).length,
    approvedAliasTopicGroups: topicCollisions.filter(
      (collision) => collision.classification === "approved_alias"
    ).length,
    safeTopicCollisionGroups: topicCollisions.filter(
      (collision) => collision.safe_to_merge && collision.classification !== "approved_alias"
    ).length,
    unsafeTopicCollisionGroups: unsafeTopicCollisions.length,
    podcastsAffectedByTopicNormalization: new Set(
      topicCatalog.occurrences
        .filter(
          (occurrence) =>
            occurrence.display !==
            topicCatalog.canonicalByIdentity.get(occurrence.resolvedIdentity)
        )
        .map((occurrence) => occurrence.title)
    ).size,
    withinPodcastTopicDuplicatesRemoved: rawTopicOccurrences - canonicalTopicOccurrences,
    canonicalTopicsUsedOnce: topicFrequency.filter((item) => item.podcasts === 1).length,
    canonicalTopicsAtLeastThree: topicFrequency.filter((item) => item.podcasts >= 3).length,
    canonicalTopicsAtLeastFive: topicFrequency.filter((item) => item.podcasts >= 5).length,
    canonicalTopicsAtLeastTen: topicFrequency.filter((item) => item.podcasts >= 10).length,
    possibleStandaloneRows: candidateRows.length,
    topicKeyCollisions: unsafeTopicCollisions.length,
    uniqueExistingIds: stableIdCounts.size,
    duplicateStableIdValues: Array.from(stableIdCounts.values()).filter((count) => count > 1)
      .length,
    podcastsSharingStableId: Array.from(stableIdCounts.values())
      .filter((count) => count > 1)
      .reduce((sum, count) => sum + count, 0),
    uniqueRecommendationIds: new Set(rows.map((row) => row.recommendationId)).size,
    recommendationIdCollisions: 0,
    exactDuplicateGroups: identityCollisions.filter(
      (collision) => collision.classification === "exact_duplicate"
    ).length,
    likelyDuplicateGroups: identityCollisions.filter(
      (collision) => collision.classification === "likely_duplicate"
    ).length,
    unresolvedIdentityGroups: identityCollisions.filter(
      (collision) => collision.classification === "unresolved"
    ).length
  };

  return {
    payload: {
      version: 1,
      source: {
        path: "data/podcasts.json",
        generatedAt: podcastPayload?.generatedAt ?? null,
        count: sourceRows.length,
        topicAliases: "config/recommendation-topic-aliases.json",
        topicAliasVersion: aliasConfig.version,
        genreMapping: "config/recommendation-genre-mapping.json",
        genreMappingVersion: genreConfig.version,
        stableIdMethod: "frontend-normalized-title",
        recommendationIdMethod: "metadata-fingerprint-sha256-128-v1"
      },
      count: rows.length,
      summary,
      rows
    },
    topicFrequency,
    candidateRows,
    topicCollisions,
    identityCollisions,
    genreMigrationRows,
    genreValues,
    unmappedGenres
  };
}

function renderTopicTable(items) {
  if (!items.length) return "_Ingen emner opfylder kriteriet._";
  return [
    "| Emne | Podcasts | Podcasts med brugbart link og cover |",
    "|---|---:|---:|",
    ...items.map(
      (item) => `| ${item.topic.replace(/\|/gu, "\\|")} | ${item.podcasts} | ${item.usableRows} |`
    )
  ].join("\n");
}

function renderGenreMigrationCsv(rows) {
  const fields = [
    "recommendation_id",
    "title",
    "primary_genre_raw",
    "primary_genre_canonical",
    "mapping_type",
    "mapping_status",
    "needs_review",
    "review_reason",
    "secondary_genre",
    "topic_count",
    "genre_eligible",
    "recommendation_metadata_eligible",
    "note"
  ];
  return `\uFEFF${[
    fields.join(";"),
    ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(";"))
  ].join("\n")}\n`;
}

function renderGenreUnmappedCsv(rows) {
  const fields = [
    "primary_genre_raw",
    "podcast_count",
    "podcast_titles",
    "suggested_action",
    "severity",
    "note"
  ];
  return `\uFEFF${[
    fields.join(";"),
    ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(";"))
  ].join("\n")}\n`;
}

function renderTopicCollisionCsv(rows) {
  const fields = [
    "topic_key",
    "raw_variants",
    "normalized_identity_variants",
    "podcast_count",
    "podcast_titles",
    "classification",
    "selected_canonical_label",
    "safe_to_merge",
    "resolution_source",
    "severity",
    "note"
  ];
  return `\uFEFF${[
    fields.join(";"),
    ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(";"))
  ].join("\n")}\n`;
}

function renderTopicCollisionReport({ payload, topicCollisions }) {
  const summary = payload.summary;
  const unsafe = topicCollisions.filter((collision) => !collision.safe_to_merge);
  const rows = topicCollisions.length
    ? topicCollisions.map(
        (collision) =>
          `| ${collision.topic_key} | ${collision.classification} | ` +
          `${collision.selected_canonical_label || "—"} | ` +
          `${collision.safe_to_merge ? "ja" : "nej"} | ${collision.podcast_count} |`
      )
    : ["| — | — | — | — | 0 |"];
  return `# Topic-key collision audit

## Resultat

- Rå emneforekomster: ${summary.rawTopicOccurrences}
- Unikke rå skrivemåder: ${summary.rawUniqueTopicForms}
- Normaliserede emneidentiteter: ${summary.normalizedTopicIdentities}
- Endelige unikke topic keys: ${summary.canonicalUniqueTopics}
- Rå variantgrupper i auditten: ${summary.topicVariantGroups}
- Allerede godkendte aliasgrupper: ${summary.approvedAliasTopicGroups}
- Oprindelige builder-blokerende topic-key-grupper: ${summary.topicCollisionGroups}
- Sikkert normaliserede grupper: ${summary.safeTopicCollisionGroups}
- Usikre eller uafklarede grupper: ${summary.unsafeTopicCollisionGroups}
- Podcasts påvirket af labelnormalisering: ${summary.podcastsAffectedByTopicNormalization}
- Dubletter fjernet inden for samme podcast: ${summary.withinPodcastTopicDuplicatesRemoved}

Identiteten bruger kun Unicode NFKC, trimning, kollaps af intern whitespace og
deterministisk case-insensitiv sammenligning. Forskellige identiteter, som producerer
samme aggressive \`topicKey\`, er en hård fejl og må ikke flettes automatisk.

## Grupper

| Topic key | Klassifikation | Valgt label | Sikker | Podcasts |
|---|---|---|---|---:|
${rows.join("\n")}

## Stopstatus

${unsafe.length ? `**STOP:** ${unsafe.length} usikre grupper kræver manuel afgørelse.` : "Ingen usikre topic-key-kollisioner er tilbage."}
`;
}

function renderGenreMigrationReport({ payload, genreValues, unmappedGenres }) {
  const summary = payload.summary;
  const conditionalRows = payload.rows.filter(
    (row) => row.primaryGenreMappingType === "conditional_default"
  );
  const conditionalSources = ["Biografi", "Undersøgende journalistik", "Interview"].map(
    (source) => ({
      source,
      count: conditionalRows.filter(
        (row) => aliasKey(row.primaryGenreMappingSource) === aliasKey(source)
      ).length
    })
  );
  const coverageShare = summary.podcasts
    ? ((summary.genreEligibleAfterMapping / summary.podcasts) * 100).toFixed(1)
    : "0.0";
  const metadataShare = summary.podcasts
    ? ((summary.recommendationMetadataEligibleAfterMapping / summary.podcasts) * 100).toFixed(1)
    : "0.0";
  const valueRows = genreValues.map(
    (item) =>
      `| ${item.primaryGenreRaw.replace(/\|/gu, "\\|") || "*(tom)*"} | ` +
      `${item.podcastCount} | ${item.target || "—"} | \`${item.mappingType}\` | ` +
      `${item.needsReview ? "ja" : "nej"} |`
  );
  const unmappedRows = unmappedGenres.length
    ? unmappedGenres.map(
        (item) =>
          `| ${item.primary_genre_raw.replace(/\|/gu, "\\|") || "*(tom)*"} | ` +
          `${item.podcast_count} | \`${item.severity}\` |`
      )
    : ["| — | 0 | — |"];

  return `# Recommendation genre migration

## Resultat

- Podcasts i alt: ${summary.podcasts}
- Native gyldige genrer: ${summary.primaryGenreMappingNative}
- Kapitaliseringsnormaliseringer: ${summary.primaryGenreMappingCapitalization}
- Tekniske stavealiaser: ${summary.primaryGenreMappingSpelling}
- Direkte konverteringer: ${summary.primaryGenreMappingDirect}
- Betingede standardkonverteringer: ${summary.primaryGenreMappingConditionalDefault}
- Umappede podcasts: ${summary.primaryGenreMappingUnmapped}
- Unikke umappede genreværdier: ${summary.uniqueUnmappedPrimaryGenres}
- \`genreEligible\` før mapping: ${summary.genreEligibleBeforeMapping}
- \`genreEligible\` efter mapping: ${summary.genreEligibleAfterMapping}
- \`recommendationMetadataEligible\` før mapping: ${summary.recommendationMetadataEligibleBeforeMapping}
- \`recommendationMetadataEligible\` efter mapping: ${summary.recommendationMetadataEligibleAfterMapping}
- Unikke \`recommendationId\`: ${summary.uniqueRecommendationIds}
- \`recommendationId\`-kollisioner: ${summary.recommendationIdCollisions}

## Alle rå genreværdier

| Rå genre | Podcasts | Kanonisk målgenre | Mappingtype | Review |
|---|---:|---|---|---|
${valueRows.join("\n")}

## Betingede standardmappings

| Kildetype | Podcasts | Standardmål | Review reason |
|---|---:|---|---|
| Biografi | ${conditionalSources[0].count} | Dokumentar | \`biography_may_be_history\` |
| Undersøgende journalistik | ${conditionalSources[1].count} | Dokumentar | \`investigative_journalism_may_be_true_crime\` |
| Interview | ${conditionalSources[2].count} | Underholdning | \`interview_may_follow_subject_genre\` |

## Umappede genrer

| Rå genre | Podcasts | Alvor |
|---|---:|---|
${unmappedRows.join("\n")}

Umappede værdier gættes ikke. Nye konverteringer kræver en eksplicit regel med status
\`approved\` i \`config/recommendation-genre-mapping.json\`.

## Vurdering

Efter mapping er ${summary.genreEligibleAfterMapping} af ${summary.podcasts} podcasts
genreklare (${coverageShare} %), mens ${summary.recommendationMetadataEligibleAfterMapping}
poster (${metadataShare} %) både har en kanonisk genre og mindst ét kanonisk emne.
Genredækningen er tilstrækkelig som kontrolleret grundlag for algoritmeversion 1, forudsat at
umappede værdier fortsat udelades fra genrebaserede kandidater, og at betingede standardmappings
bevares som særskilte reviewtilfælde. Rådata og frontendens genrevisning er uændrede.
`;
}

function renderReadiness({ payload, topicFrequency, candidateRows }) {
  const summary = payload.summary;
  const eligibleShare = summary.podcasts
    ? ((summary.recommendationMetadataEligible / summary.podcasts) * 100).toFixed(1)
    : "0.0";
  return `# Recommendation metadata readiness

## Datagrundlag

- Podcasts i alt: ${summary.podcasts}
- \`genreEligible\` før mapping: ${summary.genreEligibleBeforeMapping}
- \`genreEligible\` efter mapping: ${summary.genreEligibleAfterMapping}
- \`recommendationMetadataEligible\` før mapping: ${summary.recommendationMetadataEligibleBeforeMapping}
- \`recommendationMetadataEligible\` efter mapping: ${summary.recommendationMetadataEligibleAfterMapping}
- Mappet via \`native\`: ${summary.primaryGenreMappingNative}
- Mappet via \`capitalization\`: ${summary.primaryGenreMappingCapitalization}
- Mappet via \`spelling\`: ${summary.primaryGenreMappingSpelling}
- Mappet via \`direct\`: ${summary.primaryGenreMappingDirect}
- Mappet via \`conditional_default\`: ${summary.primaryGenreMappingConditionalDefault}
- \`unmapped\`: ${summary.primaryGenreMappingUnmapped}
- Unikke umappede primærgenrer: ${summary.uniqueUnmappedPrimaryGenres}
- Betingede genrereviews: ${summary.conditionalGenreReviews}
- Sekundær genre udfyldt: ${summary.withSecondaryGenre}
- Mindst ét råt emne: ${summary.withRawTopics}
- Mindst ét kanonisk emne: ${summary.withCanonicalTopics}
- \`topicEligible\`: ${summary.topicEligible}
- Godkendte aliaser: ${summary.approvedAliases}
- Podcasts hvor et godkendt alias blev anvendt: ${summary.podcastsWithAliasApplied}

## Emnedækning

- Rå emneforekomster: ${summary.rawTopicOccurrences}
- Unikke rå skrivemåder: ${summary.rawUniqueTopicForms}
- Kanoniske emneforekomster efter alias og deduplikering: ${summary.canonicalTopicOccurrences}
- Unikke kanoniske emner: ${summary.canonicalUniqueTopics}
- Kanoniske emner brugt én gang: ${summary.canonicalTopicsUsedOnce}
- Kanoniske emner brugt mindst tre gange: ${summary.canonicalTopicsAtLeastThree}
- Kanoniske emner brugt mindst fem gange: ${summary.canonicalTopicsAtLeastFive}
- Kanoniske emner brugt mindst ti gange: ${summary.canonicalTopicsAtLeastTen}
- Tekniske topic-key-kollisioner: ${summary.topicKeyCollisions}
- Dublerede eksisterende titel-nøgler: ${summary.duplicateStableIdValues}
- Podcasts som deler en eksisterende titel-nøgle: ${summary.podcastsSharingStableId}

## Identitetsberedskab

- Podcastposter: ${summary.podcasts}
- Unikke eksisterende \`id\`: ${summary.uniqueExistingIds}
- Dublerede eksisterende \`id\`: ${summary.duplicateStableIdValues}
- Poster berørt af dublerede eksisterende \`id\`: ${summary.podcastsSharingStableId}
- Unikke \`recommendationId\`: ${summary.uniqueRecommendationIds}
- \`recommendationId\`-kollisioner: ${summary.recommendationIdCollisions}
- Eksakte identitetsdubletgrupper: ${summary.exactDuplicateGroups}
- Sandsynlige identitetsdubletgrupper: ${summary.likelyDuplicateGroups}
- Uafklarede identitetskollisioner: ${summary.unresolvedIdentityGroups}

Identiteten er teknisk klar til algoritmebrug: alle poster har et unikt, deterministisk
\`recommendationId\`. Eksakte kildedubletter er stadig separate poster og bør ikke vises
samtidigt af en senere anbefalingsmotor.

## 30 hyppigste kanoniske emner

${renderTopicTable(topicFrequency.slice(0, 30))}

## Mulige selvstændige emnerækker

Et emne står her, når mindst tre podcasts har emnet, og mindst tre af dem har både et
syntaktisk brugbart HTTP(S)-link og et HTTP(S)-cover eller en eksisterende lokal coverfil.
Kontrollen er teknisk og foretager ikke en redaktionel godkendelse eller netværkskontrol af
hver ekstern URL.

${renderTopicTable(candidateRows.slice(0, 30))}

## Vurdering

${summary.recommendationMetadataEligibleAfterMapping} af ${summary.podcasts} podcasts
(${eligibleShare} %) har efter den versionsstyrede mapping både en gyldig kanonisk primærgenre
og mindst ét kanonisk emne. Mappingen findes kun i den afledte anbefalingsfil.
\`primaryGenreRaw\` bevarer kildeværdien, umappede genrer gættes ikke, og betingede
standardmappings er markeret til senere review. Eligibility er kun en teknisk status og
skjuler ikke podcasts fra hjemmesiden.

## Stabilt ID

\`id\` genbruger uændret frontendens eksisterende normaliserede titel-nøgle.
\`recommendationId\` er en separat afledt nøgle til anbefalingssystemet. Kildedata indeholder
ikke et sikkert source-id, så recommendation-nøglen bruger en dokumenteret metadatafingerprint.
Frontendens id-kontrakt og rå podcastdata migreres ikke.
`;
}

async function writeRecommendationArtifacts({
  inputPath = DEFAULT_INPUT_PATH,
  aliasPath = DEFAULT_ALIAS_PATH,
  genreMappingPath = DEFAULT_GENRE_MAPPING_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
  readinessPath = DEFAULT_READINESS_PATH,
  identityCsvPath = DEFAULT_IDENTITY_CSV_PATH,
  identityReportPath = DEFAULT_IDENTITY_REPORT_PATH,
  genreCsvPath = DEFAULT_GENRE_CSV_PATH,
  genreUnmappedCsvPath = DEFAULT_GENRE_UNMAPPED_CSV_PATH,
  genreReportPath = DEFAULT_GENRE_REPORT_PATH,
  topicCollisionCsvPath = DEFAULT_TOPIC_COLLISION_CSV_PATH,
  topicCollisionReportPath = DEFAULT_TOPIC_COLLISION_REPORT_PATH,
  existingMetadataPath = outputPath,
  repoRoot = REPO_ROOT
} = {}) {
  const [podcastPayload, aliasConfig, genreConfig, existingMetadata] = await Promise.all([
    readFile(inputPath, "utf8").then(JSON.parse),
    readFile(aliasPath, "utf8").then(JSON.parse),
    readFile(genreMappingPath, "utf8").then(JSON.parse),
    readFile(existingMetadataPath, "utf8")
      .then(JSON.parse)
      .catch((error) => {
        if (error?.code === "ENOENT") return null;
        throw error;
      })
  ]);
  const built = buildRecommendationData(podcastPayload, aliasConfig, genreConfig, {
    repoRoot,
    existingMetadata
  });
  await Promise.all(
    [...new Set([
      outputPath,
      readinessPath,
      identityCsvPath,
      identityReportPath,
      genreCsvPath,
      genreUnmappedCsvPath,
      genreReportPath,
      topicCollisionCsvPath,
      topicCollisionReportPath
    ].map((artifactPath) => path.dirname(artifactPath)))].map((directory) =>
      mkdir(directory, { recursive: true })
    )
  );
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(built.payload, null, 2)}\n`, "utf8"),
    writeFile(readinessPath, renderReadiness(built), "utf8"),
    writeFile(identityCsvPath, renderIdentityCsv(built.identityCollisions), "utf8"),
    writeFile(
      identityReportPath,
      renderIdentityReport(built.identityCollisions, built.payload.summary),
      "utf8"
    ),
    writeFile(genreCsvPath, renderGenreMigrationCsv(built.genreMigrationRows), "utf8"),
    writeFile(genreUnmappedCsvPath, renderGenreUnmappedCsv(built.unmappedGenres), "utf8"),
    writeFile(genreReportPath, renderGenreMigrationReport(built), "utf8"),
    writeFile(topicCollisionCsvPath, renderTopicCollisionCsv(built.topicCollisions), "utf8"),
    writeFile(topicCollisionReportPath, renderTopicCollisionReport(built), "utf8")
  ]);
  return built;
}

async function main() {
  const built = await writeRecommendationArtifacts();
  console.log(
    `Wrote ${built.payload.count} recommendation metadata rows to ` +
      path.relative(REPO_ROOT, DEFAULT_OUTPUT_PATH)
  );
  console.log(`Wrote readiness report to ${path.relative(REPO_ROOT, DEFAULT_READINESS_PATH)}`);
  console.log(
    `Wrote identity reports to ${path.relative(REPO_ROOT, DEFAULT_IDENTITY_REPORT_PATH)}`
  );
  console.log(`Wrote genre reports to ${path.relative(REPO_ROOT, DEFAULT_GENRE_REPORT_PATH)}`);
  console.log(
    `Wrote topic collision audit to ${path.relative(REPO_ROOT, DEFAULT_TOPIC_COLLISION_REPORT_PATH)}`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export {
  ALLOWED_GENRES,
  aliasKey,
  buildRecommendationData,
  buildBaseIdentityMaterial,
  identityHash,
  mapPrimaryGenre,
  normalizeHostIdentity,
  preserveExistingRecommendationIds,
  topicDisplay,
  topicIdentity,
  buildTopicCatalog,
  normalizeUrlIdentity,
  normalizeTopics,
  podcastKey,
  recommendationSlug,
  renderIdentityCsv,
  renderIdentityReport,
  renderGenreMigrationCsv,
  renderGenreMigrationReport,
  renderGenreUnmappedCsv,
  renderTopicCollisionCsv,
  renderTopicCollisionReport,
  renderReadiness,
  topicKey,
  validateAliasConfig,
  validateGenreConfig,
  writeRecommendationArtifacts
};
