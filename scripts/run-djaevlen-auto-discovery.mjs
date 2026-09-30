import { readFile, writeFile } from "node:fs/promises";
import { discoverDjaevlenChildren } from "./djaevlen-auto-discovery.mjs";

const feedUrl = "https://api.dr.dk/podcasts/v1/feeds/djaevlen-i-detaljen";
const catalogue = JSON.parse(await readFile("data/podcasts.json", "utf8"));
const registry = JSON.parse(await readFile("data/auto-discovered-djaevlen.json", "utf8"));
const response = await fetch(feedUrl, { headers: { accept: "application/rss+xml, application/xml" } });
if (!response.ok) throw new Error(`DR Djævlen feed failed: ${response.status}`);
const xml = await response.text();
const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/giu)].map((match) => match[0]);
const titles = items.flatMap((item) => [...item.matchAll(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([^<]*)<\/title>/gu)]
  .map((match) => (match[1] || match[2] || "").trim()).filter(Boolean));
const result = discoverDjaevlenChildren({ catalogueRows: catalogue.rows, registry, episodeTitles: titles });
if (result.report.collisions.length || result.report.unsafe.length) {
  throw new Error(`Unsafe Djævlen discovery: ${JSON.stringify({ collisions: result.report.collisions, unsafe: result.report.unsafe.slice(0, 10) })}`);
}
if (result.report.created.length) await writeFile("data/auto-discovered-djaevlen.json", `${JSON.stringify(result.registry, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result.report, null, 2));
