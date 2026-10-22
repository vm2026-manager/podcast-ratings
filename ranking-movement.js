(function attachRankingMovement(root) {
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
    const duplicateCurrentKeys = new Set();
    currentEntries.forEach((entry) => {
      const key = normalizeKey(keyOf(entry), resolveCanonicalKey);
      const score = numericScore(scoreOf(entry));
      if (!key || score === null) return;
      if (currentByKey.has(key)) duplicateCurrentKeys.add(key);
      else currentByKey.set(key, { key, score });
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

    const cohort = [...currentByKey.keys()]
      .filter((key) => historicalByKey.has(key))
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

  root.PodcastRankingMovement = Object.freeze({ displayScore, rankSequential, movementMap, compareSnapshotsToCurrent, isEligible });
})(typeof window !== "undefined" ? window : globalThis);
