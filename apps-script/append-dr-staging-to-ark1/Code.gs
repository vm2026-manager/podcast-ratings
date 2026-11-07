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
var TYRAN_APPEND_ENABLED_PROPERTY_ = "TYRAN_APPEND_ENABLED";
var TYRAN_BACKUP_MAX_AGE_MS_ = 15 * 60 * 1000;
var TYRAN_PROTECTED_IDENTITIES_ = {
  "ayatollah khomeini": true, "benito mussolini": true, bokassa: true, ceausescu: true,
  "charles taylor": true, "enver hoxha": true, franco: true, hirohito: true,
  "idi amin": true, "kim il sung og kim jong il": true, lenin: true, "leopold ii": true,
  mao: true, milosevic: true, "muammar gaddafi": true, nijasov: true, "papa doc": true,
  pinochet: true, "pol pot": true, "saddam hussein": true, suharto: true, trujillo: true
};
var VERIFIED_TYRAN_IDENTITIES_ = {
  "tyran-auto-v1-08d0021f": {
    key: "macias", title: "Macias", series: "Tyran", seriesProductionNumber: "6641072699897",
    seriesId: "urn:dr:radio:series:6a3e55fa1645505efca628b6", seriesUrl: "https://www.dr.dk/lyd/p3/tyran-macias-6641072699897",
    episodeTitle: "1:4 - Macias", guid: "16122693681", episodeUrl: "https://www.dr.dk/lyd/p3/tyran-macias/tyran-macias-22/1-4-macias-16122693681",
    coverImageId: "6a4e30ea60319a54701828b9", coverUrl: "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6a4e30ea60319a54701828b9?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29",
    coverSha256: "5f8fa9bba69c3a5718623ea846d2608affd0074c8437411159c3240b429e4425",
    descriptionSha256: "25f065f9ab606d61e9f32b497d6f50297e45c705917f8297f3892b28712f4897"
  },
  "marcos": {
    key: "marcos", title: "Marcos", series: "Tyran", seriesProductionNumber: "6641325831949",
    seriesId: "urn:dr:radio:series:6ad1ecb299797788ba19118f", seriesUrl: "https://www.dr.dk/lyd/p3/tyran-marcos-6641325831949",
    episodeTitle: "1:6 - Marcos", guid: "16122693711", episodeUrl: "https://www.dr.dk/lyd/p3/tyran-marcos/tyran-marcos-24/1-6-marcos-16122693711",
    coverImageId: "6ad8a63dd1248e67782813bf", coverUrl: "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6ad8a63dd1248e67782813bf?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29",
    coverSha256: "3168d4eeb2db7a75e5b4644931fc37b0ba2cb7bd175b450c775c0101c58f3173",
    descriptionSha256: "fd74bab19d25eced774d75634ffa3ef5cc9f2f8210700165a00ad24c6c801edd"
  }
};
var RADIO_IIII_TAB_NAME_ = "Radio IIII staging";
var RADIO_IIII_HEADERS_ = HEADERS_.concat([
  "Radio IIII source GUIDs", "Radio IIII source URL", "Radio IIII season URL",
  "Radio IIII source description", "Review status"
]);
var RADIO_IIII_HOST_ = "Anne Sofie Kragh";
var RADIO_IIII_PUBLISHER_ = "RADIO IIII";
var RADIO_IIII_SERIES_ = "Et kapitel for sig";
var RADIO_IIII_REVIEW_STATUS_ = "SOURCE_VERIFIED_REQUIRES_OWNER_APPROVAL";
var RADIO_IIII_PROPOSED_GENRE_ = "Samfund";
var RADIO_IIII_ACTIVE_GENRES_ = [
  "True Crime", "Historie", "Krig", "Politik", "Finans", "Samfund",
  "Sport", "Dokumentar", "Viden", "Underholdning", "Sladder"
];
var RADIO_IIII_BACKUP_MAX_AGE_MS_ = 15 * 60 * 1000;
var RADIO_IIII_IDENTITIES_ = {
  "radio-iiii-auto-v1-7f0dfeb9": {
    title: "Mattias Tesfaye", seasonUrl: "https://radio4.dk/podcasts/et-kapitel-for-sig?season=67",
    sourceUrl: "https://radio4.dk/podcasts/et-kapitel-for-sig/kapitel-1-jeg-har-trukket-nitten-1-4-mattias-tesfaye",
    guids: ["ee1d7c4e-c4ae-4ee1-ac27-b4f0003df1fe", "80e2a0b9-c7ce-4acd-8c85-b4f0003f4df9", "ab7baa37-d346-409f-bbda-b4f1003defee", "2600844c-f0d1-482a-bd50-b4f2003b14ac", "943609db-6521-4214-895c-b4f3003b13c1"],
    episodes: ["Prolog - Mattias Tesfaye", "Kapitel 1: “Jeg har trukket nitten” (1:4) – Mattias Tesfaye", "Kapitel 2: Forfalsker mors underskrift (2:4) – Mattias Tesfaye", "Kapitel 3: “Bange for det, der bor inde i mig” (3:4) – Mattias Tesfaye", "Kapitel 4: Klasseforræder? (4:4) - Mattias Tesfaye"]
  },
  "radio-iiii-auto-v1-915a06b7": {
    title: "Birgithe Kosovic", seasonUrl: "https://radio4.dk/podcasts/et-kapitel-for-sig?season=66",
    sourceUrl: "https://radio4.dk/podcasts/et-kapitel-for-sig/kapitel-1-som-en-tikkende-bombe-1-4-birgithe-kosovic",
    guids: ["73ecb9b3-670e-4aba-853f-b4e9002ab92c", "32b3d843-1d9c-46b5-82a5-b4e9002c1840", "b65bda3b-b040-4031-bb28-b4ea002ab795", "b5dbcc87-ed84-4b30-ae69-b4eb006bdccb", "10db60d6-010b-43b9-ad77-b4ec002ab8de"],
    episodes: ["Prolog - Birgithe Kosovic", "Kapitel 1: Som en tikkende bombe (1:4) - Birgithe Kosovic", "Kapitel 2: To ægtemænd i far-roller (2:4) - Birgithe Kosovic", "Kapitel 3: I gæld til den serbiske mafia (3:4) - Birgithe Kosovic", "Kapitel 4: Har jeg slået min far ihjel? (4:4) - Birgithe Kosovic"]
  },
  "radio-iiii-auto-v1-ad97bb06": {
    title: "Ditlev Tamm", seasonUrl: "https://radio4.dk/podcasts/et-kapitel-for-sig?season=65",
    sourceUrl: "https://radio4.dk/podcasts/et-kapitel-for-sig/kapitel-1-en-opv-kst-med-sn-vre-gr-nser-1-4-ditlev-tamm",
    guids: ["80fb4638-3faf-4c3f-8cd7-b4db002ab35b", "83ab38ba-e17a-4f05-a1b1-b4db002c17cd", "04d93aa3-367e-4371-86fe-b4dc002ab7ed", "4ea0cf77-e409-44c2-852f-b4dd002ac1ae", "548966cb-1e58-445a-a98d-b4de002ab441"],
    episodes: ["Prolog: Ditlev Tamm", "Kapitel 1: En opvækst med snævre grænser (1:4) - Ditlev Tamm", "Kapitel 2: Opgør med opgøret (2:4) - Ditlev Tamm", "Kapitel 3: Tomrum, depression og skilsmisse (3:4) - Ditlev Tamm", "Kapitel 4: Når Ditlev Tamm bliver til Patricia (4:4) - Ditlev Tamm"]
  },
  "radio-iiii-auto-v1-f143ebcd": {
    title: "Sara Blædel", seasonUrl: "https://radio4.dk/podcasts/et-kapitel-for-sig?season=63",
    sourceUrl: "https://radio4.dk/podcasts/et-kapitel-for-sig/kapitel-1-de-f-rste-fire-forhindringer-1-4",
    guids: ["cdeeead3-767e-4e56-aa56-b4cd002ab8c7", "450bd9ac-b118-46e8-b74a-b4cd002c177c", "08b9caef-ce66-47cc-826f-b4ce002abb77", "db0827b3-a3d6-4ef7-841b-b4cf002abbcf", "5797a7c4-6b7d-4a45-99de-b4d0002ab775"],
    episodes: ["Prolog: Sara Blædel", "Kapitel 1: De første fire forhindringer - Sara Blædel (1:4)", "Kapitel 2: En affære og en sen gave (2:4)", "Kapitel 3: Reddet af sit eget forlag og en lungebetændelse (3:4)", "Kapitel 4: Mord, der skaber ro i hovedet (4:4)"]
  }
};
var VERIFIED_LEGACY_DR_IDENTITIES_ = {
  "dræberurten": {
    title: "Dræberurten", series: "Djævlen i detaljen", sourceGuid: "16122692641",
    sourceUrl: "https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/draeberurten-16122692641"
  }
};
var VERIFIED_DR_HOST_CREDITS_ = {
  "bakspejl-auto-v1-4962cdc5": {
    sourceGuid: "11162611015",
    sourceUrl: "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/den-spanske-borgerkrig-1-3-11162611015",
    host: "Celine Klint",
    credit: "Tilrettelæggelse, vært og lyddesign: Celine Klint"
  },
  "dræberurten": {
    sourceGuid: "16122692641",
    sourceUrl: "https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/draeberurten-16122692641",
    host: "Per Lysholt",
    credit: "Vært: Per Lysholt."
  },
  "djaevlen-auto-v1-1139735b": {
    sourceGuid: "16122692642",
    sourceUrl: "https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen/djaevlen-i-detaljen-2026/kvinden-i-isdalen-1-5-et-braendt-lig-16122692642",
    host: "Per Lysholt",
    credit: "Vært: Per Lysholt."
  }
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu("DR staging")
    .addItem("Gennemgå og tilføj verificerede serier", "reviewAndAppendDrStagingRows")
    .addItem("Gennemgå Tyran-forslag (ejerstyret)", "reviewAndAppendTyranStagingRows")
    .addToUi();
  SpreadsheetApp.getUi().createMenu(RADIO_IIII_TAB_NAME_)
    .addItem("Gennemgå og tilføj verificeret gæsteserie", "reviewAndAppendRadioIIIIStagingRow")
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
    if (String(row[HEADERS_.indexOf("Hovedserie")] || "").normalize("NFC").trim() === "Tyran") continue;
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
        "\nVært: " + (c.host || "Ikke verificeret") +
        "\nVærtskreditering: " + (c.hostCredit || "Ingen eksplicit værtskreditering fundet") +
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

function reviewAndAppendTyranStagingRows() {
  var ui = SpreadsheetApp.getUi();
  var context = assertTyranReadOnlyConfiguration_();
  var data = readStaging_(context.stagingId);
  var target = context.original.getSheetByName(TARGET_TAB_NAME_);
  assertTargetSchema_(target);
  readUniqueTargetIds_(target);
  var targetSnapshot = snapshotTarget_(target);
  var targetRows = targetSnapshot.values.slice(1);
  var candidates = [];
  for (var i = 1; i < data.values.length; i += 1) {
    var row = data.values[i];
    if (String(row[HEADERS_.indexOf("Hovedserie")] || "").normalize("NFC").trim() !== "Tyran") continue;
    var candidate = validateTyranStagingCandidate_(row, data.formulas[i]);
    var existing = findTyranTargetIdentity_(targetRows, candidate);
    if (existing) continue;
    assertNoTyranIdentityCollision_(targetRows, candidate);
    candidates.push({ sourceRow: i + 1, row: row.slice(), candidate: candidate });
  }
  if (!candidates.length) {
    ui.alert("Ingen nye, verificerede Tyran-rækker at gennemgå. Ark1 og eksisterende staging blev ikke ændret.");
    return;
  }
  if (context.properties.getProperty(TYRAN_APPEND_ENABLED_PROPERTY_) !== "true") {
    ui.alert("Tyran dry run bestået for " + candidates.length + " række(r). Ejerappend er stadig lukket; ingen backup eller Ark1-write blev udført.");
    return;
  }
  context = assertOwnerConfiguration_();
  assertTyranAppendConfiguration_(context);
  candidates.forEach(function (item) {
    var c = item.candidate;
    var prompt = ui.prompt(
      "Tyran: dry run bestået; gennemgå DR-kilder",
      "Podcast-ID: " + c.id + "\nTitel: " + c.title + "\nHovedserie: Tyran" +
        "\nDR series-ID: " + c.seriesId + "\nUnderseriens productionNumber: " + c.seriesProductionNumber +
        "\nUnderserieside: " + c.seriesUrl + "\nFørste fulde episode: " + c.episodeTitle +
        "\nEpisode-GUID: " + c.sourceGuid + "\nEpisode-URL: " + c.sourceUrl +
        "\nIndividuelt DR-cover: " + c.coverUrl + "\nCover SHA-256: " + c.coverSha256 +
        "\nBeskrivelse fra DR: " + c.descriptionUrl + "\n\nKort beskrivelse:\n" + c.shortDescription +
        "\n\nLang beskrivelse:\n" + c.longDescription + "\n\nDR-beskrivelse og provenance:\n" + c.sourceDescription +
        "\n\nKontrollér de officielle kilder, lav frisk fuld backup med testgendannelse, og skriv præcist APPEND " + c.id +
        " for at tilføje denne ene række. Alle andre svar springer rækken over.",
      ui.ButtonSet.OK_CANCEL
    );
    if (prompt.getSelectedButton() !== ui.Button.OK || prompt.getResponseText().trim() !== "APPEND " + c.id) return;
    appendOneTyranReviewedRow_(context, item);
  });
}

function reviewAndAppendRadioIIIIStagingRow() {
  var ui = SpreadsheetApp.getUi();
  var context = assertOwnerConfiguration_();
  assertRadioIIIIBackupFresh_(context);
  var data = readRadioIIIIStaging_(context.stagingId);
  var target = context.original.getSheetByName(TARGET_TAB_NAME_);
  assertTargetSchema_(target);
  var targetIndex = readRadioIIIIStillIdentityIndex_(target);
  var candidates = validateRadioIIIIStagingRows_(data);
  var appendable = [];
  candidates.forEach(function (item) {
    var existing = targetIndex.byId[item.candidate.id];
    if (existing) {
      assertRadioIIIIExistingIdentity_(existing, item.candidate);
      return;
    }
    assertNoRadioIIIIIdentityCollision_(targetIndex.rows, item.candidate);
    appendable.push(item);
  });
  if (!appendable.length) {
    ui.alert("Ingen nye Radio IIII-rækker at gennemgå. Eksisterende Podcast-ID'er og rækker blev ikke ændret.");
    return;
  }

  var choices = appendable.map(function (item) { return item.candidate.id + " — " + item.candidate.title; }).join("\n");
  var selection = ui.prompt(
    "Vælg én Radio IIII-gæsteserie",
    "Gennemgå én kandidat ad gangen. Indtast præcist dens Podcast-ID:\n\n" + choices,
    ui.ButtonSet.OK_CANCEL
  );
  if (selection.getSelectedButton() !== ui.Button.OK) return;
  var selectedId = selection.getResponseText().trim();
  var selected = appendable.find(function (item) { return item.candidate.id === selectedId; });
  if (!selected) {
    ui.alert("Podcast-ID matchede ikke en valideret Radio IIII-kandidat. Intet blev skrevet.");
    return;
  }

  var c = selected.candidate;
  var genreApproval = ui.prompt(
    "Godkend aktiv genre for denne kandidat",
    "Staging angiver genren Portræt, som ikke er en aktiv kataloggenre. Portræt ændres ikke i staging.\n" +
      "Redaktionelt forslag til Ark1: " + RADIO_IIII_PROPOSED_GENRE_ + " (aktiv genre).\n\n" +
      "Hvis du godkender dette genrevalg for " + c.title + ", skriv præcist GENRE " + RADIO_IIII_PROPOSED_GENRE_ + " " + c.id + ". Ellers vælg Annuller.",
    ui.ButtonSet.OK_CANCEL
  );
  if (genreApproval.getSelectedButton() !== ui.Button.OK ||
      genreApproval.getResponseText().trim() !== "GENRE " + RADIO_IIII_PROPOSED_GENRE_ + " " + c.id) {
    ui.alert("Genrevalget blev ikke godkendt. Intet blev skrevet.");
    return;
  }

  var approval = ui.prompt(
    "Bekræft én Radio IIII-række",
    "Kilde: " + c.sourceUrl + "\nSæson: " + c.seasonUrl + "\nOfficielt verificerede prolog-/kapitel-GUID'er: " + c.guids.join(", ") +
      "\nProlog og kapitler i rækkefølge: " + c.episodes.join("; ") +
      "\nVært: " + c.host + "\nUdgiver: " + c.publisher + "\nHovedserie: " + c.series +
      "\nStaginggenre: Portræt\nGodkendt Ark1-genre: " + RADIO_IIII_PROPOSED_GENRE_ +
      "\n\nVurderings- og historikfelter tilføjes tomme. Kontrollér kilden. Skriv præcist APPEND " + c.id + " for kun at tilføje denne nye række.",
    ui.ButtonSet.OK_CANCEL
  );
  if (approval.getSelectedButton() !== ui.Button.OK || approval.getResponseText().trim() !== "APPEND " + c.id) {
    ui.alert("Append blev ikke bekræftet. Intet blev skrevet.");
    return;
  }
  appendOneRadioIIIIReviewedRow_(context, selected);
  ui.alert("Radio IIII-rækken blev verificeret og tilføjet. Kør menuen igen med en ny, frisk backup før næste gæst.");
}

function readRadioIIIIStaging_(stagingId) {
  var staging = SpreadsheetApp.openById(stagingId);
  var tab = staging.getSheetByName(RADIO_IIII_TAB_NAME_);
  if (!tab) throw new Error("Radio IIII staging-fanen mangler.");
  var lastRow = Math.max(1, tab.getLastRow());
  var range = tab.getRange(1, 1, lastRow, RADIO_IIII_HEADERS_.length);
  var values = range.getValues();
  var formulas = range.getFormulas();
  if (!values.length || !sameArray_(values[0], RADIO_IIII_HEADERS_)) {
    throw new Error("Radio IIII staging-header afviger i A:AJ; append stoppet.");
  }
  return { values: values, formulas: formulas };
}

function validateRadioIIIIStagingRows_(data) {
  var idColumn = HEADERS_.indexOf("Podcast-ID");
  var seenIds = {};
  var seenGuids = {};
  var candidates = [];
  for (var rowIndex = 1; rowIndex < data.values.length; rowIndex += 1) {
    var row = data.values[rowIndex];
    var formulas = data.formulas[rowIndex] || [];
    var id = String(row[idColumn] || "").normalize("NFC").trim();
    if (!id) {
      if (row.some(function (cell) { return String(cell || "").trim() !== ""; })) {
        throw new Error("Radio IIII staging har en udfyldt række uden Podcast-ID.");
      }
      continue;
    }
    var candidate = validateRadioIIIIStagingCandidate_(row, formulas);
    if (seenIds[candidate.id]) throw new Error("Radio IIII staging har dubleret Podcast-ID: " + candidate.id);
    seenIds[candidate.id] = true;
    candidate.guids.forEach(function (guid) {
      if (seenGuids[guid] && seenGuids[guid] !== candidate.id) throw new Error("Radio IIII staging har overlappende episode-GUID'er.");
      seenGuids[guid] = candidate.id;
    });
    candidates.push({ sourceRow: rowIndex + 1, row: row.slice(0, HEADERS_.length), candidate: candidate });
  }
  return candidates;
}

function validateRadioIIIIStagingCandidate_(row, formulas) {
  if (formulas.some(function (formula) { return Boolean(formula); })) throw new Error("Formler i Radio IIII staging-rækken er ikke tilladt.");
  var get = function (header) { return String(row[RADIO_IIII_HEADERS_.indexOf(header)] || "").normalize("NFC").trim(); };
  var id = get("Podcast-ID");
  var expected = RADIO_IIII_IDENTITIES_[id];
  if (!expected || get("Titel") !== expected.title || get("Hovedserie") !== RADIO_IIII_SERIES_ ||
      get("Vært") !== RADIO_IIII_HOST_ || get("Udgiver") !== RADIO_IIII_PUBLISHER_) {
    throw new Error("Radio IIII Podcast-ID, titel, vært, udgiver eller hovedserie afviger fra den verificerede identitet.");
  }
  var sourceUrl = get("Radio IIII source URL");
  var seasonUrl = get("Radio IIII season URL");
  var sourceGuids = get("Radio IIII source GUIDs").split(";").map(function (guid) { return guid.trim(); }).filter(Boolean);
  if (sourceUrl !== expected.sourceUrl || seasonUrl !== expected.seasonUrl ||
      !/^https:\/\/radio4\.dk\/podcasts\/et-kapitel-for-sig\//u.test(sourceUrl) ||
      !/^https:\/\/radio4\.dk\/podcasts\/et-kapitel-for-sig\?season=\d+$/u.test(seasonUrl) ||
      sourceGuids.length !== 5 || new Set(sourceGuids).size !== 5 || !sameArray_(sourceGuids, expected.guids) ||
      sourceGuids.some(function (guid) { return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(guid); }) ||
      !get("Radio IIII source description") || get("Review status") !== RADIO_IIII_REVIEW_STATUS_) {
    throw new Error("Radio IIII officielle kilde, sæson, fem unikke episode-GUID'er eller reviewstatus afviger.");
  }
  if (get("Link") !== sourceUrl || get("Kilde") !== sourceUrl || get("Genre") !== "Portræt" ||
      !RADIO_IIII_ACTIVE_GENRES_.includes(RADIO_IIII_PROPOSED_GENRE_)) {
    throw new Error("Radio IIII kildeidentitet eller foreslået aktiv genre afviger; append stoppet.");
  }
  if (get("Antal afsnit") !== "5" || get("Episoder") !== expected.episodes.join("; ") ||
      !get("Kort beskrivelse") || !get("Lang beskrivelse") || !get("Emner")) {
    throw new Error("Radio IIII episodeantal, prolog-/kapitelrækkefølge eller verificeret redaktionelt indhold afviger.");
  }
  ["Placering", "Vuring (1-10)", "Årstal afspillet", "Afgivet vurdering", "2. genre", "Feed",
    "Supplerende ligheder", "Uaktuel", "Undervurderet perle", "Adgang", "Engelsk"]
    .forEach(function (header) {
      if (get(header) !== "") throw new Error("Radio IIII staging må ikke udfylde rating-, historik- eller uverificerede felter: " + header);
    });
  row.slice(0, HEADERS_.length).concat([get("Radio IIII source description")]).forEach(function (value) {
    if (/^[\s]*[=+\-@]/u.test(String(value || ""))) throw new Error("Formel-lignende Radio IIII-indhold er ikke tilladt.");
  });
  return {
    id: id, title: expected.title, series: RADIO_IIII_SERIES_, host: RADIO_IIII_HOST_,
    publisher: RADIO_IIII_PUBLISHER_, sourceUrl: sourceUrl, seasonUrl: seasonUrl,
    sourceDescription: get("Radio IIII source description"), guids: sourceGuids,
    episodes: expected.episodes, row: row.slice(0, HEADERS_.length)
  };
}

function assertRadioIIIIBackupFresh_(context) {
  if (context.properties.getProperty("BACKUP_RESTORE_TEST_VERIFIED") !== "true") {
    throw new Error("Radio IIII append kræver en uafhængig backup med verificeret testgendannelse før hver række.");
  }
  var verifiedAt = Date.parse(context.properties.getProperty("BACKUP_VERIFIED_AT") || "");
  if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt > RADIO_IIII_BACKUP_MAX_AGE_MS_ ||
      verifiedAt > Date.now() + 60 * 1000) {
    throw new Error("Radio IIII append kræver en frisk uafhængig backup og verificeret testgendannelse fra de seneste 15 minutter.");
  }
}

