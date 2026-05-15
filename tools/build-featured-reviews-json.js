const FEATURED_REVIEW_SHEET_NAME = "Udvalgte vurderinger";
const MAIN_PODCAST_SHEET_NAME = "Ark1";

function installFeaturedReviewsTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "featuredReviewsOnEdit") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("featuredReviewsOnEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    "Automatisk trigger er installeret.\n\n" +
      "Fanen 'Udvalgte vurderinger' opdaterer nu automatisk anmeldelsesdato, samlet score, autofelter, visningsrækkefølge og vurdering i Ark1."
  );
}

function featuredReviewsOnEdit(e) {
  if (!e || !e.range || !e.source) return;

  const sheet = e.range.getSheet();

  if (sheet.getName() !== FEATURED_REVIEW_SHEET_NAME) return;
  if (e.range.getRow() === 1) return;

  updateFeaturedReviews();
}

function updateFeaturedReviews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName(MAIN_PODCAST_SHEET_NAME);
  const reviewSheet = ss.getSheetByName(FEATURED_REVIEW_SHEET_NAME);

  if (!mainSheet) {
    throw new Error("Fanen '" + MAIN_PODCAST_SHEET_NAME + "' blev ikke fundet.");
  }

  if (!reviewSheet) {
    throw new Error("Fanen '" + FEATURED_REVIEW_SHEET_NAME + "' blev ikke fundet.");
  }

  const mainData = mainSheet.getDataRange().getValues();
  const reviewData = reviewSheet.getDataRange().getValues();

  if (mainData.length < 2 || reviewData.length < 2) return;

  const mainCol = makeHeaderMap(mainData[0]);
  const reviewCol = makeHeaderMap(reviewData[0]);

  const cols = getFeaturedReviewColumns(reviewCol);
  const mainCols = getMainPodcastColumns(mainCol);

  const missingReview = getMissingFeaturedColumns(cols);
  const missingMain = getMissingMainColumns(mainCols);

  if (missingReview.length) {
    throw new Error("Udvalgte vurderinger mangler kolonner: " + missingReview.join(", "));
  }

  if (missingMain.length) {
    throw new Error("Ark1 mangler kolonner: " + missingMain.join(", "));
  }

  const podcastLookup = buildPodcastLookup(mainData, mainCols);
  const rowsToWrite = [];
  const displayOrderRows = [];
  const mainScoreUpdates = [];

  for (let r = 1; r < reviewData.length; r++) {
    const row = reviewData[r];
    const sheetRow = r + 1;

    const active = cleanCell(row[cols.active]);
    const title = cleanCell(row[cols.title]);
    const matchTitle = cleanCell(row[cols.matchTitle]) || title;
    const reviewText = cleanCell(row[cols.reviewText]);

    const rowHasContent = Boolean(title || matchTitle || reviewText);
    const hasReviewText = Boolean(reviewText);
    const isActive = isYesValue(active);

    if (!rowHasContent) {
      rowsToWrite.push({
        row: sheetRow,
        score: "",
        reviewDate: "",
        autoPublisher: "",
        autoLink: "",
        autoImage: "",
        autoGenre: "",
        autoHost: ""
      });
      continue;
    }

    const calculatedScore = calculateFeaturedScore(row, cols);
    const existingReviewDate = row[cols.reviewDate];

    let reviewDate = existingReviewDate;

    if (hasReviewText && !existingReviewDate) {
      reviewDate = new Date();
    }

    const matchKey = normalizeMatchKey(matchTitle);
    const match = podcastLookup[matchKey] || null;

    rowsToWrite.push({
      row: sheetRow,
      score: calculatedScore,
      reviewDate,
      autoPublisher: match ? match.publisher : "IKKE FUNDET",
      autoLink: match ? match.link : "",
      autoImage: match ? match.image : "",
      autoGenre: match ? match.genre : "",
      autoHost: match ? match.host : ""
    });

    if (isActive && reviewDate) {
      displayOrderRows.push({
        row: sheetRow,
        date: parseSheetDate(reviewDate),
        fallbackRow: sheetRow
      });
    }

    if (calculatedScore && match && match.mainRowNumber) {
      mainScoreUpdates.push({
        row: match.mainRowNumber,
        score: calculatedScore,
        reviewDate: reviewDate || new Date()
      });
    }
  }

  rowsToWrite.forEach(function(item) {
    reviewSheet.getRange(item.row, cols.score + 1).setValue(item.score);

    const dateCell = reviewSheet.getRange(item.row, cols.reviewDate + 1);
    dateCell.setValue(item.reviewDate);

    if (item.reviewDate) {
      dateCell.setNumberFormat("dd-MM-yyyy");
    }

    reviewSheet.getRange(item.row, cols.autoPublisher + 1).setValue(item.autoPublisher);
    reviewSheet.getRange(item.row, cols.autoLink + 1).setValue(item.autoLink);
    reviewSheet.getRange(item.row, cols.autoImage + 1).setValue(item.autoImage);
    reviewSheet.getRange(item.row, cols.autoGenre + 1).setValue(item.autoGenre);
    reviewSheet.getRange(item.row, cols.autoHost + 1).setValue(item.autoHost);
  });

  mainScoreUpdates.forEach(function(item) {
    mainSheet.getRange(item.row, mainCols.rating + 1).setValue(item.score);

    if (mainCols.ratingDate !== null) {
      const mainDateCell = mainSheet.getRange(item.row, mainCols.ratingDate + 1);
      const existingMainDate = mainDateCell.getValue();

      if (!existingMainDate) {
        mainDateCell.setValue(item.reviewDate || new Date()).setNumberFormat("dd-MM-yyyy");
      }
    }
  });

  updateDisplayOrder(reviewSheet, reviewData.length, cols, displayOrderRows);
}

