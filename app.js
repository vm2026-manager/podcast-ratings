const podcastGrid = document.querySelector("#podcastGrid");
const resultsText = document.querySelector("#resultsText");
const searchInput = document.querySelector("#searchInput");
const genreFilter = document.querySelector("#genreFilter");
const publisherFilter = document.querySelector("#publisherFilter");
const sortSelect = document.querySelector("#sortSelect");
const cardTemplate = document.querySelector("#podcastCardTemplate");

let podcasts = [];

const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub?gid=0&single=true&output=csv";

const collator = new Intl.Collator("da", {
  sensitivity: "base",
  numeric: true
});

function normalizeText(value) {
  return String(value ?? "").toLocaleLowerCase("da").trim();
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function formatText(value, fallback = "Ikke angivet") {
  return isBlank(value) ? fallback : String(value).trim();
}

function firstNonBlank(...values) {
  for (const value of values) {
    if (!isBlank(value)) {
      return String(value).trim();
    }
  }
  return "";
}

function cleanNumericText(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/["']/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function parseRating(value) {
  if (typeof value === "number") {
    return value;
  }

  if (isBlank(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  const cleaned = cleanNumericText(value);
  const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);

  if (!match) {
    return Number.NEGATIVE_INFINITY;
  }

  const numeric = Number.parseFloat(match[0].replace(",", "."));
  return Number.isNaN(numeric) ? Number.NEGATIVE_INFINITY : numeric;
}

function formatRating(rating) {
  const numeric = parseRating(rating);

  if (numeric === Number.NEGATIVE_INFINITY) {
    return "Ikke vurderet";
  }

  return numeric.toFixed(1).replace(".", ",") + " / 10";
}

function parsePlacement(value) {
  const numeric = Number.parseInt(cleanNumericText(value), 10);
  return Number.isNaN(numeric) ? Number.POSITIVE_INFINITY : numeric;
}

function parsePlayedYear(value) {
  if (isBlank(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  const match = cleanNumericText(value).match(/\d{4}/);
  return match ? Number.parseInt(match[0], 10) : Number.NEGATIVE_INFINITY;
}

function populateFilterOptions(select, values, allLabel) {
  select.innerHTML = `<option value="">${allLabel}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function detectDelimiterFromLine(line) {
  const counts = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length
  };

  let best = ",";
  let bestCount = counts[best];

  Object.entries(counts).forEach(([delimiter, count]) => {
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  });

  return best;
}

function parseDelimitedRow(row, delimiter) {
  const values = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    const nextCharacter = row[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === delimiter && !insideQuotes) {
      values.push(currentValue);
      currentValue = "";
    } else {
      currentValue += character;
    }
  }

  values.push(currentValue);

  return values.map((value) =>
    String(value ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
  );
}

function splitLinesRespectingQuotes(text) {
  const rows = [];
  let currentRow = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentRow += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "\n" && !insideQuotes) {
      rows.push(currentRow);
      currentRow = "";
    } else {
      currentRow += character;
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  return rows.filter((row) => row.trim() !== "");
}

function parseCsv(text) {
  const normalized = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = splitLinesRespectingQuotes(normalized);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = detectDelimiterFromLine(lines[0]);
  return lines.map((line) => parseDelimitedRow(line, delimiter));
}

function sanitizeHeader(header) {
  return String(header ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("da")
    .replace(/\s+/g, " ");
}

function getCell(row, index) {
  return index >= 0 && index < row.length ? String(row[index] ?? "").trim() : "";
}

function findHeaderIndex(headerIndexes, ...aliases) {
  for (const alias of aliases) {
    const normalizedAlias = sanitizeHeader(alias);
    if (headerIndexes.has(normalizedAlias)) {
      return headerIndexes.get(normalizedAlias);
    }
  }
  return -1;
}

function maybeRepairShiftedRow(row, expectedColumns) {
  if (row.length === expectedColumns) {
    return row;
  }

  const repaired = [...row];

  if (
    repaired.length === expectedColumns + 1 &&
    /^\d+$/.test(cleanNumericText(repaired[3])) &&
    /^\d+$/.test(cleanNumericText(repaired[4]))
  ) {
    repaired.splice(3, 2, `${cleanNumericText(repaired[3])},${cleanNumericText(repaired[4])}`);
    return repaired;
  }

  if (repaired.length > expectedColumns + 1) {
    const firstFourLookRight =
      /^\d+$/.test(cleanNumericText(repaired[0])) &&
      !isBlank(repaired[1]) &&
      !isBlank(repaired[2]) &&
      /^\d+$/.test(cleanNumericText(repaired[3])) &&
      /^\d+$/.test(cleanNumericText(repaired[4]));

    if (firstFourLookRight) {
      repaired.splice(3, 2, `${cleanNumericText(repaired[3])},${cleanNumericText(repaired[4])}`);
    }
  }

  return repaired;
}

function normalizePodcastRow(rawPodcast) {
  return {
    "Placering": firstNonBlank(rawPodcast["Placering"], rawPodcast["Placeri"]),
    "Titel": firstNonBlank(rawPodcast["Titel"]),
    "Vært": firstNonBlank(rawPodcast["Vært"], rawPodcast["Vaert"]),
    "Vurdering (1-10)": firstNonBlank(
      rawPodcast["Vurdering (1-10)"],
      rawPodcast["Vuring (1-10)"],
      rawPodcast["Vurdering"],
      rawPodcast["Rating"]
    ),
    "Genre": firstNonBlank(rawPodcast["Genre"]),
    "Udgiver": firstNonBlank(rawPodcast["Udgiver"]),
    "Antal afsnit": firstNonBlank(rawPodcast["Antal afsnit"]),
    "Årstal afspillet": firstNonBlank(
      rawPodcast["Årstal afspillet"],
      rawPodcast["Arstal afspillet"]
    ),
    "Link": firstNonBlank(rawPodcast["Link"]),
    "Afgivet vurdering": firstNonBlank(
      rawPodcast["Afgivet vurdering"],
      rawPodcast["Afgivet vurd"]
    ),
    "Billedlink": firstNonBlank(
      rawPodcast["Billedlink"],
      rawPodcast["Billede"],
      rawPodcast["Cover"],
      rawPodcast["Coverlink"]
    )
  };
}

function mapCsvToPodcasts(csvText) {
  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    throw new Error("CSV-filen indeholder ikke nok rækker.");
  }

  const [headerRow, ...dataRows] = rows;
  const headerIndexes = new Map();

  headerRow.forEach((header, index) => {
    headerIndexes.set(sanitizeHeader(header), index);
  });

  const indexes = {
    placement: findHeaderIndex(headerIndexes, "Placering", "Placeri"),
    title: findHeaderIndex(headerIndexes, "Titel"),
    host: findHeaderIndex(headerIndexes, "Vært", "Vaert"),
    rating: findHeaderIndex(
      headerIndexes,
      "Vurdering (1-10)",
      "Vuring (1-10)",
      "Vurdering",
      "Rating"
    ),
    genre: findHeaderIndex(headerIndexes, "Genre"),
    publisher: findHeaderIndex(headerIndexes, "Udgiver"),
    episodes: findHeaderIndex(headerIndexes, "Antal afsnit"),
    playedYear: findHeaderIndex(
      headerIndexes,
      "Årstal afspillet",
      "Arstal afspillet"
    ),
    link: findHeaderIndex(headerIndexes, "Link"),
    givenRating: findHeaderIndex(
      headerIndexes,
      "Afgivet vurdering",
      "Afgivet vurd"
    ),
    image: findHeaderIndex(
      headerIndexes,
      "Billedlink",
      "Billede",
      "Cover",
      "Coverlink"
    )
  };

  return dataRows
    .map((originalRow) => {
      const row = maybeRepairShiftedRow([...originalRow], headerRow.length);

      const rawPodcast = {
        "Placering": firstNonBlank(getCell(row, indexes.placement), getCell(row, 0)),
        "Placeri": firstNonBlank(getCell(row, indexes.placement), getCell(row, 0)),
        "Titel": firstNonBlank(getCell(row, indexes.title), getCell(row, 1)),
        "Vært": firstNonBlank(getCell(row, indexes.host), getCell(row, 2)),
        "Vurdering (1-10)": firstNonBlank(getCell(row, indexes.rating), getCell(row, 3)),
        "Vuring (1-10)": firstNonBlank(getCell(row, indexes.rating), getCell(row, 3)),
        "Genre": firstNonBlank(getCell(row, indexes.genre), getCell(row, 4)),
        "Udgiver": firstNonBlank(getCell(row, indexes.publisher), getCell(row, 5)),
        "Antal afsnit": firstNonBlank(getCell(row, indexes.episodes), getCell(row, 6)),
        "Årstal afspillet": firstNonBlank(getCell(row, indexes.playedYear), getCell(row, 7)),
        "Link": firstNonBlank(getCell(row, indexes.link), getCell(row, 8)),
        "Afgivet vurdering": firstNonBlank(getCell(row, indexes.givenRating), getCell(row, 9)),
        "Billedlink": firstNonBlank(
          getCell(row, indexes.image),
          getCell(row, 10),
          getCell(row, 11)
        )
      };

      return normalizePodcastRow(rawPodcast);
    })
    .filter((podcast) => !isBlank(podcast["Titel"]));
}

function sortPodcasts(items, sortValue) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    switch (sortValue) {
      case "placement-desc":
        return parsePlacement(b["Placering"]) - parsePlacement(a["Placering"]);

      case "placement-asc":
        return parsePlacement(a["Placering"]) - parsePlacement(b["Placering"]);

      case "rating-asc":
        return (
          parseRating(a["Vurdering (1-10)"]) -
          parseRating(b["Vurdering (1-10)"])
        );

      case "rating-desc":
        return (
          parseRating(b["Vurdering (1-10)"]) -
          parseRating(a["Vurdering (1-10)"])
        );

      case "title-desc":
        return collator.compare(b["Titel"], a["Titel"]);

      case "title-asc":
        return collator.compare(a["Titel"], b["Titel"]);

      case "playedYear-asc":
        return (
          parsePlayedYear(a["Årstal afspillet"]) -
          parsePlayedYear(b["Årstal afspillet"])
        );

      case "playedYear-desc":
      default:
        return (
          parsePlayedYear(b["Årstal afspillet"]) -
          parsePlayedYear(a["Årstal afspillet"])
        );
    }
  });

  return sorted;
}

function filterPodcasts(items, query) {
  return items.filter((podcast) => {
    const matchesQuery = !query
      ? true
      : [podcast["Titel"], podcast["Vært"]]
          .map(normalizeText)
          .join(" ")
          .includes(normalizeText(query));

    const matchesGenre = !genreFilter.value
      ? true
      : normalizeText(podcast["Genre"]) === normalizeText(genreFilter.value);

    const matchesPublisher = !publisherFilter.value
      ? true
      : normalizeText(podcast["Udgiver"]) === normalizeText(publisherFilter.value);

    return matchesQuery && matchesGenre && matchesPublisher;
  });
}

function updateSummary(count, total) {
  const noun = count === 1 ? "podcast" : "podcasts";
  resultsText.textContent = `Viser ${count} ${noun} ud af ${total}.`;
}

function createCard(podcast) {
  const fragment = cardTemplate.content.cloneNode(true);
  const imageWrapper = fragment.querySelector(".card-media");
  const image = fragment.querySelector(".podcast-image");

  fragment.querySelector(".placement").textContent = `#${formatText(
    podcast["Placering"],
    "–"
  )}`;
  fragment.querySelector(".genre").textContent = formatText(podcast["Genre"]);
  fragment.querySelector(".rating").textContent = formatRating(
    podcast["Vurdering (1-10)"]
  );
  fragment.querySelector(".title").textContent = formatText(podcast["Titel"]);
  fragment.querySelector(".host").textContent = formatText(
    podcast["Vært"],
    "Vært ikke angivet"
  );
  fragment.querySelector(".publisher").textContent = formatText(
    podcast["Udgiver"]
  );
  fragment.querySelector(".played-year").textContent = formatText(
    podcast["Årstal afspillet"]
  );
  fragment.querySelector(".episodes").textContent = formatText(
    podcast["Antal afsnit"]
  );

  const imageUrl = formatText(podcast["Billedlink"], "");

  if (imageUrl && imageWrapper && image) {
    image.src = imageUrl;
    image.alt = `Cover til ${formatText(podcast["Titel"], "podcast")}`;
    image.style.display = "";
    imageWrapper.style.display = "";

    image.addEventListener("error", () => {
      image.style.display = "none";
      imageWrapper.style.display = "none";
    });
  } else if (imageWrapper) {
    imageWrapper.style.display = "none";
  }

  const linkButton = fragment.querySelector(".podcast-link");
  const link = formatText(podcast["Link"], "");

  if (link) {
    linkButton.addEventListener("click", () => {
      window.open(link, "_blank", "noreferrer");
    });
    linkButton.setAttribute(
      "aria-label",
      `Åbn podcasten ${formatText(podcast["Titel"], "podcast")}`
    );
  } else {
    linkButton.remove();
  }

  return fragment;
}

function populateFilters(items) {
  const genres = [
    ...new Set(
      items
        .map((podcast) => formatText(podcast["Genre"], ""))
        .filter(Boolean)
    )
  ].sort((a, b) => collator.compare(a, b));

  const publishers = [
    ...new Set(
      items
        .map((podcast) => formatText(podcast["Udgiver"], ""))
        .filter(Boolean)
    )
  ].sort((a, b) => collator.compare(a, b));

  populateFilterOptions(genreFilter, genres, "Alle genrer");
  populateFilterOptions(publisherFilter, publishers, "Alle udgivere");
}

function showLoadError(message) {
  resultsText.textContent = "Podcasts kunne ikke indlæses.";
  podcastGrid.innerHTML = `<div class="empty-state">${message}</div>`;
}

function renderPodcasts() {
  const query = searchInput.value.trim();
  const sortValue = sortSelect.value;
  const filtered = filterPodcasts(podcasts, query);
  const sorted = sortPodcasts(filtered, sortValue);

  podcastGrid.innerHTML = "";
  updateSummary(sorted.length, podcasts.length);

  if (sorted.length === 0) {
    podcastGrid.innerHTML =
      '<div class="empty-state">Ingen podcasts matcher din søgning. Prøv et andet ord eller vælg en anden sortering.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  sorted.forEach((podcast) => {
    fragment.appendChild(createCard(podcast));
  });

  podcastGrid.appendChild(fragment);
}

async function loadPodcasts() {
  try {
    const response = await fetch(DATA_URL, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Kunne ikke hente Google Sheets-data (${response.status}).`);
    }

    const csvText = await response.text();
    podcasts = mapCsvToPodcasts(csvText);

    if (!Array.isArray(podcasts) || podcasts.length === 0) {
      throw new Error("Data fra Google Sheets har ikke det forventede format.");
    }

    populateFilters(podcasts);
    renderPodcasts();
  } catch (error) {
    showLoadError(
      "Data kunne ikke indlæses fra Google Sheets. Tjek at arket er publiceret som CSV, og at kolonnerne stadig matcher siden."
    );
    console.error(error);
  }
}

searchInput.addEventListener("input", renderPodcasts);
genreFilter.addEventListener("change", renderPodcasts);
publisherFilter.addEventListener("change", renderPodcasts);
sortSelect.addEventListener("change", renderPodcasts);

loadPodcasts();