function readRadioIIIIStillIdentityIndex_(target) {
  var lastRow = target.getLastRow();
  var rows = lastRow > 1 ? target.getRange(2, 1, lastRow - 1, HEADERS_.length).getValues() : [];
  var byId = {};
  var idColumn = HEADERS_.indexOf("Podcast-ID");
  rows.forEach(function (row, index) {
    var id = String(row[idColumn] || "").normalize("NFC").trim();
    if (!id) {
      if (row.some(function (cell) { return String(cell || "").trim() !== ""; })) throw new Error("Originalen har udfyldt række uden Podcast-ID.");
      return;
    }
    if (byId[id]) throw new Error("Originalen har dubleret Podcast-ID; Radio IIII append stoppet.");
    byId[id] = { id: id, rowNumber: index + 2, row: row };
  });
  return { rows: rows, byId: byId };
}

function assertRadioIIIIExistingIdentity_(existing, candidate) {
  var row = existing.row;
  var at = function (header) { return String(row[HEADERS_.indexOf(header)] || "").normalize("NFC").trim(); };
  if (at("Titel") !== candidate.title || at("Vært") !== candidate.host || at("Udgiver") !== candidate.publisher ||
      at("Hovedserie") !== candidate.series || at("Genre") !== RADIO_IIII_PROPOSED_GENRE_ ||
      at("Link") !== candidate.sourceUrl || at("Kilde") !== candidate.sourceUrl ||
      at("Antal afsnit") !== "5" || at("Episoder") !== candidate.episodes.join("; ")) {
    throw new Error("Eksisterende Radio IIII Podcast-ID har en anden titel, genre, kilde eller episodeidentitet.");
  }
}