function updateDisplayOrder(reviewSheet, dataLength, cols, displayOrderRows) {
  const orderColumn = cols.displayOrder + 1;

  if (dataLength > 1) {
    reviewSheet
      .getRange(2, orderColumn, dataLength - 1, 1)
      .clearContent();
  }

  displayOrderRows.sort(function(a, b) {
    const timeA = a.date ? a.date.getTime() : 0;
    const timeB = b.date ? b.date.getTime() : 0;

    if (timeB !== timeA) {
      return timeB - timeA;
    }

    return b.fallbackRow - a.fallbackRow;
  });

  displayOrderRows.forEach(function(item, index) {
    reviewSheet.getRange(item.row, orderColumn).setValue(index + 1);
  });
}

function calculateFeaturedScore(row, cols) {
  const story = parseScore(row[cols.story]);
  const narrator = parseScore(row[cols.narrator]);
  const sound = parseScore(row[cols.sound]);
  const relevanceRaw = row[cols.relevance];
  const relevance = parseScore(relevanceRaw);
  const relevanceIsNotRelevant = isNotRelevantValue(relevanceRaw);

  if (story === null || narrator === null || sound === null) {
    return "";
  }

  let score;

  if (relevanceIsNotRelevant) {
    score =
      0.50 * story +
      0.30 * narrator +
      0.20 * sound;
  } else {
    if (relevance === null) return "";

    score =
      0.40 * story +
      0.25 * narrator +
      0.20 * sound +
      0.15 * relevance;
  }

  return score.toFixed(1).replace(".", ",");
}

function getFeaturedReviewColumns(col) {
  return {
    active: findColumn(col, ["Aktiv"]),
    title: findColumn(col, ["Titel"]),
    matchTitle: findColumn(col, ["Matchtitel"]),
    reviewText: findColumn(col, ["Kort vurdering"]),

    story: findColumn(col, ["Historie", "Historie/sag"]),
    narrator: findColumn(col, [
      "Vært",
      "Vaert",
      "Fortæller",
      "Fortaeller",
      "Vært/formidling",
      "Vaert/formidling"
    ]),
    sound: findColumn(col, ["Lydside", "Produktion"]),
    relevance: findColumn(col, ["Aktualitet", "Aktualitet/relevans", "Relevans"]),

    score: findColumn(col, ["Samlet score"]),
    reviewDate: findColumn(col, ["Anmeldelsesdato", "Anmeldelsesdat", "Anmeldt"]),
    displayOrder: findColumn(col, [
      "Visningsrækkefølge",
      "Visningsraekkefolge",
      "Rækkefølge",
      "Raekkefolge"
    ]),

    autoPublisher: findColumn(col, ["Auto-udgiver"]),
    autoLink: findColumn(col, ["Auto-link"]),
    autoImage: findColumn(col, ["Auto-billedlink"]),
    autoGenre: findColumn(col, ["Auto-genre"]),
    autoHost: findColumn(col, ["Auto-vært", "Auto-vaert"])
  };
}

function getMainPodcastColumns(col) {
  return {
    placement: findColumn(col, ["Placering", "Rank", "Rangering"]),
    title: findColumn(col, ["Titel"]),
    host: findColumn(col, ["Vært", "Vaert", "Host", "Værter"]),
    rating: findColumn(col, [
      "Vuring",
      "Vuring (1-10)",
      "Vurdering",
      "Vurdering (1-10)",
      "Vuring/Vurdering",
      "Vuring/Vurdering (1-10)",
      "Rating",
      "Score"
    ]),
    genre: findColumn(col, ["Genre"]),
    publisher: findColumn(col, ["Udgiver", "Publisher"]),
    episodes: findColumn(col, ["Antal afsnit", "Afsnit", "Episodes"]),
    yearPlayed: findColumn(col, ["Årstal afspillet", "Aarstal afspillet", "År", "Aar"]),
    link: findColumn(col, ["Link", "URL"]),
    ratingDate: findColumn(col, ["Afgivet vurdering", "Dato", "Vurderingsdato", "Bedømt"]),
    image: findColumn(col, ["Billedlink", "Billedefil", "Billede", "Cover", "Image"]),
    description: findColumn(col, ["Kort beskrivelse", "Kortbeskrivelse", "Beskrivelse", "Description"])
  };
}

