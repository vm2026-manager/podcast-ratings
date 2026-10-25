/**
 * Owner-run, review-before-write bridge from a separate DR staging sheet to
 * this bound original spreadsheet. The GitHub service account must never be
 * shared on this original workbook. All gates default closed.
 */
var ORIGINAL_SPREADSHEET_ID_ = "1V21y9uMx_fGethrT47hILWczgK_ZSNRfksSKWuR69ss";
var TARGET_TAB_NAME_ = "Ark1";
var TARGET_TAB_ID_ = 0;
var STAGING_TAB_NAME_ = "DR staging";
var HEADERS_ = [
  "Placering", "Titel", "Vært", "Vuring (1-10)", "Genre", "Udgiver", "Hovedserie",
  "Antal afsnit", "Årstal afspillet", "Link", "Afgivet vurdering", "Billedlink",
  "Kort beskrivelse", "Undervurderet perle", "Lang beskrivelse", "2. genre", "Emner",
  "Episoder", "Feed", "Supplerende ligheder", "Uaktuel", "Podcast-ID", "Adgang",
  "Kilde", "Tjekket dato", "Engelsk", "", "", "", "", "Nævneværdige episo:"
];
var STAGING_HEADERS_ = HEADERS_.concat([
  "DR source GUID", "DR source URL", "DR source description", "Review status"
]);

function onOpen() {
  SpreadsheetApp.getUi().createMenu("DR staging")
    .addItem("Gennemgå og tilføj verificerede serier", "reviewAndAppendDrStagingRows")
    .addToUi();
}

function reviewAndAppendDrStagingRows() {
  var ui = SpreadsheetApp.getUi();
  var context = assertOwnerConfiguration_();
  var data = readStaging_(context.stagingId);
  var target = context.original.getSheetByName(TARGET_TAB_NAME_);
  assertTargetSchema_(target);
  var ids = readUniqueTargetIds_(target);
  var idColumn = HEADERS_.indexOf("Podcast-ID");
  var candidates = [];
  for (var i = 1; i < data.values.length; i += 1) {
    var row = data.values[i];
    if (!String(row[idColumn] || "").trim()) continue;
    var candidate = validateStagingCandidate_(row, data.formulas[i]);
    var existing = ids.get(candidate.id);
    if (existing) {
      if (existing.title !== candidate.title || existing.series !== candidate.series) {
        throw new Error("Podcast-ID findes allerede med en anden identitet; append stoppet.");
      }
      continue;
    }
    candidates.push({ sourceRow: i + 1, row: row.slice(0, HEADERS_.length), candidate: candidate });
  }
  if (!candidates.length) {
    ui.alert("Ingen nye staging-rækker at gennemgå. Eksisterende Podcast-ID'er blev ikke ændret.");
    return;
  }
  var appended = 0;
  candidates.forEach(function (item) {
    var c = item.candidate;
    var prompt = ui.prompt(
      "Gennemgå DR-kilde før append",
      "Podcast-ID: " + c.id + "\nTitel: " + c.title + "\nHovedserie: " + c.series +
        "\nGenre: " + c.genre + "\n2. genre: " + c.secondaryGenre + "\nEmner: " + c.topics +
        "\nSupplerende ligheder: " + c.similarities + "\nKilde: " + c.sourceUrl +
        "\n\nKort beskrivelse:\n" + c.shortDescription + "\n\nLang beskrivelse:\n" + c.longDescription +
        "\n\nKildetekst:\n" + c.sourceDescription +
        "\n\nKontrollér DR-kilden og metadata. Skriv præcist APPEND " + c.id + " for at tilføje én ny række. Alle andre svar springer rækken over.",
      ui.ButtonSet.OK_CANCEL
    );
    if (prompt.getSelectedButton() !== ui.Button.OK || prompt.getResponseText().trim() !== "APPEND " + c.id) return;
    appendOneReviewedRow_(context, item);
    appended += 1;
  });
  ui.alert("Gennemgang afsluttet. Nye rækker tilføjet: " + appended + ". Eksisterende rækker blev ikke redigeret.");
}