function assertNoRadioIIIIIdentityCollision_(rows, candidate) {
  rows.forEach(function (row) {
    var id = String(row[HEADERS_.indexOf("Podcast-ID")] || "").normalize("NFC").trim();
    if (id === candidate.id) return;
    var title = String(row[HEADERS_.indexOf("Titel")] || "").normalize("NFC").trim();
    if (title === candidate.title) throw new Error("Radio IIII gæstetitel findes allerede under et andet Podcast-ID.");
    var cells = row.map(function (cell) { return String(cell == null ? "" : cell).toLowerCase(); });
    if (cells.some(function (cell) { return cell.indexOf(candidate.sourceUrl.toLowerCase()) >= 0 ||
        cell.indexOf(candidate.seasonUrl.toLowerCase()) >= 0 || candidate.guids.some(function (guid) { return cell.indexOf(guid.toLowerCase()) >= 0; }); })) {
      throw new Error("Radio IIII kilde- eller episodeidentitet kolliderer med en eksisterende Ark1-række.");
    }
  });
}

function appendOneRadioIIIIReviewedRow_(context, stagedItem) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error("Kunne ikke låse Ark1; prøv igen senere.");
  try {
    var currentContext = assertOwnerConfiguration_();
    assertRadioIIIIBackupFresh_(currentContext);
    var target = currentContext.original.getSheetByName(TARGET_TAB_NAME_);
    assertTargetSchema_(target);
    var source = readRadioIIIIStaging_(currentContext.stagingId);
    var fresh = validateRadioIIIIStagingRows_(source).find(function (item) { return item.candidate.id === stagedItem.candidate.id; });
    if (!fresh || !sameArray_(fresh.row.map(String), stagedItem.row.map(String))) {
      throw new Error("Radio IIII staging-rækken ændrede sig under ejergennemgangen; intet blev skrevet.");
    }
    var before = snapshotTarget_(target);
    var targetIndex = readRadioIIIIStillIdentityIndex_(target);
    var existing = targetIndex.byId[fresh.candidate.id];
    if (existing) {
      assertRadioIIIIExistingIdentity_(existing, fresh.candidate);
      return; // Exact identity exists already: idempotent no-op; never update it.
    }
    assertNoRadioIIIIIdentityCollision_(targetIndex.rows, fresh.candidate);
    var originalCount = target.getLastRow();
    var output = fresh.row.map(function (value) { return value == null ? "" : String(value); });
    output[HEADERS_.indexOf("Genre")] = RADIO_IIII_PROPOSED_GENRE_;
    try {
      target.getRange(originalCount + 1, 1, 1, HEADERS_.length).setValues([output]);
    } catch (appendError) {
      var afterError = target.getSheetId() === TARGET_TAB_ID_ ? snapshotTarget_(target) : null;
      assertOldCellsUnchanged_(before, afterError);
      var recovered = readRadioIIIIStillIdentityIndex_(target).byId[fresh.candidate.id];
      if (recovered) {
        assertRadioIIIIExistingIdentity_(recovered, fresh.candidate);
        assertAppendedRowMatches_(target, recovered.rowNumber, output);
        return;
      }
      throw appendError;
    }
    var after = snapshotTarget_(target);
    assertOldCellsUnchanged_(before, after);
    var verified = readRadioIIIIStillIdentityIndex_(target).byId[fresh.candidate.id];
    if (!verified || target.getLastRow() !== originalCount + 1) throw new Error("Radio IIII append read-back fejlede; stop og undersøg manuelt.");
    assertRadioIIIIExistingIdentity_(verified, fresh.candidate);
    assertAppendedRowMatches_(target, verified.rowNumber, output);
    Logger.log(JSON.stringify({ event: "RADIO_IIII_STAGING_APPEND", podcastId: fresh.candidate.id, originalRowCount: originalCount, user: currentContext.userEmail, timestamp: new Date().toISOString() }));
  } finally {
    lock.releaseLock();
  }
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

