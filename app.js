const podcastGrid = document.querySelector("#podcastGrid");
const recentGrid = document.querySelector("#recentGrid");
const recentSummary = document.querySelector("#recentSummary");
const resultsText = document.querySelector("#resultsText");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const genreChips = document.querySelector("#genreChips");
const cardTemplate = document.querySelector("#podcastCardTemplate");
const recentCardTemplate = document.querySelector("#recentCardTemplate");

let podcasts = [];
let activeGenre = "Alle";

const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub?gid=0&single=true&output=csv";

const FIXED_GENRES = [
  "Alle",
  "True Crime",
  "Historie",
  "Samfund",
  "Dokumentar",
  "Kultur",
  "Sport",
  "Humor"
];

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
    .replace(/\u00A0/g, " ")
    .replace(/["']/g, "")
    .trim();
}

function parseRating(value) {
  if (typeof value === "number") return value;
  if (isBlank(value)) return Number.NEGATIVE_INFINITY;

  const cleaned = cleanNumericText(value);
  const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);

  if (!match) return Number.NEGATIVE_INFINITY;

  const numeric = Number.parseFloat(match[0].replace(",", "."));
  return Number.isNaN(numeric) ? Number.NEGATIVE_INFINITY : numeric;
}

function formatRating(value) {
  const numeric = parseRating(value);

  if (numeric === Number.NEGATIVE_INFINITY) {
    return "Ikke vurderet";
  }

  return `${numeric.toFixed(1).replace(".", ",")} / 10`;
}

function parsePlacement(value) {
  const numeric = Number.parseInt(cleanNumericText(value), 10);
  return Number.isNaN(numeric) ? Number.POSITIVE_INFINITY : numeric;
}

function parseDateDMY(value) {
  if (isBlank(value)) return null;

  const match = String(value).trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateDMY(dateValue) {
  const parsed = parseDateDMY(dateValue);
  if (!parsed) return "";

  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yyyy = parsed.getFullYear();

  return `${dd}.${mm}.${yyyy}`;
}

function populateGenreChips() {
  genreChips.innerHTML = "";

  FIXED_GENRES.forEach((genre) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `genre-chip${genre === activeGenre ? " active" : ""}`;
    button.textContent = genre;

    button.addEventListener("click", () => {
      activeGenre = genre;
      populateGenreChips();
      renderPodcasts();
    });

    genreChips.appendChild(button);
  });
}

