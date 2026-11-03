// Read only an explicit DR credit label that includes the word "vært".
// Mentions under other roles (for example Medvirkende or Producer) do not qualify.
const NEXT_CREDIT = /\s+(?:Medvirkende|Tilrettelæggelse|Tilrettelægger|Redaktion|Redaktør|DR redaktør|Producer|Producent|Vært)\s*:/iu;

export function extractExplicitDrHostCredit(value) {
  const text = String(value ?? "").replace(/\s+/gu, " ").trim();
  const matches = [];
  const label = /\b[^:;.!?]{0,100}\bvært\b[^:;.!?]{0,60}:\s*/giu;
  for (const match of text.matchAll(label)) {
    const start = match.index + match[0].length;
    const tail = text.slice(start);
    const nextRole = NEXT_CREDIT.exec(tail)?.index ?? tail.length;
    const punctuation = tail.slice(0, nextRole).search(/[.;!?]/u);
    const end = punctuation >= 0 ? punctuation : nextRole;
    const host = tail.slice(0, end).trim().replace(/[,\s]+$/u, "");
    const credit = text.slice(match.index, start).trim().replace(/\s*:\s*$/u, "") + ": " + host;
    if (host) matches.push({ host, credit });
  }
  const uniqueHosts = [...new Set(matches.map(({ host }) => host))];
  if (uniqueHosts.length !== 1) return { host: "", credit: "", conflict: uniqueHosts.length > 1 };
  return { host: uniqueHosts[0], credit: matches[0].credit, conflict: false };
}