function assertTyranAppendConfiguration_(context) {
  if (context.properties.getProperty(TYRAN_APPEND_ENABLED_PROPERTY_) !== "true") {
    throw new Error("Tyran-ejerappend er lukket. TYRAN_APPEND_ENABLED skal aktiveres særskilt af ejeren efter gennemgang.");
  }
  if (context.properties.getProperty("BACKUP_RESTORE_TEST_VERIFIED") !== "true") {
    throw new Error("Tyran-ejerappend kræver uafhængig backup med verificeret testgendannelse.");
  }
  var verifiedAt = Date.parse(context.properties.getProperty("BACKUP_VERIFIED_AT") || "");
  if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt > TYRAN_BACKUP_MAX_AGE_MS_ || verifiedAt > Date.now() + 60 * 1000) {
    throw new Error("Tyran-ejerappend kræver frisk backup og verificeret testgendannelse fra de seneste 15 minutter.");
  }
}

function assertTyranReadOnlyConfiguration_() {
  var properties = PropertiesService.getScriptProperties();
  var original = SpreadsheetApp.getActiveSpreadsheet();
  var userEmail = Session.getEffectiveUser().getEmail();
  if (!original || original.getId() !== ORIGINAL_SPREADSHEET_ID_) throw new Error("Tyran dry run skal køres fra det godkendte originalark.");
  if (!userEmail || userEmail !== properties.getProperty("OWNER_EMAIL")) throw new Error("Kun den konfigurerede ejer må køre Tyran dry run.");
  var stagingId = properties.getProperty("STAGING_SPREADSHEET_ID");
  var backupId = properties.getProperty("BACKUP_SPREADSHEET_ID");
  if (!stagingId || stagingId === ORIGINAL_SPREADSHEET_ID_ || stagingId === backupId) throw new Error("Separat DR staging-regneark mangler eller kolliderer.");
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
  var host = get("Vært");
  var sourceHost = extractDrHostCredit_(sourceDescription);
  if (!id || !title || !["Bakspejl", "Djævlen i detaljen"].includes(series)) throw new Error("DR staging-identitet mangler eller er ukendt.");
  var expectedPath = series === "Bakspejl" ? "/lyd/special-radio/bakspejl/" : "/lyd/special-radio/djaevlen-i-detaljen/";
  var expectedPrefix = series === "Bakspejl" ? "bakspejl-auto-v1-" : "djaevlen-auto-v1-";
  var legacyIdentity = VERIFIED_LEGACY_DR_IDENTITIES_[id];
  var generatedId = id.indexOf(expectedPrefix) === 0 && /^[a-f0-9]{8}$/u.test(id.slice(expectedPrefix.length));
  var verifiedLegacyId = legacyIdentity && legacyIdentity.title === title && legacyIdentity.series === series &&
    legacyIdentity.sourceGuid === sourceGuid && legacyIdentity.sourceUrl === sourceUrl;
  if (!sourceUrl.startsWith("https://www.dr.dk" + expectedPath) || /[?#]/u.test(sourceUrl) ||
      (!generatedId && !verifiedLegacyId) ||
      !/^\d{6,}$/u.test(sourceGuid) || !sourceUrl.endsWith(sourceGuid) || !sourceDescription) {
    throw new Error("Officiel DR full-episode-proveniens kunne ikke verificeres.");
  }
  if (get("Kilde") !== sourceUrl || get("Link") !== sourceUrl) throw new Error("Kilde-/episode-URL-identitet afviger.");
  if (!shortDescription || !longDescription || !genre || !topics) {
    throw new Error("Kort/lang beskrivelse, verificeret genre og emner skal være udfyldt før ejerens godkendelse.");
  }
  var verifiedHostCredit = VERIFIED_DR_HOST_CREDITS_[id];
  var exactHostProof = verifiedHostCredit && verifiedHostCredit.sourceGuid === sourceGuid &&
    verifiedHostCredit.sourceUrl === sourceUrl && verifiedHostCredit.host === host;
  var hasHostLabel = /\bvært\b[^:;.!?]{0,60}:/iu.test(sourceDescription);
  if (host && (sourceHost && sourceHost !== host || (!sourceHost && (hasHostLabel || !exactHostProof)))) {
    throw new Error("Vært mangler eksplicit, matchende DR-værtskreditering.");
  }
  if (["Vuring (1-10)", "Antal afsnit", "Årstal afspillet", "Afgivet vurdering", "Episoder", "Feed", "Undervurderet perle"]
    .some(function (header) { return get(header) !== ""; })) throw new Error("Staging må ikke autoudfylde episoder, vurdering eller historik.");
  row.slice(0, HEADERS_.length).concat([sourceDescription]).forEach(function (value) {
    if (/^[\s]*[=+\-@]/u.test(String(value || ""))) throw new Error("Formel-lignende staging-indhold er ikke tilladt.");
  });
  return {
    id: id, title: title, series: series, sourceUrl: sourceUrl,
    sourceDescription: sourceDescription, shortDescription: shortDescription,
    longDescription: longDescription, genre: genre, secondaryGenre: secondaryGenre,
    topics: topics, similarities: similarities, host: host,
    hostCredit: sourceHost ? "Vært: " + sourceHost : exactHostProof ? verifiedHostCredit.credit : ""
  };
}

function validateTyranStagingCandidate_(row, formulas) {
  if (formulas.some(function (formula) { return Boolean(formula); })) throw new Error("Formler i Tyran staging-rækken er ikke tilladt.");
  var get = function (header) { return String(row[STAGING_HEADERS_.indexOf(header)] || "").normalize("NFC").trim(); };
  var id = get("Podcast-ID");
  var expected = VERIFIED_TYRAN_IDENTITIES_[id];
  var sourceDescription = get("DR source description");
  var match = sourceDescription.match(/^TYRAN_DR_PROVENANCE_V1\s+(\{[^\n]+\})\n\n([\s\S]+)$/u);
  if (!expected || !match) throw new Error("Tyran Podcast-ID eller DR provenance er ikke på den eksakte godkendte liste.");
  var provenance;
  try { provenance = JSON.parse(match[1]); } catch (error) { throw new Error("Tyran DR provenance kunne ikke læses."); }
  var sourceBody = match[2];
  var descriptionDigest = sha256Hex_(sourceBody);
  var expectedProvenance = {
    version: 1, discoveryKey: expected.key, podcastId: id,
    title: expected.title, seriesId: expected.seriesId, seriesProductionNumber: expected.seriesProductionNumber,
    seriesUrl: expected.seriesUrl, episodeTitle: expected.episodeTitle, episodeGuid: expected.guid,
    episodeUrl: expected.episodeUrl, coverImageId: expected.coverImageId, coverUrl: expected.coverUrl,
    coverSha256: expected.coverSha256, descriptionUrl: expected.seriesUrl, descriptionSha256: expected.descriptionSha256
  };
  Object.keys(expectedProvenance).forEach(function (key) {
    if (provenance[key] !== expectedProvenance[key]) throw new Error("Tyran DR provenance afviger for " + key + ".");
  });
  if (Object.keys(provenance).length !== Object.keys(expectedProvenance).length || descriptionDigest !== expected.descriptionSha256) {
    throw new Error("Tyran DR-beskrivelse eller provenance-checksum afviger.");
  }
  var title = get("Titel");
  var episodeUrl = get("DR source URL");
  var guid = get("DR source GUID");
  var coverUrl = get("Billedlink");
  if (title !== expected.title || get("Hovedserie") !== "Tyran" || get("Udgiver") !== "DR" ||
      episodeUrl !== expected.episodeUrl || guid !== expected.guid || !episodeUrl.endsWith(guid) ||
      get("Link") !== expected.episodeUrl || get("Kilde") !== expected.episodeUrl || coverUrl !== expected.coverUrl ||
      get("Review status") !== "NEEDS_EDITORIAL_REVIEW" || !get("Kort beskrivelse") || !get("Lang beskrivelse") ||
      get("Vært") || get("Genre") || get("2. genre") || get("Emner") || get("Feed") || get("Episoder") ||
      ["Vuring (1-10)", "Antal afsnit", "Årstal afspillet", "Afgivet vurdering", "Undervurderet perle", "Placering", "Adgang"]
        .some(function (header) { return get(header) !== ""; })) {
    throw new Error("Tyran staging-identitet, cover, reviewstatus eller tomme rating-/feedfelter afviger.");
  }
  row.slice(0, HEADERS_.length).concat([sourceDescription]).forEach(function (value) {
    if (/^[\s]*[=+\-@]/u.test(String(value || ""))) throw new Error("Formel-lignende Tyran staging-indhold er ikke tilladt.");
  });
  return {
    id: id, title: title, series: "Tyran", sourceUrl: expected.episodeUrl,
    sourceGuid: expected.guid, sourceDescription: sourceDescription, shortDescription: get("Kort beskrivelse"),
    longDescription: get("Lang beskrivelse"), seriesId: expected.seriesId,
    seriesProductionNumber: expected.seriesProductionNumber, seriesUrl: expected.seriesUrl,
    episodeTitle: expected.episodeTitle, coverUrl: expected.coverUrl, coverSha256: expected.coverSha256,
    descriptionUrl: expected.seriesUrl
  };
}

function sha256Hex_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0"); }).join("");
}