function sanitizeHeader(header) {
  return String(header ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("da")
    .replace(/\s+/g, " ");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  const normalized = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\n" && !insideQuotes) {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  rows.push(row);

  return rows
    .map((currentRow) => currentRow.map((cell) => String(cell ?? "").trim()))
    .filter((currentRow) => currentRow.some((cell) => !isBlank(cell)));
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

function getCell(row, index) {
  return index >= 0 && index < row.length ? String(row[index] ?? "").trim() : "";
}

function normalizeGenre(genre) {
  const g = normalizeText(genre);

  if (g.includes("true")) return "True Crime";
  if (g.includes("histor")) return "Historie";
  if (g.includes("polit")) return "Samfund";
  if (g.includes("samfund")) return "Samfund";
  if (g.includes("nyhe")) return "Samfund";
  if (g.includes("dok")) return "Dokumentar";
  if (g.includes("kultur")) return "Kultur";
  if (g.includes("sport") || g.includes("fodbold")) return "Sport";
  if (g.includes("humor") || g.includes("komed")) return "Humor";

  return formatText(genre, "");
}

function normalizePodcastRow(rawPodcast) {
  return {
    Placering: firstNonBlank(rawPodcast["Placering"]),
    Titel: firstNonBlank(rawPodcast["Titel"]),
    Vært: firstNonBlank(rawPodcast["Vært"], rawPodcast["Vaert"]),
    "Vuring (1-10)": firstNonBlank(
      rawPodcast["Vuring (1-10)"],
      rawPodcast["Vurdering (1-10)"],
      rawPodcast["Vurdering"]
    ),
    Genre: normalizeGenre(firstNonBlank(rawPodcast["Genre"])),
    Udgiver: firstNonBlank(rawPodcast["Udgiver"]),
    "Antal afsnit": firstNonBlank(rawPodcast["Antal afsnit"]),
    Link: firstNonBlank(rawPodcast["Link"]),
    "Afgivet vurdering": firstNonBlank(
      rawPodcast["Afgivet vurdering"],
      rawPodcast["Afgivet vurd"]
    ),
    Billedlink: firstNonBlank(rawPodcast["Billedlink"])
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
    placement: findHeaderIndex(headerIndexes, "Placering"),
    title: findHeaderIndex(headerIndexes, "Titel"),
    host: findHeaderIndex(headerIndexes, "Vært", "Vaert"),
    rating: findHeaderIndex(
      headerIndexes,
      "Vuring (1-10)",
      "Vurdering (1-10)",
      "Vurdering"
    ),
    genre: findHeaderIndex(headerIndexes, "Genre"),
    publisher: findHeaderIndex(headerIndexes, "Udgiver"),
    episodes: findHeaderIndex(headerIndexes, "Antal afsnit"),
    link: findHeaderIndex(headerIndexes, "Link"),
    givenRating: findHeaderIndex(
      headerIndexes,
      "Afgivet vurdering",
      "Afgivet vurd"
    ),
    image: findHeaderIndex(headerIndexes, "Billedlink")
  };

  return dataRows
    .map((row) => {
      const rawPodcast = {
        Placering: getCell(row, indexes.placement),
        Titel: getCell(row, indexes.title),
        Vært: getCell(row, indexes.host),
        "Vuring (1-10)": getCell(row, indexes.rating),
        Genre: getCell(row, indexes.genre),
        Udgiver: getCell(row, indexes.publisher),
        "Antal afsnit": getCell(row, indexes.episodes),
        Link: getCell(row, indexes.link),
        "Afgivet vurdering": getCell(row, indexes.givenRating),
        Billedlink: getCell(row, indexes.image)
      };

      return normalizePodcastRow(rawPodcast);
    })
    .filter((podcast) => !isBlank(podcast.Titel));
}

function sortPodcasts(items, sortValue) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    switch (sortValue) {
      case "placement-desc":
        return parsePlacement(b.Placering) - parsePlacement(a.Placering);

      case "placement-asc":
        return parsePlacement(a.Placering) - parsePlacement(b.Placering);

      case "rating-asc":
        return parseRating(a["Vuring (1-10)"]) - parseRating(b["Vuring (1-10)"]);

      case "rating-desc":
        return parseRating(b["Vuring (1-10)"]) - parseRating(a["Vuring (1-10)"]);

      case "title-desc":
        return collator.compare(b.Titel, a.Titel);

      case "title-asc":
      default:
        return collator.compare(a.Titel, b.Titel);
    }
  });

  return sorted;
}

function filterPodcasts(items, query) {
  return items.filter((podcast) => {
    const matchesQuery = !query
      ? true
      : [podcast.Titel, podcast.Vært]
          .map(normalizeText)
          .join(" ")
          .includes(normalizeText(query));

    const matchesGenre =
      activeGenre === "Alle"
        ? true
        : normalizeText(podcast.Genre) === normalizeText(activeGenre);

    return matchesQuery && matchesGenre;
  });
}

function getRecentRatedPodcasts(items, limit = 3) {
  return [...items]
    .filter((podcast) => parseDateDMY(podcast["Afgivet vurdering"]))
    .sort((a, b) => {
      const aDate = parseDateDMY(a["Afgivet vurdering"]);
      const bDate = parseDateDMY(b["Afgivet vurdering"]);
      return bDate - aDate;
    })
    .slice(0, limit);
}

function updateSummary(count, total) {
  const noun = count === 1 ? "podcast" : "podcasts";
  resultsText.textContent = `Viser ${count} ${noun} ud af ${total}.`;
}

function setImage(imageElement, wrapperElement, imageUrl, altText) {
  if (imageUrl && wrapperElement && imageElement) {
    imageElement.src = imageUrl;
    imageElement.alt = altText;
    imageElement.style.display = "";
    wrapperElement.style.display = "";

    imageElement.addEventListener(
      "error",
      () => {
        imageElement.style.display = "none";
        wrapperElement.style.display = "none";
      },
      { once: true }
    );
  } else if (wrapperElement) {
    wrapperElement.style.display = "none";
  }
}