function assertOwnerConfiguration_() {
  var properties = PropertiesService.getScriptProperties();
  var original = SpreadsheetApp.getActiveSpreadsheet();
  var userEmail = Session.getEffectiveUser().getEmail();
  if (!original || original.getId() !== ORIGINAL_SPREADSHEET_ID_) throw new Error("Scriptet er ikke bundet til det godkendte originalark.");
  if (!userEmail || userEmail !== properties.getProperty("OWNER_EMAIL")) throw new Error("Kun den konfigurerede ejer må køre append-gaten.");
  if (properties.getProperty("APPEND_ENABLED") !== "true") throw new Error("Append-gaten er deaktiveret.");
  if (properties.getProperty("BACKUP_RESTORE_TEST_VERIFIED") !== "true") throw new Error("Uafhængig fuld backup og restore-test er ikke verificeret.");
  var backupId = properties.getProperty("BACKUP_SPREADSHEET_ID");
  if (!backupId || backupId === ORIGINAL_SPREADSHEET_ID_) throw new Error("Uafhængig backup-ID mangler eller er ugyldigt.");
  var backupVerifiedAt = Date.parse(properties.getProperty("BACKUP_VERIFIED_AT") || "");
  if (!Number.isFinite(backupVerifiedAt) || Date.now() - backupVerifiedAt > 4 * 60 * 60 * 1000 || backupVerifiedAt > Date.now() + 5 * 60 * 1000) {
    throw new Error("Frisk, ejerverificeret backup mangler; verificeringen må højst være fire timer gammel.");
  }
  var stagingId = properties.getProperty("STAGING_SPREADSHEET_ID");
  if (!stagingId || stagingId === ORIGINAL_SPREADSHEET_ID_ || stagingId === backupId) throw new Error("Separat DR staging-regneark mangler.");
  return { original: original, properties: properties, stagingId: stagingId, userEmail: userEmail };
}

function readStaging_(stagingId) {
  var staging = SpreadsheetApp.openById(stagingId);
  var tab = staging.getSheetByName(STAGING_TAB_NAME_);
  if (!tab) throw new Error("DR staging-fanebladet mangler.");
  var values = tab.getDataRange().getValues();
  var formulas = tab.getDataRange().getFormulas();
  if (!values.length || !sameArray_(values[0].slice(0, STAGING_HEADERS_.length), STAGING_HEADERS_) ||
      values[0].length !== STAGING_HEADERS_.length) throw new Error("DR staging-header afviger; append stoppet.");
  return { values: values, formulas: formulas };
}

function assertTargetSchema_(target) {
  if (!target || target.getSheetId() !== TARGET_TAB_ID_ || target.getName() !== TARGET_TAB_NAME_) {
    throw new Error("Originalens Ark1/gid=0 kunne ikke verificeres.");
  }
  var actual = target.getRange(1, 1, 1, HEADERS_.length).getDisplayValues()[0];
  if (!sameArray_(actual, HEADERS_)) throw new Error("Original Ark1 header afviger; append stoppet.");
}

function readUniqueTargetIds_(target) {
  var rows = target.getLastRow();
  var values = rows > 1 ? target.getRange(2, 1, rows - 1, HEADERS_.length).getValues() : [];
  var ids = new Map();
  var idIndex = HEADERS_.indexOf("Podcast-ID");
  values.forEach(function (row, index) {
    var id = String(row[idIndex] || "").normalize("NFC").trim();
    if (!id) {
      if (row.some(function (cell) { return String(cell || "").trim() !== ""; })) throw new Error("Originalen har udfyldt række uden Podcast-ID.");
      return;
    }
    if (ids.has(id)) throw new Error("Originalen har dubleret Podcast-ID; append stoppet.");
    ids.set(id, { title: String(row[HEADERS_.indexOf("Titel")] || "").trim(), series: String(row[HEADERS_.indexOf("Hovedserie")] || "").trim(), rowNumber: index + 2 });
  });
  return ids;
}

