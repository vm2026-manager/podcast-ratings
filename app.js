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

function parseRating(value) {
  if (typeof value === "number") {
    return value;
  }

  if (isBlank(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  const normalized = String(value).replace(",", ".").trim();
  const numeric = Number.parseFloat(normalized);

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
  const numeric = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(numeric) ? Number.POSITIVE_INFINITY : numeric;
}

function parsePlayedYear(value) {
  if (isBlank(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  const match = String(value).match(/\d{4}/);
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

function detectDelimiter(headerLine) {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvRow(row, delimiter) {
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
  return values;
}

function parseCsv(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = normalized.split("\n")[0] || "";
  const delimiter = detectDelimiter(firstLine);

  const rows = [];
  let currentRow = "";
  let insideQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const nextCharacter = normalized[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentRow += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
        currentRow += character;
      }
    } else if (character === "\n" && !insideQuotes) {
      rows.push(parseCsvRow(currentRow, delimiter));
      currentRow = "";
    } else {
      currentRow += character;
    }
  }

  if (currentRow) {
    rows.push(parseCsvRow(currentRow, delimiter));
  }

  return rows.filter((row) => row.some((cell) => !isBlank(cell)));
}

function sanitizeHeader(header) {
  return String(header)
    .trim()
    .toLocaleLowerCase("da")
    .replace(/\s+/g, " ");
}

function normalizePodcastRow(rawPodcast) {
  return {
    "Placering":
      rawPodcast["Placering"] ??
      rawPodcast["Placeri"] ??
      rawPodcast["Placering "] ??
      "",
    "Titel": rawPodcast["Titel"] ?? "",
    "Vært": rawPodcast["Vært"] ?? "",
    "Vurdering (1-10)":
      rawPodcast["Vurdering (1-10)"] ??
      rawPodcast["Vuring (1-10)"] ??
      "",
    "Genre": rawPodcast["Genre"] ?? "",
    "Udgiver": rawPodcast["Udgiver"] ?? "",
    "Antal afsnit": rawPodcast["Antal afsnit"] ?? "",
    "Årstal afspillet": rawPodcast["Årstal afspillet"] ?? "",
    "Link": rawPodcast["Link"] ?? "",
    "Afgivet vurdering": rawPodcast["Afgivet vurdering"] ?? "",
    "Billedlink": rawPodcast["Billedlink"] ?? ""
  };
}

function mapCsvToPodcasts(csvText) {
  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    throw new Error("CSV-filen indeholder ikke nok rækker.");
  }

  const [headerRow, ...dataRows] = rows;
  const normalizedHeaders = headerRow.map((header) => sanitizeHeader(header));
  const headerIndexes = new Map();

  normalizedHeaders.forEach((header, index) => {
    headerIndexes.set(header, index);
  });

  const aliases = {
    placering: "Placering",
    placeri: "Placeri",
    titel: "Titel",
    vært: "Vært",
    "vurdering (1-10)": "Vurdering (1-10)",
    "vuring (1-10)": "Vuring (1-10)",
    genre: "Genre",
    udgiver: "Udgiver",
    "antal afsnit": "Antal afsnit",
    "årstal afspillet": "Årstal afspillet",
    link: "Link",
    "afgivet vurdering": "Afgivet vurdering",
    billedlink: "Billedlink"
  };

  return dataRows.map((row) => {
    const rawPodcast = {};

    Object.entries(aliases).forEach(([normalizedHeader, targetKey]) => {
      const headerIndex = headerIndexes.has(normalizedHeader)
        ? headerIndexes.get(normalizedHeader)
        : -1;

      rawPodcast[targetKey] =
        headerIndex >= 0 ? String(row[headerIndex] ?? "").trim() : "";
    });

    return normalizePodcastRow(rawPodcast);
  });
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

  const hostText = formatText(podcast["Vært"], "Vært ikke angivet");
  fragment.querySelector(".host").textContent = hostText;

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

  if (imageUrl) {
    image.src = imageUrl;
    image.alt = `Cover til ${formatText(podcast["Titel"], "podcast")}`;
    image.addEventListener("error", () => {
      imageWrapper.remove();
    });
  } else if (imageWrapper) {
    imageWrapper.remove();
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