function getMissingFeaturedColumns(cols) {
  const required = [
    ["Aktiv", cols.active],
    ["Titel", cols.title],
    ["Matchtitel", cols.matchTitle],
    ["Kort vurdering", cols.reviewText],
    ["Historie", cols.story],
    ["Vært/Fortæller", cols.narrator],
    ["Lydside", cols.sound],
    ["Aktualitet", cols.relevance],
    ["Samlet score", cols.score],
    ["Anmeldelsesdato", cols.reviewDate],
    ["Visningsrækkefølge", cols.displayOrder],
    ["Auto-udgiver", cols.autoPublisher],
    ["Auto-link", cols.autoLink],
    ["Auto-billedlink", cols.autoImage],
    ["Auto-genre", cols.autoGenre],
    ["Auto-vært", cols.autoHost]
  ];

  return required
    .filter(function(item) {
      return item[1] === null;
    })
    .map(function(item) {
      return item[0];
    });
}

function getMissingMainColumns(cols) {
  const required = [
    ["Titel", cols.title],
    ["Vært", cols.host],
    ["Vurdering/Vuring", cols.rating],
    ["Genre", cols.genre],
    ["Udgiver", cols.publisher],
    ["Link", cols.link],
    ["Billedlink", cols.image],
    ["Afgivet vurdering", cols.ratingDate]
  ];

  return required
    .filter(function(item) {
      return item[1] === null;
    })
    .map(function(item) {
      return item[0];
    });
}

function buildPodcastLookup(mainData, mainCols) {
  const grouped = {};

  for (let i = 1; i < mainData.length; i++) {
    const row = mainData[i];
    const title = cleanCell(row[mainCols.title]);

    if (!title) continue;

    const key = normalizeMatchKey(title);

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push({
      mainRowNumber: i + 1,
      title,
      placement: getOptionalCell(row, mainCols.placement),
      publisher: getOptionalCell(row, mainCols.publisher),
      link: getOptionalCell(row, mainCols.link),
      image: getOptionalCell(row, mainCols.image),
      genre: getOptionalCell(row, mainCols.genre),
      host: getOptionalCell(row, mainCols.host),
      episodes: getOptionalCell(row, mainCols.episodes),
      yearPlayed: getOptionalCell(row, mainCols.yearPlayed),
      description: getOptionalCell(row, mainCols.description),
      ratingDate: getOptionalCell(row, mainCols.ratingDate)
    });
  }

  const lookup = {};

  Object.keys(grouped).forEach(function(key) {
    lookup[key] = pickBestMainPodcastRow(grouped[key]);
  });

  return lookup;
}

function pickBestMainPodcastRow(rows) {
  if (!rows.length) return null;

  const scored = rows.map(function(item) {
    let score = 0;

    if (item.yearPlayed) score += 100;
    if (item.link) score += 60;
    if (item.image) score += 50;
    if (item.description) score += 40;
    if (item.episodes) score += 25;
    if (item.publisher) score += 20;
    if (item.genre) score += 15;
    if (item.host) score += 15;
    if (item.ratingDate) score += 10;

    const placementNumber = parseFloat(String(item.placement || "").replace(",", "."));
    if (!isNaN(placementNumber)) {
      score += Math.max(0, 1000 - placementNumber) / 10000;
    }

    return {
      item,
      score
    };
  });

  scored.sort(function(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.item.mainRowNumber - b.item.mainRowNumber;
  });

  return scored[0].item;
}

function getOptionalCell(row, columnIndex) {
  if (columnIndex === null || columnIndex === undefined) return "";
  return cleanCell(row[columnIndex]);
}

function makeHeaderMap(headers) {
  const map = {};

  headers.forEach(function(header, index) {
    map[normalizeHeader(header)] = index;
  });

  return map;
}

function findColumn(map, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const key = normalizeHeader(candidates[i]);

    if (map[key] !== undefined) {
      return map[key];
    }
  }

  return null;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ");
}

function cleanCell(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeMatchKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9æøå ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseScore(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }

  const text = cleanCell(value);

  if (!text) return null;
  if (isNotRelevantValue(text)) return null;

  let cleaned = text.replace(/[^\d,.\-]/g, "");

  if (cleaned.indexOf(",") !== -1) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const number = parseFloat(cleaned);

  return isNaN(number) ? null : number;
}

function parseSheetDate(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return isNaN(value.getTime()) ? null : value;
  }

  const text = cleanCell(value);

  const parts = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);

  if (parts) {
    const day = Number(parts[1]);
    const month = Number(parts[2]) - 1;
    const year = Number(parts[3].length === 2 ? "20" + parts[3] : parts[3]);
    const date = new Date(year, month, day);

    return isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(text);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function isNotRelevantValue(value) {
  const text = cleanCell(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    text === "ikke relevant" ||
    text === "irrelevant" ||
    text === "n/a" ||
    text === "na" ||
    text === "-"
  );
}

function isYesValue(value) {
  const text = cleanCell(value)
    .toLowerCase()
    .trim();

  return (
    text === "ja" ||
    text === "yes" ||
    text === "1" ||
    text === "true"
  );
}