function normalizeTyranIdentity_(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").replace(/&/g, " og ")
    .replace(/[^a-z0-9]+/gu, " ").trim().replace(/\s+/gu, " ");
}

function findTyranTargetIdentity_(rows, candidate) {
  var idIndex = HEADERS_.indexOf("Podcast-ID");
  var titleIndex = HEADERS_.indexOf("Titel");
  var seriesIndex = HEADERS_.indexOf("Hovedserie");
  var found = null;
  (rows || []).forEach(function (row, index) {
    var id = String(row[idIndex] || "").normalize("NFC").trim();
    if (id !== candidate.id) return;
    if (found) throw new Error("Ark1 har dubleret Tyran Podcast-ID; append stoppet.");
    var expectedLink = id === "marcos" ? candidate.seriesUrl : candidate.sourceUrl;
    var storedSource = String(row[HEADERS_.indexOf("Kilde")] || "").trim();
    if (String(row[titleIndex] || "").normalize("NFC").trim() !== candidate.title ||
        String(row[seriesIndex] || "").normalize("NFC").trim() !== "Tyran" ||
        String(row[HEADERS_.indexOf("Link")] || "").trim() !== expectedLink ||
        (storedSource && storedSource !== expectedLink && storedSource !== candidate.sourceUrl) ||
        String(row[HEADERS_.indexOf("Billedlink")] || "").trim() !== candidate.coverUrl) {
      throw new Error("Eksisterende Tyran Podcast-ID har modstridende titel, hovedserie eller kilde.");
    }
    found = { rowNumber: index + 2, row: row };
  });
  return found;
}

