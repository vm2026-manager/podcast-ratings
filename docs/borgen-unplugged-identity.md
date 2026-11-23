# #100 - Borgen Unplugged

The catalogue contains two independent identities with the same display title after the Sheet change.

| Podcast-ID | catalogue_id | Catalogue role |
| --- | --- | --- |
| `borgen unplugged` | `catalogue-v1-9db52a31` | Historical Qvortrup series, editorial score 8.0 |
| `borgen unplugged 2 0` | `catalogue-v1-689d27f8` | Current Flink and Langballe series, editorial score 7.8 |

The historical identity remains in the catalogue for exact links, stored ratings and recommendation audit references. Public discovery excludes its exact Podcast-ID, including when an older catalogue copy lacks the archive marker. Ranking and search, home and editorial cards, Explore recommendations and seeds, cached recommendation rows, and podcast detail widgets use that boundary. The historical deep link still opens the original profile without a recommendation widget.

The similarity product retains both source records and recommendation IDs. Its public sections exclude the historical record as both source and target, while the audit preserves exact resolution of the editorial relations. The current identity keeps its SoundCloud source and episode database key `borgen unplugged 2 0`.

## Read-only production baseline

On 2026-11-22, `borgen unplugged 2 0` had 516 active episodes, 516 distinct UUIDs, 516 distinct GUIDs, three episode ratings and four direct podcast ratings. Its only observed source was `soundcloud_borgen_unplugged_rss`. Public statistics showed four ratings, 7.3 rounded and 7.275 combined before rounding. The historical identity returned zero episodes and zero ratings. Neither ID had manual episode mappings.

Fingerprints are MD5 over newline-joined rows sorted by row ID. Within each row, the fields below are joined with `|`. Episode ratings join episodes by episode UUID before filtering by the exact podcast key. The episode fingerprint includes all rows for that key, with active count measured separately.

| Rows | Fields | MD5 |
| --- | --- | --- |
| Episodes | `id\|external_guid` | `a984c24b6524405faf9858765e04fdb5` |
| Episode ratings | `id\|episode_id\|rating\|user_id` | `5314802539dbe5df74f090d4a28997a8` |
| Direct podcast ratings | `id\|user_id\|rating` | `d295206ca4671a4365409bb3568cf458` |

The catalogue files are generated from the master Sheet by the validated catalogue-sync workflow. The intended cells are `Ark1!U75`, `Ark1!B95` and `'Udforsk-klynger'!D11`, scoped to the exact IDs above. Owner approval is required before writing the master.
