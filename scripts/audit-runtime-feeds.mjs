import { readFile } from "node:fs/promises";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

// Offline/read-only: no database, feed fetch, import, or scheduler changes.
const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const { audit } = mergeSheetFeedConfigs(payload);
console.log(JSON.stringify(audit, null, 2));
if (audit.feed_warnings.length) console.error(`[feed-review] ${audit.feed_warnings.length} Sheet feed decisions require review; see feed_warnings.`);