function validateStagingCandidate_(row, formulas) {
  if (formulas.some(function (formula) { return Boolean(formula); })) throw new Error("Formler i staging-rækken er ikke tilladt.");
  var get = function (header) { return String(row[STAGING_HEADERS_.indexOf(header)] || "").normalize("NFC").trim(); };
  var id = get("Podcast-ID");
  var title = get("Titel");
  var series = get("Hovedserie");
  var sourceUrl = get("DR source URL");
  var sourceGuid = get("DR source GUID");
  var sourceDescription = get("DR source description");
  var shortDescription = get("Kort beskrivelse");
  var longDescription = get("Lang beskrivelse");
  var genre = get("Genre");
  var secondaryGenre = get("2. genre");
  var topics = get("Emner");
  var similarities = get("Supplerende ligheder");
  if (!id || !title || !["Bakspejl", "Djævlen i detaljen"].includes(series)) throw new Error("DR staging-identitet mangler eller er ukendt.");
  var expectedPath = series === "Bakspejl" ? "/lyd/special-radio/bakspejl/" : "/lyd/special-radio/djaevlen-i-detaljen/";
  var expectedPrefix = series === "Bakspejl" ? "bakspejl-auto-v1-" : "djaevlen-auto-v1-";
  if (!sourceUrl.startsWith("https://www.dr.dk" + expectedPath) || /[?#]/u.test(sourceUrl) ||
      !id.startsWith(expectedPrefix) || !/^[a-f0-9]{8}$/u.test(id.slice(expectedPrefix.length)) ||
      !/^\d{6,}$/u.test(sourceGuid) || !sourceUrl.endsWith(sourceGuid) || !sourceDescription) {
    throw new Error("Officiel DR full-episode-proveniens kunne ikke verificeres.");
  }
  if (get("Kilde") !== sourceUrl || get("Link") !== sourceUrl) throw new Error("Kilde-/episode-URL-identitet afviger.");
  if (!shortDescription || !longDescription || !genre || !topics) {
    throw new Error("Kort/lang beskrivelse, verificeret genre og emner skal være udfyldt før ejerens godkendelse.");
  }
  if (["Vært", "Vuring (1-10)", "Antal afsnit", "Årstal afspillet", "Afgivet vurdering", "Episoder", "Feed", "Undervurderet perle"]
    .some(function (header) { return get(header) !== ""; })) throw new Error("Staging må ikke autoudfylde vært, episoder, vurdering eller historik.");
  row.slice(0, HEADERS_.length).concat([sourceDescription]).forEach(function (value) {
    if (/^[\s]*[=+\-@]/u.test(String(value || ""))) throw new Error("Formel-lignende staging-indhold er ikke tilladt.");
  });
  return {
    id: id, title: title, series: series, sourceUrl: sourceUrl,
    sourceDescription: sourceDescription, shortDescription: shortDescription,
    longDescription: longDescription, genre: genre, secondaryGenre: secondaryGenre,
    topics: topics, similarities: similarities
  };
}

function appendOneReviewedRow_(context, stagedItem) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error("Kunne ikke låse Ark1; prøv igen senere.");
  try {
    var target = context.original.getSheetByName(TARGET_TAB_NAME_);
    assertTargetSchema_(target);
    var before = snapshotTarget_(target);
    var ids = readUniqueTargetIds_(target);
    var candidate = stagedItem.candidate;
    var existing = ids.get(candidate.id);
    if (existing) {
      if (existing.title !== candidate.title || existing.series !== candidate.series) throw new Error("Podcast-ID-identitetskonflikt; intet blev skrevet.");
      return; // Exact ID exists already: idempotent no-op; never update it.
    }
    var originalCount = target.getLastRow();
    var output = stagedItem.row.map(function (value) { return value == null ? "" : String(value); });
    try {
      target.getRange(originalCount + 1, 1, 1, HEADERS_.length).setValues([output]);
    } catch (appendError) {
      var afterError = target.getSheetId() === TARGET_TAB_ID_ ? snapshotTarget_(target) : null;
      assertOldCellsUnchanged_(before, afterError);
      var recovered = readUniqueTargetIds_(target).get(candidate.id);
      if (recovered && recovered.title === candidate.title && recovered.series === candidate.series) {
        assertAppendedRowMatches_(target, recovered.rowNumber, output);
        return;
      }
      throw appendError;
    }
    var after = snapshotTarget_(target);
    assertOldCellsUnchanged_(before, after);
    var verified = readUniqueTargetIds_(target).get(candidate.id);
    if (!verified || verified.title !== candidate.title || verified.series !== candidate.series || target.getLastRow() !== originalCount + 1) {
      throw new Error("Append read-back fejlede; stop og undersøg manuelt.");
    }
    assertAppendedRowMatches_(target, verified.rowNumber, output);
    Logger.log(JSON.stringify({ event: "DR_STAGING_APPEND", podcastId: candidate.id, originalRowCount: originalCount, user: context.userEmail, timestamp: new Date().toISOString() }));
  } finally {
    lock.releaseLock();
  }
}

function assertAppendedRowMatches_(target, rowNumber, expected) {
  var range = target.getRange(rowNumber, 1, 1, HEADERS_.length);
  var values = range.getValues()[0].map(function (value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value == null ? "" : value); });
  if (range.getFormulas()[0].some(function (formula) { return Boolean(formula); }) || !sameArray_(values, expected)) {
    throw new Error("Ny Ark1-række afviger fra staging; stop og undersøg manuelt.");
  }
}

function snapshotTarget_(target) {
  var rowCount = target.getLastRow();
  if (!rowCount) return { rowCount: 0, values: [], formulas: [] };
  var range = target.getRange(1, 1, rowCount, HEADERS_.length);
  return { rowCount: rowCount, values: range.getValues(), formulas: range.getFormulas() };
}

function assertOldCellsUnchanged_(before, after) {
  if (!after || after.rowCount < before.rowCount) throw new Error("Ark1 rækkeantal faldt; ingen automatisk recovery.");
  var oldValues = after.values.slice(0, before.rowCount);
  var oldFormulas = after.formulas.slice(0, before.rowCount);
  if (JSON.stringify(before.values) !== JSON.stringify(oldValues) || JSON.stringify(before.formulas) !== JSON.stringify(oldFormulas)) {
    throw new Error("Eksisterende Ark1-celler ændrede sig; stop og brug den verificerede backup til manuel recovery.");
  }
}

function sameArray_(left, right) {
  return left.length === right.length && left.every(function (value, index) { return String(value == null ? "" : value) === String(right[index]); });
}
