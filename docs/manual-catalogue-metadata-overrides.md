# Manually verified catalogue metadata

`data/manual-catalogue-metadata-overrides.json` contains narrow local enrichments for new catalogue rows whose editorial identity is already present in Ark1 but whose required link or image fields are blank. The sync applies these records before the existing `partitionSheetPodcastRows` function. Completed rows still pass through the normal catalogue-intake validator and the podcast identity-integrity gate.

## Krigen i Bosnien

The exact Ark1 Podcast-ID `krigen i bosnien` is paired with exact title, host, publisher and main-series values. The row's `Link` is filled with the already published `flashback politiken` parent link, after verifying the source row ID, title, publisher and exact URL. This is the Flashback series page; it is not an episode URL or an RSS feed.

The row's `Billedlink` is filled with the supplied repository-relative PNG path. Its bytes must match SHA-256 `eabde7a7ab0a05313516fda1d9c863c6f59968f60ba8fc4124534922d65bf1da`, and its PNG header must report 1400×1400. The image is owner-approved Podcastlisten editorial artwork and is not official Politiken artwork. It is later registered by the existing manual cover intake and generated into the normal original and 1400-pixel variants.

The override matches only the exact Podcast-ID. It fails on duplicate IDs, mismatched title/host/publisher/main series, changed or missing source bytes, or changed Flashback-parent link evidence. It fills only blank `Link` and `Billedlink` cells in the sync's in-memory row; it never writes to Google Sheets. Other incomplete rows continue through the existing intake queue unchanged. If a later Sheet row supplies either field, the Sheet value takes priority. Existing published IDs and `catalogue_id` values are retained by the normal sync identity-preservation step.

The cover registration marks the artwork `OWNER_APPROVED_EDITORIAL` with an empty `expectedImageUrl`: its proof is the exact podcast identity, owner approval and source checksum, not an assertion that the local art came from the publisher's image URL. The manual cover pipeline continues to require exact title, publisher, Podcast-ID and checksum evidence.