function createRecentCard(podcast) {
  const fragment = recentCardTemplate.content.cloneNode(true);
  const coverWrap = fragment.querySelector(".recent-cover-wrap");
  const cover = fragment.querySelector(".recent-cover");

  setImage(
    cover,
    coverWrap,
    formatText(podcast.Billedlink, ""),
    `Cover til ${formatText(podcast.Titel, "podcast")}`
  );

  fragment.querySelector(".recent-title").textContent = formatText(podcast.Titel);
  fragment.querySelector(".recent-host").textContent = formatText(
    podcast.Vært,
    "Vært ikke angivet"
  );
  fragment.querySelector(".recent-rating").textContent = formatRating(
    podcast["Vuring (1-10)"]
  );
  fragment.querySelector(".recent-date").textContent = parseDateDMY(
    podcast["Afgivet vurdering"]
  )
    ? `Bedømt ${formatDateDMY(podcast["Afgivet vurdering"])}`
    : "";

  return fragment;
}

function renderRecentRated() {
  const recentItems = getRecentRatedPodcasts(podcasts, 3);
  recentGrid.innerHTML = "";

  if (recentItems.length === 0) {
    recentGrid.innerHTML =
      '<div class="empty-state">Ingen nylige bedømmelser fundet endnu.</div>';
    recentSummary.textContent = "Ingen datoer fundet endnu";
    return;
  }

  recentSummary.textContent = `Viser de ${recentItems.length} seneste bedømmelser`;

  const fragment = document.createDocumentFragment();
  recentItems.forEach((podcast) => fragment.appendChild(createRecentCard(podcast)));
  recentGrid.appendChild(fragment);
}

function createCard(podcast) {
  const fragment = cardTemplate.content.cloneNode(true);
  const placementValue = fragment.querySelector(".placement-value");
  const coverWrap = fragment.querySelector(".cover-wrap");
  const image = fragment.querySelector(".podcast-image");

  placementValue.textContent = `#${formatText(podcast.Placering, "–")}`;

  fragment.querySelector(".card-rating").textContent = formatRating(
    podcast["Vuring (1-10)"]
  );

  setImage(
    image,
    coverWrap,
    formatText(podcast.Billedlink, ""),
    `Cover til ${formatText(podcast.Titel, "podcast")}`
  );

  fragment.querySelector(".title").textContent = formatText(podcast.Titel);
  fragment.querySelector(".host").textContent = formatText(
    podcast.Vært,
    "Vært ikke angivet"
  );
  fragment.querySelector(".publisher").textContent = formatText(
    podcast.Udgiver,
    "Ukendt udgiver"
  );
  fragment.querySelector(".genre").textContent = formatText(
    podcast.Genre,
    "Ukendt genre"
  );
  fragment.querySelector(".episodes").textContent = formatText(
    podcast["Antal afsnit"],
    "Ukendt antal"
  );

  const linkButton = fragment.querySelector(".podcast-link");
  const link = formatText(podcast.Link, "");

  if (link) {
    linkButton.addEventListener("click", () => {
      window.open(link, "_blank", "noreferrer");
    });
    linkButton.setAttribute(
      "aria-label",
      `Åbn podcasten ${formatText(podcast.Titel, "podcast")}`
    );
  } else {
    linkButton.remove();
  }

  return fragment;
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
      '<div class="empty-state">Ingen podcasts matcher din søgning. Prøv et andet ord eller vælg en anden genre.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  sorted.forEach((podcast) => fragment.appendChild(createCard(podcast)));
  podcastGrid.appendChild(fragment);
}

function showLoadError(message) {
  resultsText.textContent = "Podcasts kunne ikke indlæses.";
  recentGrid.innerHTML = `<div class="empty-state">${message}</div>`;
  podcastGrid.innerHTML = `<div class="empty-state">${message}</div>`;
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

    populateGenreChips();
    renderRecentRated();
    renderPodcasts();
  } catch (error) {
    showLoadError(
      "Data kunne ikke indlæses fra Google Sheets. Tjek at arket fortsat er publiceret som CSV."
    );
    console.error(error);
  }
}

searchInput.addEventListener("input", renderPodcasts);
sortSelect.addEventListener("change", renderPodcasts);

loadPodcasts();