function assertNoTyranIdentityCollision_(rows, candidate) {
  var candidateTitle = normalizeTyranIdentity_(candidate.title);
  if (TYRAN_PROTECTED_IDENTITIES_[candidateTitle]) throw new Error("Tyran-titlen kolliderer med en af de 22 beskyttede historiske identiteter.");
  var identityTokens = [candidate.sourceUrl, candidate.seriesUrl, candidate.sourceGuid,
    candidate.seriesProductionNumber, candidate.seriesId, candidate.coverUrl, candidate.coverSha256];
  (rows || []).forEach(function (row) {
    var id = String(row[HEADERS_.indexOf("Podcast-ID")] || "").normalize("NFC").trim();
    var title = String(row[HEADERS_.indexOf("Titel")] || "").normalize("NFC").trim();
    var series = String(row[HEADERS_.indexOf("Hovedserie")] || "").normalize("NFC").trim();
    if (normalizeTyranIdentity_(title) === candidateTitle) throw new Error("Tyran-titlen findes allerede under Podcast-ID " + id + ".");
    if (series === "Tyran" && id === candidate.title) throw new Error("Tyran kolliderer med en historisk Podcast-ID-identitet.");
    var cells = row.map(function (cell) { return String(cell == null ? "" : cell); });
    identityTokens.forEach(function (token) {
      if (token && cells.some(function (cell) { return cell.indexOf(token) >= 0; })) {
        throw new Error("Tyran DR-kilde, GUID, series-ID eller cover kolliderer med Ark1 Podcast-ID " + id + ".");
      }
    });
  });
}

