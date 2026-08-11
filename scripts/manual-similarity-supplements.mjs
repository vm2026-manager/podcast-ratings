function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function normalizeManualSimilarityIdentity(value) {
  return text(value)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("da-DK");
}

export function parseSupplementarySimilarities(rawValue) {
  return String(rawValue ?? "")
    .split(";")
    .map((entry) => text(entry))
    .filter(Boolean)
    .map((entry) => {
      const qualifier = entry.match(/^(.*?)\s+\[([^\[\]]+)\]\s*$/u);
      const title = text(qualifier ? qualifier[1] : entry).normalize("NFKC");
      const hostQualifier = qualifier ? text(qualifier[2]).normalize("NFKC") : "";
      return {
        title,
        hostQualifier: hostQualifier || null
      };
    })
    .filter((reference) => reference.title);
}

function auditRow(source, rawValue, reference, position, status, extra = {}) {
  return {
    sourceRecommendationId: source.recommendationId,
    sourceTitle: source.title,
    sourceRow: Number.isInteger(source.displayRowIndex) ? source.displayRowIndex + 2 : "",
    rawCellValue: text(rawValue),
    parsedTargetTitle: reference.title,
    parsedHostQualifier: reference.hostQualifier || "",
    position,
    status,
    resolvedRecommendationId: extra.resolvedRecommendationId || "",
    resolvedTitle: extra.resolvedTitle || "",
    resolvedHost: extra.resolvedHost || "",
    resolutionMethod: extra.resolutionMethod || "",
    rejectionReason: extra.rejectionReason || "",
    presentInAutomatic: Boolean(extra.presentInAutomatic)
  };
}

export function resolveSupplementarySimilarities({ source, catalog }) {
  const rawValue = text(source.supplementarySimilaritiesRaw);
  const references = Array.isArray(source.supplementarySimilarities)
    ? source.supplementarySimilarities
    : parseSupplementarySimilarities(rawValue);
  const byTitle = new Map();

  for (const candidate of catalog) {
    const titleKey = normalizeManualSimilarityIdentity(candidate.title);
    if (!titleKey) continue;
    const matches = byTitle.get(titleKey) || [];
    matches.push(candidate);
    byTitle.set(titleKey, matches);
  }

  const audit = [];
  const resolved = [];
  const resolvedIds = new Set();

  references.forEach((reference, offset) => {
    const position = offset + 1;
    const matches = byTitle.get(normalizeManualSimilarityIdentity(reference.title)) || [];
    const qualifierKey = reference.hostQualifier
      ? normalizeManualSimilarityIdentity(reference.hostQualifier)
      : "";

    if (!matches.length) {
      audit.push(
        auditRow(source, rawValue, reference, position, "unresolved_title", {
          rejectionReason: "no_exact_title_match"
        })
      );
      return;
    }

    let candidate = null;
    let status = "";
    if (matches.length === 1) {
      candidate = matches[0];
      if (qualifierKey && qualifierKey !== normalizeManualSimilarityIdentity(candidate.host)) {
        audit.push(
          auditRow(source, rawValue, reference, position, "host_mismatch", {
            rejectionReason: "exact_title_host_did_not_match"
          })
        );
        return;
      }
      status = qualifierKey ? "resolved_title_and_host" : "resolved_unique_title";
    } else {
      if (!qualifierKey) {
        audit.push(
          auditRow(source, rawValue, reference, position, "ambiguous_title", {
            rejectionReason: "multiple_exact_title_matches"
          })
        );
        return;
      }
      const hostMatches = matches.filter(
        (match) => normalizeManualSimilarityIdentity(match.host) === qualifierKey
      );
      if (!hostMatches.length) {
        audit.push(
          auditRow(source, rawValue, reference, position, "host_mismatch", {
            rejectionReason: "no_exact_title_and_host_match"
          })
        );
        return;
      }
      if (hostMatches.length > 1) {
        audit.push(
          auditRow(source, rawValue, reference, position, "ambiguous_title_and_host", {
            rejectionReason: "multiple_exact_title_and_host_matches"
          })
        );
        return;
      }
      candidate = hostMatches[0];
      status = "resolved_title_and_host";
    }

    if (
      candidate.recommendationId === source.recommendationId ||
      normalizeManualSimilarityIdentity(candidate.title) ===
        normalizeManualSimilarityIdentity(source.title)
    ) {
      audit.push(
        auditRow(source, rawValue, reference, position, "self_reference", {
          rejectionReason: "source_and_target_match"
        })
      );
      return;
    }
    if (
      source.identityDuplicateGroup &&
      source.identityDuplicateGroup === candidate.identityDuplicateGroup
    ) {
      audit.push(
        auditRow(source, rawValue, reference, position, "safe_duplicate_reference", {
          rejectionReason: "same_safe_duplicate_group"
        })
      );
      return;
    }
    if (resolvedIds.has(candidate.recommendationId)) {
      audit.push(
        auditRow(source, rawValue, reference, position, "duplicate_manual_reference", {
          resolvedRecommendationId: candidate.recommendationId,
          resolvedTitle: candidate.title,
          resolvedHost: candidate.host,
          resolutionMethod: status,
          rejectionReason: "already_resolved_earlier_in_cell"
        })
      );
      return;
    }

    resolvedIds.add(candidate.recommendationId);
    const row = auditRow(source, rawValue, reference, position, status, {
      resolvedRecommendationId: candidate.recommendationId,
      resolvedTitle: candidate.title,
      resolvedHost: candidate.host,
      resolutionMethod: status
    });
    audit.push(row);
    resolved.push({ candidate, audit: row, position });
  });

  return { rawValue, references, resolved, audit };
}
