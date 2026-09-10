// Proposed routes for the public Mediano umbrella feed. This module is deliberately
// not imported by the episode importer: it is dry-run audit configuration only.

export const PUBLIC_MEDIANO_RSS_URL = "https://www.spreaker.com/show/6169233/episodes/feed";

export const MEDIANO_PUBLIC_ROUTES = [
  ["Magasinet Jennings", "magasinet jennings", ["Magasinet Jennings", "Jennings"]],
  ["Mediano Superliga", "mediano superliga", ["Mediano Superliga"]],
  ["Superliga Special", "superliga special", ["Superliga Special"]],
  ["Superliga Preview", "superliga preview", ["Superliga Preview"]],
  ["Mediano PL", "mediano pl", ["Mediano PL"]],
  ["Max Mediano", "max mediano", ["Max Mediano"]],
  ["Mediano 1. division", "mediano 1 division", ["Mediano 1. division"]],
  ["Mediano 2. division", "mediano 2 division", ["Mediano 2. division"]],
  ["Mediano Serie A", "mediano serie a", ["Mediano Serie A"]],
  ["Mediano La Liga", "mediano la liga", ["Mediano La Liga"]],
  ["Mediano Bundesliga", "mediano bundesliga", ["Mediano Bundesliga"]],
  ["Mediano Championship", "mediano championship", ["Mediano Championship"]],
  ["Mediano Landshold", "mediano landshold", ["Mediano Landshold"]],
  ["Mediano Breaking", "mediano breaking", ["Mediano Breaking"]],
  ["Mediano Garra", "mediano garra", ["Mediano Garra"]],
  ["Mediano Sport og Perspektiv", "mediano sport og perspektiv", ["Mediano Sport og Perspektiv"]],
  ["Fredagsbold", "fredagsbold", ["Fredagsbold"]],
  ["Fodbold var bedre i 90'erne", "fodbold var bedre i 90 erne", ["Fodbold var bedre i 90'erne"]],
  ["Klub Mediano", "klub mediano", ["Klub Mediano"]],
  ["Bold & Bøger", "bold boger", ["Bold & Bøger", "Bold og Bøger"]],
  ["Mediano Business", "mediano business", ["Mediano Business"]],
  ["Fodboldministeriet", "fodboldministeriet", ["Fodboldministeriet"]],
  ["Der var engang et mål", "der var engang et mal", ["Der var engang et mål"]],
  ["Brüchmann ringer til", "bruchmann ringer til", ["Brüchmann ringer til", "Bruchmann ringer til"]]
].map(([canonicalTitle, podcastId, aliases]) => ({ canonicalTitle, podcastId, aliases }));

export function normalizeRouteText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("da-DK")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePrefixText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("da-DK")
    .replace(/&/g, " og ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Prefix-only matching avoids a mention in the middle of a title becoming a route.
export function routePublicMedianoTitle(title, routes = MEDIANO_PUBLIC_ROUTES) {
  const normalizedTitle = normalizePrefixText(title);
  const matches = routes.filter((route) =>
    route.aliases.some((alias) => {
      const normalizedAlias = normalizePrefixText(alias);
      // A space is not sufficient: it would route a prose mention such as
      // "Mediano PL spiller omtaler …". A title separator is mandatory.
      return new RegExp(`^${escapeRegExp(normalizedAlias)}(?:$|\\s*(?::|#|[-–—|]|\\.{2,}))`, "u")
        .test(normalizedTitle);
    })
  );
  if (matches.length === 1) return { status: "routed", route: matches[0] };
  if (matches.length > 1) return { status: "ambiguous", routes: matches };
  return { status: "unmatched", routes: [] };
}
