const podcastGrid = document.querySelector("#podcastGrid");
const recentGrid = document.querySelector("#recentGrid");
const recentSummary = document.querySelector("#recentSummary");
const resultsText = document.querySelector("#resultsText");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const genreChips = document.querySelector("#genreChips");

const podcastCardTemplate = document.querySelector("#podcastCardTemplate");
const recentCardTemplate = document.querySelector("#recentCardTemplate");

const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub?gid=0&single=true&output=csv";

const FIXED_GENRES = [
  "Alle",
  "True Crime",
  "Historie",
  "Samfund",
  "Sport",
  "Dokumentar",
  "Viden",
  "Underholdning",
  "Sladder"
];

let podcasts = [];
let activeGenre = "Alle";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  renderGenreChips();

  try {
    const rows = await loadRows();
    podcasts = rows
      .map((row, index) => normalizePodcast(row, index))
      .filter((podcast) => podcast.title);

    renderAll();
  } catch (error) {
    console.error(error);
    podcastGrid.innerHTML = `<div class="empty-state">Kunne ikke indlæse podcastdata fra Google Sheets.</div>`;
    recentGrid.innerHTML = "";
    if (recentSummary) recentSummary.textContent = "";
    resultsText.textContent = "";
  }
}

function bindEvents() {
  searchInput.addEventListener("input", renderAll);
  sortSelect.addEventListener("change", renderAll);

  genreChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-genre]");
    if (!button) return;

    activeGenre = button.dataset.genre;
    renderGenreChips();
    renderAll();
  });
}

function renderAll() {
  const filtered = getFilteredAndSortedPodcasts();
  renderResults(filtered);
  renderPodcastGrid(filtered);
  renderRecentGrid();
}

function renderGenreChips() {
  genreChips.innerHTML = "";

  FIXED_GENRES.forEach((genre) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `genre-chip${genre === activeGenre ? " is-active" : ""}`;
    button.dataset.genre = genre;
    button.textContent = genre;
    genreChips.appendChild(button);
  });
}

function renderResults(filtered) {
  const noun = filtered.length === 1 ? "podcast" : "podcasts";
  resultsText.textContent = `Viser ${filtered.length} ${noun} ud af ${podcasts.length}.`;
}

function renderRecentGrid() {
  recentGrid.innerHTML = "";

  const recent = [...podcasts]
    .filter((podcast) => podcast.ratedDateSortable)
    .sort((a, b) => b.ratedDateSortable.localeCompare(a.ratedDateSortable))
    .slice(0, 3);

  if (recentSummary) {
    recentSummary.textContent = `Viser de ${recent.length} seneste bedømmelser`;
  }

  if (!recent.length) {
    recentGrid.innerHTML = `<div class="empty-state">Ingen nyere vurderinger at vise.</div>`;
    return;
  }

  recent.forEach((podcast) => {
    const node = recentCardTemplate.content.cloneNode(true);

    const media = node.querySelector(".recent-card__media");
    const title = node.querySelector(".recent-card__title");
    const host = node.querySelector(".recent-card__host");
    const rating = node.querySelector(".recent-card__rating");
    const date = node.querySelector(".recent-card__date");

    media.appendChild(createMediaNode(podcast.image, "small"));
    title.textContent = podcast.title;
    host.textContent = podcast.host || "Ukendt vært";
    rating.textContent = podcast.ratingLabel;
    date.textContent = podcast.ratedDate ? `Bedømt ${podcast.ratedDate}` : "";

    recentGrid.appendChild(node);
  });
}

function renderPodcastGrid(filtered) {
  podcastGrid.innerHTML = "";

  if (!filtered.length) {
    podcastGrid.innerHTML = `<div class="empty-state">Ingen podcasts matcher dit filter.</div>`;
    return;
  }

  filtered.forEach((podcast) => {
    const node = podcastCardTemplate.content.cloneNode(true);

    const placement = node.querySelector(".podcast-card__placement");
    const rating = node.querySelector(".podcast-card__rating");
    const media = node.querySelector(".podcast-card__media");
    const link = node.querySelector(".podcast-card__link");
    const title = node.querySelector(".podcast-card__title");
    const host = node.querySelector(".podcast-card__host");
    const chips = node.querySelector(".podcast-card__chips");

    placement.innerHTML = `
      <span class="placement-value">#<strong>${escapeHtml(
        String(podcast.placementLabel)
      )}</strong></span>
      <span class="placement-label">Placering</span>
    `;

    rating.textContent = podcast.ratingLabel;
    media.appendChild(createMediaNode(podcast.image, "large"));

    title.textContent = podcast.title;
    host.textContent = podcast.host || "Ukendt vært";

    const chipValues = [
      podcast.publisher,
      podcast.genre,
      podcast.episodesLabel
    ].filter(Boolean);

    chipValues.forEach((value) => {
      const chip = document.createElement("span");
      chip.className = "podcast-chip";
      chip.textContent = value;
      chips.appendChild(chip);
    });

    if (podcast.link) {
      link.href = podcast.link;
      link.removeAttribute("aria-disabled");
      link.style.pointerEvents = "";
      link.style.opacity = "";
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.style.pointerEvents = "none";
      link.style.opacity = "0.45";
    }

    podcastGrid.appendChild(node);
  });
}

