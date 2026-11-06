# Tyran DR Lyd source audit — 2026-11-06

## Verified source structure

The program page is an umbrella page (DR Next.js __NEXT_DATA__.props.pageProps.pageType = umbrella). Its parts list contains 24 series cards, each with a title, a 13-digit series productionNumber, an exact standalone presentationUrl, and an imageAssets entry where target = SquareImage, ratio = 1:1, and format = image/png or image/jpeg. The cards are series, not episode rows. Individual child-series pages use pageType = series and expose complete episodes in episodesGroups[].items[], with episode productionNumber, title, startTime, durationMilliseconds, presentationUrl, and per-episode imageAssets.

The public RSS https://api.dr.dk/podcasts/v1/feeds/tyran has channel title Tyran and links to the umbrella program page. It includes short migration/promotional entries as well as episode entries. On 2026-11-06 the leading “Hør alle episoder af Tyran i DR LYD” item had GUID 16122693718, date 2026-11-05, duration 62 seconds and linked to the umbrella; it is not a series episode. Full episodes are verified from each matching standalone page, not inferred from that teaser or an RSS slug.

## Current DR directory

| DR child title | DR series productionNumber | Exact child page | SquareImage ID | Podcast-ID in catalogue/registry |
|---|---:|---|---|---|
| Marcos | 6641325831949 | [DR page](https://www.dr.dk/lyd/p3/tyran-marcos-6641325831949) | 6ad8a63dd1248e67782813bf | marcos |
| Leopold II | 6641221733951 | [DR page](https://www.dr.dk/lyd/p3/tyran-leopold-ii-6641221733951) | 6a96ae037472ce653345f984 | leopold ii |
| Macias | 6641072699897 | [DR page](https://www.dr.dk/lyd/p3/tyran-macias-6641072699897) | 6a4e30ea60319a54701828b9 | tyran-auto-v1-08d0021f |
| Muammar Gaddafi | 6640975744551 | [DR page](https://www.dr.dk/lyd/p3/tyran-muammar-gaddafi-6640975744551) | 6a0c0f4e7b148e5451e16710 | muammar gaddafi |
| Enver Hoxha | 6640897826723 | [DR page](https://www.dr.dk/lyd/p3/tyran-enver-hoxha-6640897826723) | 69d8daa9fb001330decce834 | enver hoxha |
| Charles Taylor | 6640783343645 | [DR page](https://www.dr.dk/lyd/p3/tyran-charles-taylor-6640783343645) | 69b27b8d2b11372a7da944f6 | charles taylor |
| Ayatollah Khomeini | 6640738988358 | [DR page](https://www.dr.dk/lyd/p3/tyran-ayatollah-khomeini-6640738988358) | 696f3b31753c04e7ed879d0b | ayatollah khomeini |
| Ceausescu | 6640594095117 | [DR page](https://www.dr.dk/lyd/p3/tyran-ceausescu-6640594095117) | 69205604a90450d1bd85ffe7 | ceausescu |
| Trujillo | 6640515440247 | [DR page](https://www.dr.dk/lyd/p3/tyran-trujillo-6640515440247) | 6901d9eb91066218a4c409de | trujillo |
| Mao | 6640392283904 | [DR page](https://www.dr.dk/lyd/p3/tyran-mao-6640392283904) | 68bed3d32b60b4c321271a43 | mao |
| Bokassa | 6640283515533 | [DR page](https://www.dr.dk/lyd/p3/tyran-bokassa-6640283515533) | 68944676de2818e2a02f4bdf | bokassa |
| Franco | 6640204496465 | [DR page](https://www.dr.dk/lyd/p3/tyran-franco-6640204496465) | 6890920cab10e7b0b6975544 | franco |
| Nijasov | 6640204489190 | [DR page](https://www.dr.dk/lyd/p3/tyran-nijasov-6640204489190) | 6890920a2e199a1c531f7fad | nijasov |
| Milosevic | 6640204487031 | [DR page](https://www.dr.dk/lyd/p3/tyran-milosevic-6640204487031) | 6890922bab10e7b0b69759ec | milosevic |
| Hirohito | 6640204485792 | [DR page](https://www.dr.dk/lyd/p3/tyran-hirohito-6640204485792) | 6890922a2e199a1c531f835c | hirohito |
| Pinochet | 6640204484718 | [DR page](https://www.dr.dk/lyd/p3/tyran-pinochet-6640204484718) | 689092062e199a1c531f7f2a | pinochet |
| Lenin | 6640204483881 | [DR page](https://www.dr.dk/lyd/p3/tyran-lenin-6640204483881) | 68909209ab10e7b0b697551a | lenin |
| Kim Il Sung & Kim Jong Il | 6640204480403 | [DR page](https://www.dr.dk/lyd/p3/tyran-kim-il-sung-og-kim-jong-il-6640204480403) | 689092222e199a1c531f82a9 | kim il sung og kim jong il |
| Suharto | 6640204478237 | [DR page](https://www.dr.dk/lyd/p3/tyran-suharto-6640204478237) | 689092012e199a1c531f7ebc | suharto |
| Papa Doc | 6640204475520 | [DR page](https://www.dr.dk/lyd/p3/tyran-papa-doc-6640204475520) | 68909221ab10e7b0b697587e | papa doc |
| Benito Mussolini | 6640204474276 | [DR page](https://www.dr.dk/lyd/p3/tyran-benito-mussolini-6640204474276) | 689097bbab10e7b0b6977e33 | benito mussolini |
| Pol Pot | 6640204472498 | [DR page](https://www.dr.dk/lyd/p3/tyran-pol-pot-6640204472498) | 68909219ab10e7b0b697574e | pol pot |
| Idi Amin | 6640204459576 | [DR page](https://www.dr.dk/lyd/p3/tyran-idi-amin-6640204459576) | 68909215ab10e7b0b69756c7 | idi amin |
| Saddam Hussein | 6640204449921 | [DR page](https://www.dr.dk/lyd/p3/tyran-saddam-hussein-6640204449921) | 6890920f2e199a1c531f8095 | saddam hussein |

## Full episode detail verified for the newly handled series

### Marcos

- Series ID: urn:dr:radio:series:6ad1ecb299797788ba19118f; series productionNumber: 6641325831949.
- Official DR square image: [SquareImage 6ad8a63dd1248e67782813bf](https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6ad8a63dd1248e67782813bf?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29). Image response verified as a distinct 720×720 JPEG; SHA-256: 3168d4eeb2db7a75e5b4644931fc37b0ba2cb7bd175b450c775c0101c58f3173.

| Full episode title | Episode productionNumber | DR date | Duration | Episode URL |
|---|---:|---|---:|---|
| 1:6 - Marcos | 16122693711 | 2026-10-22T03:00:00.000Z | 1878s | [DR episode](https://www.dr.dk/lyd/p3/tyran-marcos/tyran-marcos-24/1-6-marcos-16122693711) |
| 2:6 - Marcos | 16122693712 | 2026-10-29T04:00:00.000Z | 2129s | [DR episode](https://www.dr.dk/lyd/p3/tyran-marcos/tyran-marcos-24/2-6-marcos-16122693712) |
| 3:6 - Marcos | 16122693713 | 2026-11-05T04:00:00.000Z | 1950s | [DR episode](https://www.dr.dk/lyd/p3/tyran-marcos/tyran-marcos-24/3-6-marcos-16122693713) |

### Macias

- Series ID: urn:dr:radio:series:6a3e55fa1645505efca628b6; series productionNumber: 6641072699897.
- Official DR square image: [SquareImage 6a4e30ea60319a54701828b9](https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6a4e30ea60319a54701828b9?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29). Image response verified as a distinct 720×720 JPEG; SHA-256: 5f8fa9bba69c3a5718623ea846d2608affd0074c8437411159c3240b429e4425.

| Full episode title | Episode productionNumber | DR date | Duration | Episode URL |
|---|---:|---|---:|---|
| 1:4 - Macias | 16122693681 | 2026-08-06T03:00:00.000Z | 2234s | [DR episode](https://www.dr.dk/lyd/p3/tyran-macias/tyran-macias-22/1-4-macias-16122693681) |
| 2:4 - Macias | 16122693682 | 2026-08-13T03:00:00.000Z | 1907s | [DR episode](https://www.dr.dk/lyd/p3/tyran-macias/tyran-macias-22/2-4-macias-16122693682) |
| 3:4 - Macias | 16122693683 | 2026-08-20T03:00:00.000Z | 2210s | [DR episode](https://www.dr.dk/lyd/p3/tyran-macias/tyran-macias-22/3-4-macias-16122693683) |
| 4:4 - Macias Nørdeafsnit | 16122693684 | 2026-08-27T03:00:00.000Z | 1751s | [DR episode](https://www.dr.dk/lyd/p3/tyran-macias/tyran-macias-22/4-4-macias-noerdeafsnit-16122693684) |

## Identity and import boundaries

- The 22 original DR image IDs and canonical Podcast-IDs from merged PR #243 remain pinned by the existing cover test and discovery checks.
- Marcos already had the exact catalogue Podcast-ID marcos; its identity is adopted without creating a new ID. Macias did not exist in the catalogue and is additively registered as tyran-auto-v1-08d0021f.
- Both new registrations are tied to the DR series ID, source page, official square image URL, source checksum, and a full episode. They keep needs_editorial_review = true.
- The exact child-page import adapters are code-owned and enabled = false. A catalogue row or a generic Sheet feed value cannot activate them. No Edge Function was deployed and no production feed import or database write was run.
- The cover manifest stores local generated assets, while these covers remain official DR remote sources; their exact cover identity, source URL, format, dimensions, byte length, and SHA-256 are stored in the version-controlled Tyran registry, which the existing local-cover manifest pipeline does not consume.