function appendOneTyranReviewedRow_(context, stagedItem) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error("Kunne ikke låse Ark1; prøv igen senere.");
  try {
    var currentContext = assertOwnerConfiguration_();
    assertTyranAppendConfiguration_(currentContext);
    var target = currentContext.original.getSheetByName(TARGET_TAB_NAME_);
    assertTargetSchema_(target);
    var freshStaging = readStaging_(currentContext.stagingId);
    var freshRow = freshStaging.values[stagedItem.sourceRow - 1];
    var fresh = validateTyranStagingCandidate_(freshRow, freshStaging.formulas[stagedItem.sourceRow - 1]);
    if (!sameArray_(freshRow.map(String), stagedItem.row.map(String))) throw new Error("Tyran staging-rækken ændrede sig under ejergennemgangen; intet blev skrevet.");
    var before = snapshotTarget_(target);
    var rows = before.values.slice(1);
    if (findTyranTargetIdentity_(rows, fresh)) return;
    assertNoTyranIdentityCollision_(rows, fresh);
    var originalCount = target.getLastRow();
    var output = stagedItem.row.slice(0, HEADERS_.length).map(function (value) { return value == null ? "" : String(value); });
    try {
      target.getRange(originalCount + 1, 1, 1, HEADERS_.length).setValues([output]);
    } catch (appendError) {
      var afterError = target.getSheetId() === TARGET_TAB_ID_ ? snapshotTarget_(target) : null;
      assertOldCellsUnchanged_(before, afterError);
      var recovered = readUniqueTargetIds_(target).get(fresh.id);
      if (recovered && recovered.title === fresh.title && recovered.series === "Tyran") {
        assertAppendedRowMatches_(target, recovered.rowNumber, output);
        return;
      }
      throw appendError;
    }
    var after = snapshotTarget_(target);
    assertOldCellsUnchanged_(before, after);
    var verified = readUniqueTargetIds_(target).get(fresh.id);
    if (!verified || verified.title !== fresh.title || verified.series !== "Tyran" || target.getLastRow() !== originalCount + 1) {
      throw new Error("Tyran Ark1 append read-back fejlede; stop og undersøg manuelt.");
    }
    assertAppendedRowMatches_(target, verified.rowNumber, output);
    Logger.log(JSON.stringify({ event: "TYRAN_STAGING_APPEND", podcastId: fresh.id, originalRowCount: originalCount, user: currentContext.userEmail, timestamp: new Date().toISOString() }));
  } finally {
    lock.releaseLock();
  }
}

function extractDrHostCredit_(value) {
  var text = String(value || "").replace(/\s+/g, " ").trim();
  var label = /\b[^:;.!?]{0,100}\bvært\b[^:;.!?]{0,60}:\s*/giu;
  var matches = [];
  var match;
  while ((match = label.exec(text)) !== null) {
    var tail = text.slice(label.lastIndex);
    var next = /\s+(?:Medvirkende|Tilrettelæggelse|Tilrettelægger|Redaktion|Redaktør|DR redaktør|Producer|Producent|Vært)\s*:/iu.exec(tail);
    var boundary = next ? next.index : tail.length;
    var punctuation = tail.slice(0, boundary).search(/[.;!?]/u);
    var end = punctuation >= 0 ? punctuation : boundary;
    var host = tail.slice(0, end).trim().replace(/[,\s]+$/u, "");
    if (host) matches.push(host);
  }
  var unique = [];
  matches.forEach(function (host) { if (unique.indexOf(host) < 0) unique.push(host); });
  return unique.length === 1 ? unique[0] : "";
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