function getFilteredAndSortedPodcasts() {
  const query = normalizeText(searchInput.value);

  const filtered = podcasts.filter((podcast) => {
    const matchesGenre =
      activeGenre === "Alle" || podcast.genre === activeGenre;

    const haystack = normalizeText(
      [podcast.title, podcast.host, podcast.publisher].filter(Boolean).join(" ")
    );

    const matchesSearch = !query || haystack.includes(query);

    return matchesGenre && matchesSearch;
  });

  filtered.sort((a, b) => {
    if (sortSelect.value === "placement-desc") {
      return b.placement - a.placement;
    }
    return a.placement - b.placement;
  });

  return filtered;
}

function createMediaNode(imageUrl, size = "large") {
  const cleanedUrl = extractUrl(imageUrl);

  if (cleanedUrl) {
    const img = document.createElement("img");
    img.src = cleanedUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      img.replaceWith(createPlaceholderNode(size));
    };
    return img;
  }

  return createPlaceholderNode(size);
}

function createPlaceholderNode(size = "large") {
  const wrapper = document.createElement("div");
  wrapper.className = "media-placeholder";

  const text = size === "small" ? "Billede mangler" : "Billede mangler";

  wrapper.innerHTML = `
    <div class="media-placeholder__inner">
      <div class="media-placeholder__icon"></div>
      <div class="media-placeholder__text">${text}</div>
    </div>
  `;

  return wrapper;
}

async function loadRows() {
  const response = await fetch(`${DATA_URL}&t=${Date.now()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("CSV-kilde kunne ikke indlæses");
  }

  const csv = await response.text();
  return parseCsv(csv);
}

function normalizePodcast(row, index) {
  const values = Array.isArray(row.__values) ? row.__values : [];
  const hasPlacementColumn = detectPlacementColumn(row, values);

  const fallback = hasPlacementColumn
    ? {
        placement: 0,
        title: 1,
        host: 2,
        rating: 3,
        genre: 4,
        publisher: 5,
        episodes: 6,
        yearPlayed: 7,
        link: 8,
        ratedDate: 9,
        image: 10
      }
    : {
        placement: null,
        title: 0,
        host: 1,
        rating: 2,
        genre: 3,
        publisher: 4,
        episodes: 5,
        yearPlayed: 6,
        link: 7,
        ratedDate: 8,
        image: 9
      };

  const placement =
    toNumber(
      getFieldByAliases(
        row,
        ["placering", "ranking", "rank"],
        fallback.placement
      )
    ) ?? index + 1;

  const title =
    getFieldByAliases(row, ["titel", "title"], fallback.title) || "";

  const host =
    getFieldByAliases(
      row,
      ["vaert", "vært", "vaerte", "værte", "host", "vaertmedvirkende"],
      fallback.host
    ) || "";

  const rawRating =
    getFieldByAliases(
      row,
      [
        "vuringvurdering110",
        "vuring110",
        "vurdering110",
        "vurdering",
        "rating"
      ],
      fallback.rating
    ) || "";

  const rawGenre =
    getFieldByAliases(row, ["genre"], fallback.genre) || "";

  const publisher =
    getFieldByAliases(
      row,
      ["udgiver", "publisher"],
      fallback.publisher
    ) || "";

  const episodes =
    getFieldByAliases(
      row,
      ["antalafsnit", "episodes"],
      fallback.episodes
    ) || "";

  const link =
    getFieldByAliases(
      row,
      ["link", "url"],
      fallback.link
    ) || "";

  const ratedDate =
    getFieldByAliases(
      row,
      ["afgivetvurdering", "bedomt", "bedømt", "dato", "date"],
      fallback.ratedDate
    ) || "";

  const image =
    getFieldByAliases(
      row,
      [
        "billedlinkbilledefil",
        "billedefil",
        "billedlink",
        "billedfil",
        "billede",
        "image",
        "cover"
      ],
      fallback.image
    ) || "";

  return {
    placement,
    placementLabel: placement,
    title: cleanValue(title),
    host: cleanValue(host),
    genre: normalizeGenre(rawGenre),
    publisher: cleanValue(publisher) || "Ukendt udgiver",
    episodesLabel: formatEpisodes(episodes),
    ratingValue: parseRating(rawRating),
    ratingLabel: formatRating(rawRating),
    link: extractUrl(link),
    ratedDate: formatDate(ratedDate),
    ratedDateSortable: sortableDate(ratedDate),
    image: extractUrl(image)
  };
}

function detectPlacementColumn(row, values) {
  const placementByHeader = getFieldByAliases(
    row,
    ["placering", "ranking", "rank"],
    null
  );

  if (placementByHeader) return true;

  if (!values.length) return false;

  const first = cleanValue(values[0]);
  const second = cleanValue(values[1]);

  if (toNumber(first) !== null && second) return true;

  return false;
}

function getFieldByAliases(row, aliases, fallbackIndex = null) {
  const aliasSet = new Set(aliases.map(normalizeHeader));

  for (const [key, value] of Object.entries(row)) {
    if (key === "__values") continue;
    if (!value && value !== 0) continue;

    const normalizedKey = normalizeHeader(key);
    if (aliasSet.has(normalizedKey) && cleanValue(value) !== "") {
      return String(value).trim();
    }
  }

  if (
    fallbackIndex !== null &&
    Array.isArray(row.__values) &&
    row.__values[fallbackIndex] !== undefined &&
    row.__values[fallbackIndex] !== null
  ) {
    return String(row.__values[fallbackIndex]).trim();
  }

  return "";
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeGenre(raw) {
  const value = normalizeText(raw);

  if (!value) return "Samfund";

  if (
    value.includes("true crime") ||
    value === "crime" ||
    value === "krimi" ||
    value.includes("svindel")
  ) {
    return "True Crime";
  }

  if (
    value.includes("fodbold") ||
    value.includes("cykling") ||
    value.startsWith("sport")
  ) {
    return "Sport";
  }

  if (value.includes("historie") || value.includes("krig")) {
    return "Historie";
  }

  if (
    value.includes("dokumentar") ||
    value.includes("dokimentar") ||
    value.includes("portrat") ||
    value.includes("portræt") ||
    value === "drama"
  ) {
    return "Dokumentar";
  }

  if (
    value.includes("viden") ||
    value.includes("videnskab") ||
    value.includes("forskning") ||
    value.includes("sundhed")
  ) {
    return "Viden";
  }

  if (
    value.includes("sladder") ||
    value.includes("gossip") ||
    value.includes("skandaler")
  ) {
    return "Sladder";
  }

  if (
    value.includes("underholdning") ||
    value.includes("unholdning") ||
    value.includes("humor") ||
    value.includes("tv") ||
    value.includes("film") ||
    value.includes("dating") ||
    value.includes("kaerlighed") ||
    value.includes("kærlighed") ||
    value.includes("kultur")
  ) {
    return "Underholdning";
  }

  if (
    value.includes("snak") ||
    value.includes("snakke") ||
    value.includes("politik") ||
    value.includes("nyhe") ||
    value.includes("samfund") ||
    value.includes("krise") ||
    value.includes("erhverv") ||
    value.includes("mediemagasin")
  ) {
    return "Samfund";
  }

  return "Samfund";
}

function formatEpisodes(value) {
  const cleaned = cleanValue(value);
  if (!cleaned) return "Ukendt antal";

  const numeric = cleaned.replace(/[^\d]/g, "");
  if (numeric) return `${numeric} afsnit`;

  return cleaned;
}

function parseRating(value) {
  const cleaned = cleanValue(value)
    .replace(",", ".")
    .replace("/10", "")
    .trim();

  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return null;

  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function formatRating(value) {
  const number = parseRating(value);
  if (number === null) return "Ikke vurderet";
  return `${number.toFixed(1).replace(".", ",")} / 10`;
}

function formatDate(value) {
  const cleaned = cleanValue(value);
  if (!cleaned) return "";

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) return cleaned;

  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split("-");
    return `${day}.${month}.${year}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split("-");
    return `${day}.${month}.${year}`;
  }

  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    const serial = Number(cleaned);
    if (Number.isFinite(serial) && serial > 20000 && serial < 90000) {
      const jsDate = googleSerialDateToJsDate(serial);
      if (jsDate) return formatJsDate(jsDate);
    }
  }

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return cleaned;

  return formatJsDate(parsed);
}

