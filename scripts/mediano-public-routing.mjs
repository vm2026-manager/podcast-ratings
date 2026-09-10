import {
  PUBLIC_MEDIANO_RSS_URL,
  MEDIANO_PUBLIC_ROUTE_DEFINITIONS,
  matchesExplicitTitlePrefix,
  normalizeMedianoText,
  routeMedianoPublicTitle
} from "../supabase/functions/import-podcast-episodes/mediano-routing.mjs";

export { PUBLIC_MEDIANO_RSS_URL, normalizeMedianoText as normalizeRouteText };

export const MEDIANO_PUBLIC_ROUTES = MEDIANO_PUBLIC_ROUTE_DEFINITIONS.map((definition) => ({
  canonicalTitle: definition.canonicalTitle,
  podcastId: definition.podcastKey || definition.proposedPodcastKey,
  aliases: definition.aliases,
  status: definition.status
}));

export function routePublicMedianoTitle(title, routes = MEDIANO_PUBLIC_ROUTES) {
  if (routes !== MEDIANO_PUBLIC_ROUTES) {
    const matches = routes.filter((route) => matchesExplicitTitlePrefix(title, route.aliases));
    return matches.length === 1
      ? { status: "routed", route: matches[0] }
      : matches.length > 1 ? { status: "ambiguous", routes: matches } : { status: "unmatched", routes: [] };
  }

  const result = routeMedianoPublicTitle(title);
  if (result.status === "routed") {
    return { status: "routed", route: { canonicalTitle: result.route.canonicalTitle, podcastId: result.route.podcastKey } };
  }
  if (result.status === "known_no_destination") return { status: "known_no_destination", route: result.route };
  if (result.status === "ambiguous") return { status: "ambiguous", routes: result.routes };
  return { status: "unmatched", routes: [] };
}
