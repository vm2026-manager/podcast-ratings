(function attachRankingMovement(root) {
  const INITIAL_SNAPSHOT_DATE = "2026-10-20";
  const SEVEN_DAY_SWITCH_AT = Date.parse("2026-10-27T03:17:00Z");
  const NEW_LISTING_SUPPRESSION_DAYS = 7;

  function isWithinNewListingWindow(firstListedAt, now = new Date(), knownNewListing = false) {
    if (!firstListedAt) return Boolean(knownNewListing);
    const listedAt = firstListedAt instanceof Date ? firstListedAt.getTime() : Date.parse(firstListedAt);
    const timestamp = now instanceof Date ? now.getTime() : Date.parse(now);
    if (!Number.isFinite(listedAt) || !Number.isFinite(timestamp) || listedAt > timestamp) return Boolean(knownNewListing);
    return timestamp - listedAt < NEW_LISTING_SUPPRESSION_DAYS * 24 * 60 * 60 * 1000;
  }

  function getSnapshotBaseline(now = new Date()) {
    const timestamp = now instanceof Date ? now.getTime() : Date.parse(now);
    if (!Number.isFinite(timestamp)) return null;
    if (timestamp < SEVEN_DAY_SWITCH_AT) {
      return { snapshotDate: INITIAL_SNAPSHOT_DATE, periodLabel: "siden 20. oktober", mode: "initial" };
    }
    const date = new Date(timestamp);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - 7);
    return { snapshotDate: date.toISOString().slice(0, 10), periodLabel: "de seneste 7 dage", mode: "seven-day" };
  }

  function hasCompleteSnapshot(rows, reportedCount, expectedDate) {
    if (
      !Array.isArray(rows) || !rows.length || rows.length >= 1000 ||
      !Number.isInteger(reportedCount) || reportedCount !== rows.length
    ) return false;

    const keys = new Set();
    return rows.every((row) => {
      const key = String(row.podcast_key || "").trim();
      const count = Number(row.rating_count);
      if (
        row.snapshot_date !== expectedDate || row.source !== "users" || !key ||
        numericScore(row.average_rating) === null || !Number.isFinite(count) || count <= 0 || keys.has(key)
      ) return false;
      keys.add(key);
      return true;
    });
  }

  function displayScore(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(1)) : null;
  }

  function numericScore(value) {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function compareKeys(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function normalizeKey(value, resolveCanonicalKey) {
    const key = String(value || "").trim();
    if (!key) return "";
    if (key.startsWith("display-group:")) return key;
    return resolveCanonicalKey(key) || key;
  }

  function rankSequential(entries, keyOf, scoreOf) {
    const ranked = entries
      .map((entry) => ({ key: keyOf(entry), score: numericScore(scoreOf(entry)) }))
      .filter((item) => item.key && item.score !== null)
      .sort((a, b) => b.score - a.score || compareKeys(a.key, b.key));
    const positions = new Map();
    ranked.forEach((item, index) => {
      positions.set(item.key, index + 1);
    });
    return positions;
  }

  function movementMap(currentEntries, historicalRows, options = {}) {
    const keyOf = options.keyOf || ((entry) => entry.key);
    const scoreOf = options.scoreOf || ((entry) => entry.averageRating);
    const resolveCanonicalKey = options.resolveCanonicalKey || ((key) => key);
    const currentByKey = new Map();
    const currentFirstListedAtByKey = new Map();
    const duplicateCurrentKeys = new Set();
    currentEntries.forEach((entry) => {
      const key = normalizeKey(keyOf(entry), resolveCanonicalKey);
      const score = numericScore(scoreOf(entry));
      if (!key || score === null) return;
      if (currentByKey.has(key)) duplicateCurrentKeys.add(key);
      else {
        currentByKey.set(key, { key, score });
        currentFirstListedAtByKey.set(key, {
          firstListedAt: entry.firstListedAt || null,
          knownNewListing: entry.knownNewListing === true
        });
      }
    });
    duplicateCurrentKeys.forEach((key) => currentByKey.delete(key));

    const historicalByKey = new Map();
    const ambiguous = new Set();
    historicalRows.forEach((row) => {
      const key = normalizeKey(row.podcast_key, resolveCanonicalKey);
      const score = numericScore(row.average_rating);
      if (!key || score === null || Number(row.rating_count) <= 0) return;
      if (historicalByKey.has(key)) {
        const existing = historicalByKey.get(key);
        if (existing.score !== score) ambiguous.add(key);
      } else {
        historicalByKey.set(key, { key, score });
      }
    });
    ambiguous.forEach((key) => historicalByKey.delete(key));

    const now = options.now || new Date();
    const cohort = [...currentByKey.keys()]
      .filter((key) => historicalByKey.has(key))
      .filter((key) => {
        const listing = currentFirstListedAtByKey.get(key) || {};
        return !isWithinNewListingWindow(listing.firstListedAt, now, listing.knownNewListing);
      })
      .map((key) => ({ key, current: currentByKey.get(key).score, previous: historicalByKey.get(key).score }));
    const currentRanks = rankSequential(cohort, (item) => item.key, (item) => item.current);
    const historicalRanks = rankSequential(cohort, (item) => item.key, (item) => item.previous);
    const movements = new Map();
    cohort.forEach((item) => {
      movements.set(item.key, historicalRanks.get(item.key) - currentRanks.get(item.key));
    });
    return movements;
  }

  function compareSnapshotsToCurrent(currentEntries, historicalRows, options = {}) {
    const historicalDate = options.historicalDate;
    const expectedDate = options.expectedDate;
    if (
      !Array.isArray(historicalRows) || !historicalRows.length || historicalRows.length >= 1000 ||
      historicalDate !== expectedDate ||
      historicalRows.some((row) => row.snapshot_date !== expectedDate || row.source !== "users")
    ) {
      return new Map();
    }
    return movementMap(currentEntries, historicalRows, options);
  }

  function isEligible(context = {}) {
    return Boolean(
      context.route === "ranglister" && context.source === "users" &&
      !context.hasFilter && !context.hasSearch && !context.hasMinimumRating &&
      !context.freeOnly && !context.languageFilter && !context.ownRatingSort &&
      context.userSort === "rating" && context.direction === "desc" && context.sort === "placement-asc"
    );
  }

  root.PodcastRankingMovement = Object.freeze({
    displayScore,
    isWithinNewListingWindow,
    getSnapshotBaseline,
    hasCompleteSnapshot,
    rankSequential,
    movementMap,
    compareSnapshotsToCurrent,
    isEligible
  });
})(typeof window !== "undefined" ? window : globalThis);
