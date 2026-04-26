const podcastGrid = document.querySelector("#podcastGrid");
const resultsText = document.querySelector("#resultsText");
const searchInput = document.querySelector("#searchInput");
const genreFilter = document.querySelector("#genreFilter");
const publisherFilter = document.querySelector("#publisherFilter");
const sortSelect = document.querySelector("#sortSelect");
const cardTemplate = document.querySelector("#podcastCardTemplate");

let podcasts = [];

const DATA_URL =
  "https://docs.google.com/spreadsheets/d/1V21y9uMx_fGethrT47hILWczgK_ZSNRfksSKWuR69ss/gviz/tq?tqx=out:json&gid=0";

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

function sanitizeHeader(header) {
  return String(header ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("da")
    .replace(/\s+/g, " ");
}

function parseGoogleVisualizationJson(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?$/);

  if (!match) {
    throw new Error("Kunne ikke læse Google Sheets JSON-svar.");
  }

  return JSON.parse(match[1]);
}

function extractCellValue(cell) {
  if (!cell) return "";

  if (cell.v === null || cell.v === undefined) {
    return "";
  }

  if (typeof cell.v === "string") {
    return cell.v.trim();
  }

  if (typeof cell.v === "number") {
    return String(cell.v).replace(".", ",");
  }

  return String(cell.v).trim();
}

function normalizePodcastRow(rawPodcast) {
  return {
    "Placering": firstNonBlank(rawPodcast["Placering"]),
    "Titel": firstNonBlank(rawPodcast["Titel"]),
    "Vært": firstNonBlank(rawPodcast["Vært"], rawPodcast["Vaert"]),
    "Vuring (1-10)": firstNonBlank(
      rawPodcast["Vuring (1-10)"],
      rawPodcast["Vurdering (1-10)"],
      rawPodcast["Vurdering"]
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
    "Billedlink": firstNonBlank(rawPodcast["Billedlink"])
  };
}

function mapGoogleSheetToPodcasts(sheetJson) {
  const table = sheetJson.table;
  const cols = table.cols || [];
  const rows = table.rows || [];

  const headers = cols.map((col) => sanitizeHeader(col.label || col.id || ""));
  const headerIndexes = new Map();

  headers.forEach((header, index) => {
    headerIndexes.set(header, index);
  });

  const findIndex = (...aliases) => {
    for (const alias of aliases) {
      const normalizedAlias = sanitizeHeader(alias);
      if (headerIndexes.has(normalizedAlias)) {
        return headerIndexes.get(normalizedAlias);
      }
    }
    return -1;
  };

  const indexes = {
    placement: findIndex("Placering"),
    title: findIndex("Titel"),
    host: findIndex("Vært", "Vaert"),
    rating: findIndex("Vuring (1-10)", "Vurdering (1-10)", "Vurdering"),
    genre: findIndex("Genre"),
    publisher: findIndex("Udgiver"),
    episodes: findIndex("Antal afsnit"),
    playedYear: findIndex("Årstal afspillet", "Arstal afspillet"),
    link: findIndex("Link"),
    givenRating: findIndex("Afgivet vurdering", "Afgivet vurd"),
    image: findIndex("Billedlink")
  };

  return rows
    .map((row) => {
      const cells = row.c || [];

      const rawPodcast = {
        "Placering": extractCellValue(cells[indexes.placement]),
        "Titel": extractCellValue(cells[indexes.title]),
        "Vært": extractCellValue(cells[indexes.host]),
        "Vuring (1-10)": extractCellValue(cells[indexes.rating]),
        "Genre": extractCellValue(cells[indexes.genre]),
        "Udgiver": extractCellValue(cells[indexes.publisher]),
        "Antal afsnit": extractCellValue(cells[indexes.episodes]),
        "Årstal afspillet": extractCellValue(cells[indexes.playedYear]),
        "Link": extractCellValue(cells[indexes.link]),
        "Afgivet vurdering": extractCellValue(cells[indexes.givenRating]),
        "Billedlink": extractCellValue(cells[indexes.image])
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
        return parseRating(a["Vuring (1-10)"]) - parseRating(b["Vuring (1-10)"]);

      case "rating-desc":
        return parseRating(b["Vuring (1-10)"]) - parseRating(a["Vuring (1-10)"]);

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
    podcast["Vuring (1-10)"]
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

    const rawText = await response.text();
    const sheetJson = parseGoogleVisualizationJson(rawText);
    podcasts = mapGoogleSheetToPodcasts(sheetJson);

    if (!Array.isArray(podcasts) || podcasts.length === 0) {
      throw new Error("Data fra Google Sheets har ikke det forventede format.");
    }

    populateFilters(podcasts);
    renderPodcasts();
  } catch (error) {
    showLoadError(
      "Data kunne ikke indlæses fra Google Sheets. Tjek at arket er publiceret, og at fanen hedder Ark1."
    );
    console.error(error);
  }
}

searchInput.addEventListener("input", renderPodcasts);
genreFilter.addEventListener("change", renderPodcasts);
publisherFilter.addEventListener("change", renderPodcasts);
sortSelect.addEventListener("change", renderPodcasts);

loadPodcasts();