function sortableDate(value) {
  const cleaned = cleanValue(value);
  if (!cleaned) return "";

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split(".");
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split("-");
    return `${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    const serial = Number(cleaned);
    if (Number.isFinite(serial) && serial > 20000 && serial < 90000) {
      const jsDate = googleSerialDateToJsDate(serial);
      if (jsDate) return jsDate.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString().slice(0, 10);
}

function extractUrl(value) {
  const cleaned = cleanValue(value);
  if (!cleaned) return "";

  const quotedUrl = cleaned.match(/"(https?:\/\/[^"]+)"/i);
  if (quotedUrl) return quotedUrl[1].trim();

  const plainUrl = cleaned.match(/https?:\/\/[^\s",)]+/i);
  if (plainUrl) return plainUrl[0].trim();

  if (cleaned.startsWith("data:image/")) return cleaned;

  return cleaned;
}

function googleSerialDateToJsDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);

  if (Number.isNaN(dateInfo.getTime())) return null;
  return dateInfo;
}

function formatJsDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

function cleanValue(value) {
  return String(value || "").trim();
}

function toNumber(value) {
  const cleaned = cleanValue(value).replace(/[^\d.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(csvText) {
  const rows = [];
  const lines = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current !== "") lines.push(current);
      current = "";
      if (char === "\r" && next === "\n") i += 1;
    } else {
      current += char;
    }
  }

  if (current !== "") lines.push(current);
  if (!lines.length) return rows;

  const headers = splitCsvLine(lines[0]).map((header) =>
    header.replace(/^\uFEFF/, "").trim()
  );

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    if (!values.some((value) => String(value).trim())) continue;

    const row = { __values: values };
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((value) => value.trim());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}