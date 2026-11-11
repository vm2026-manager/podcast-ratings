# Frihedsbrevet kildeaudit (2026-11-08)

## Omfang og metode

Ark1 i redaktionsarket **Podcast ratings** er master. Jeg læste de 36 Frihedsbrevet-rækker og sammenholdt dem med den faktiske struktur i `data/podcasts.json` (`{ rows: [...] }`). Sammenligningen bruger kun eksakt `Podcast-ID` og bekræfter titel, `catalogue_id`, udgiver, katalogets `Link` og `Feed`. Sheet-kolonnerne `Kilde`, `Hovedserie` og `Adgang` blev kontrolleret direkte i arket; `Hovedserie` er tom på alle 36 rækker. De tre kolonner findes ikke i katalog-JSON. På den aktuelle `main` stemmer titel, udgiver, Feed og Link for alle 36 rækker.

Der er 36 unikke Podcast-ID'er og 36 unikke `catalogue_id`-værdier. Begge Huset Færch-sæsoner er bevaret som hver sin identitet, selvom de deler Apple-show og RSS-feed. Titler bruges kun som kontrol efter identitetsmatch, aldrig til at udlede identitet. Frontendens `mapPodcast` bruger katalogets `Link`-felt som `podcast.link`, og de synlige podcastlinks peger derfor på denne URL.

Livekontrollen 8. november 2026 brugte ét afgrænset Apple Lookup-kald og højst tre samtidige GET-kald til HTTPS-RSS på `www.omnycontent.com`, med 10 sekunders timeout og 2 MB loft pr. svar. Der blev ikke hentet HTML, artikler, billeder eller lydfiler. Ingen login, produktionsskrivninger eller Supabase-kald. Apple leverede 28 opslag for 29 anmodede identiteter; titler og udgiver blev kontrolleret eksakt. Fælles RSS-URL'er blev kun hentet én gang.

RSS-dækning er et øjebliksbillede. Den opdaterede parser tæller kun RSS-elementer med `itunes:episodeType=full`, GUID og en HTTP(S)-enclosure med eksplicit `audio/*`-type, efter teasertitler og adgangsstatus er filtreret fra. `Trailer` inkluderer eksplicit trailer-type eller teasertitel. `Betalt` tæller feedposter på betalingsmarkerede katalogserier. GUID-kolonnen viser et verificeret eksempel; live-rapporten fra scriptet indeholder alle unikke GUID'er for hvert feed. URL'er, der ligner tokens eller signerede links, udelades fra rapportoutput. Tabellen nedenfor gengiver 8. novembers live-snapshot med den daværende parser; fulde/trailer-tællinger er ikke genberegnet med den nye audio-MIME-kontrol.

## Resultater for alle eksisterende rækker

| Podcast-ID | Titel | Kildeidentitet / klassifikation | RSS-dækning: fuld / trailer / betalt | Verificeret GUID-eksempel |
| --- | --- | --- | ---: | --- |
| `den forunderlige dr kavousi` | Den forunderlige Dr. Kavousi | [Apple 1698924021](https://podcasts.apple.com/dk/podcast/den-forunderlige-dr-kavousi/id1698924021) | 1 / 0 / 0 (Sheet: 4) | `726c695b-6f61-4c0e-ad97-b0480103eb0e` |
| `marathonmanden` | Marathonmanden | [Apple 1631985895](https://podcasts.apple.com/dk/podcast/marathonmanden/id1631985895) | 2 / 1 / 0 (5) | `3e7e7526-6676-4ac0-bf95-aeee00a3ba68` |
| `huset færch sæson 1` | Huset færch (sæson 1) | [Apple 1700144386](https://podcasts.apple.com/dk/podcast/huset-f%C3%A6rch/id1700144386), fælles RSS | 2 / 11 / 0 (8) | `d7ab023a-6d2a-4e5a-8800-b13000a31e69` |
| `doctor no` | Doctor No | [Apple 1677373013](https://podcasts.apple.com/dk/podcast/doctor-no/id1677373013) | 2 / 0 / 0 (5) | `0d86065b-f225-4477-8d62-afc70005d9dc` |
| `den talentfulde fru hjorth` | Den talentfulde Fru Hjorth | [Apple 1640261535](https://podcasts.apple.com/dk/podcast/den-talentfulde-fru-hjorth/id1640261535), Adgang: Betaling | 0 / 1 / 2 (6) | `d1a51a04-6813-4a30-a7c3-aefc00e3010c` |
| `fri mads` | Fri Mads | Artikel/nyhedsbrev; Link godkendt i Sheet | — (Sheet: ugentlig) | — |
| `det falske match` | Det falske match | [Apple 1631357575](https://podcasts.apple.com/dk/podcast/det-falske-match/id1631357575) | 1 / 1 / 0 (3) | `5b34149e-46d7-4e29-a1fd-aec200f415d0` |
| `kvindefængslet` | Kvindefængslet | [Apple 1661006786](https://podcasts.apple.com/dk/podcast/kvindefængslet/id1661006786) | 1 / 0 / 0 (3) | `5db5920e-2589-43bd-9ef7-af72014f0be7` |
| `i krig med pet` | I krig med PET | Apple 1893643527 viser tre trailere; eksakt Omny-kandidat, tomt feed | 0 / 0 / 0 (3) | — |
| `ulven fra aalborg` | Ulven fra Aalborg | [Apple 1633949019](https://podcasts.apple.com/dk/podcast/ulven-fra-aalborg/id1633949019) | 1 / 0 / 0 (4) | `11ba1e60-4be8-4b8d-b24a-aecc0108dc79` |
| `en jihadist bliver til` | En jihadist bliver til | [Apple 1654145867](https://podcasts.apple.com/dk/podcast/en-jihadist-bliver-til/id1654145867) | 2 / 0 / 0 (4) | `911ad95a-1f73-4b5f-94b4-af4a00b20263` |
| `kvinden som ikke ville kaldes bedrager` | Kvinden som ikke ville kaldes bedrager | [Apple 1697762256](https://podcasts.apple.com/dk/podcast/kvinden-som-ikke-ville-kaldes-bedrager/id1697762256) | 1 / 0 / 0 (4) | `e25001ba-137d-4bdb-8995-b03f00ea1271` |
| `broder salsa` | Broder Salsa | [Apple 1755573170](https://podcasts.apple.com/dk/podcast/broder-salsa/id1755573170) | 2 / 0 / 0 (2) | `ce0c84f8-a417-4341-89f9-b1cb0087dc94` |
| `huset færch sæson 2` | Huset færch (sæson 2) | [Apple 1700144386](https://podcasts.apple.com/dk/podcast/huset-f%C3%A6rch/id1700144386), samme RSS som sæson 1 | 2 / 11 / 0 (12) | `d7ab023a-6d2a-4e5a-8800-b13000a31e69` |
| `i krig med ha` | I krig med HA | [Apple 1858502218](https://podcasts.apple.com/dk/podcast/i-krig-med-ha/id1858502218), Omny-feed | 0 / 4 / 0 (4) | `76138e02-3d02-4cf7-93ac-b3bc00dcdc16` |
| `frihedsbrevets intranet` | Frihedsbrevets Intranet | Uafklaret; ingen eksakt kildeverifikation | — (Sheet: ugentlig) | — |
| `vi ejer byen` | Vi ejer byen | [Apple 6795461563](https://podcasts.apple.com/dk/podcast/vi-ejer-byen/id6795461563) | 0 / 1 / 0 (1) | `d26d4fbe-7cd5-42e7-8d95-b495009025c0` |
| `sofies valg` | Sofies valg | [Apple 1734993515](https://podcasts.apple.com/dk/podcast/sofies-valg/id1734993515) | 10 / 0 / 0 (Sheet: ugentlig) | `9f6954e0-ffac-4a70-9dcc-b244006556dd` |
| `du ma hellere ringe til bagge` | Du må hellere ringe til Bagge | [Apple 6795463727](https://podcasts.apple.com/dk/podcast/du-m%C3%A5-hellere-ringe-til-bagge/id6795463727) | 0 / 1 / 0 (3) | `54060e71-eaea-4240-bb73-b477016e4389` |
| `gribbene i skoven` | Gribbene i Skoven | Uafklaret; ingen eksakt kildeverifikation | — (10) | — |
| `eksterne affaerer r8dio frihedsbrevet` | Eksterne affærer | [Apple 6818511364](https://podcasts.apple.com/dk/podcast/eksterne-aff%C3%A6rer/id6818511364), Omny-feed; Adgang: Betalt | 0 / 0 / 1 (Sheet antal tomt; Apple viser 6) | `86dd6d19-229a-41b9-b8e9-b4d700c668ab` |
| `friis diplomatpost` | Friis’ diplomatpost | [Apple 1706073378](https://podcasts.apple.com/dk/podcast/friis-diplomatpost/id1706073378), Omny-feed | 23 / 77 / 0 (Sheet: ugentlig) | `52f9b062-feef-45b7-8555-b4f900ebb261` |
| `prins henriks krig` | Prins Henriks Krig | [Apple 1786337788](https://podcasts.apple.com/dk/podcast/prins-henriks-krig/id1786337788) | 2 / 0 / 0 (Sheet antal tomt) | `eb4e3ee8-07af-4744-b54d-b24c00a1759e` |
| `taskforce nord stream` | Taskforce Nord Stream | [Apple 1836717693](https://podcasts.apple.com/dk/podcast/taskforce-nord-stream/id1836717693) | 0 / 3 / 0 (Sheet antal tomt) | `cbc27d3a-2cbb-4294-892f-b4e400b6473f` |
| `velfærdsbanderne` | Velfærdsbanderne | [Apple 1891306405](https://podcasts.apple.com/dk/podcast/velf%C3%A6rdsbanderne/id1891306405) | 1 / 0 / 0 (6) | `75ed0ed5-dfae-4c20-b1f4-b4200130783c` |
| `noter fra bruxelles` | Noter fra Bruxelles | Artikelserie; Sheet Kilde peger på artikel #1 | — (3) | — |
| `jeppe bentzen oplevelsen` | Jeppe Bentzen Oplevelsen | [Apple 1787396779](https://podcasts.apple.com/dk/podcast/jeppe-bentzen-oplevelsen/id1787396779) | 6 / 2 / 0 (Sheet antal tomt) | `f212cd20-83e9-4f4d-b933-b2fc00cd40d5` |
| `vloggen` | VLoggen | Uafklaret; kataloglink er generel podcastoversigt | — (Sheet: ugentlig) | — |
| `fri ukraine` | Fri Ukraine | [Apple 1706330856](https://podcasts.apple.com/dk/podcast/fri-ukraine/id1706330856) | 28 / 0 / 0 (Sheet: ugentlig) | `b8d9c269-7ba0-4f8c-b067-b24200d9ad70` |
| `amira smajic bandene` | Amira Smajic Båndene | [Apple 1819878121](https://podcasts.apple.com/dk/podcast/amira-smajic-b%C3%A5ndene/id1819878121) | 1 / 0 / 0 (7) | `d36afbda-c85a-4e62-9b5f-b2f80171564e` |
| `novoland` | NovoLand | [Apple 1739448508](https://podcasts.apple.com/dk/podcast/novoland/id1739448508) | 0 / 6 / 0 (6) | `c2561fff-9089-45bc-8392-b170008011a6` |
| `korea papirerne` | Korea-papirerne | [Apple 1719469003](https://podcasts.apple.com/dk/podcast/korea-papirerne/id1719469003) | 1 / 0 / 0 (5) | `08a4da74-ca20-445d-9d17-b0cc014fd424` |
| `fields 3 juli` | Fields 3. Juli | [Apple 1651179573](https://podcasts.apple.com/dk/podcast/13-minutter/id1651179573) | 1 / 0 / 0 (3) | `189e7446-4d66-4277-af30-af3700ea67b8` |
| `mærsks mørke hemmelighed` | Mærsks mørke hemmelighed | [Apple 1642522245](https://podcasts.apple.com/dk/podcast/m%C3%A6rsks-m%C3%B8rke-hemmelighed/id1642522245) | 2 / 0 / 0 (6) | `66cc6a96-96e6-4834-b380-af0100e37176` |
| `dyrlægen fra auschwitz` | Dyrlægen fra Auschwitz | [Apple 6800488677](https://podcasts.apple.com/dk/podcast/dyrl%C3%A6gen-fra-auschwitz/id6800488677) | 0 / 1 / 0 (Sheet antal tomt) | `ddc04bd6-ed29-4718-8f2d-b4a300d95733` |
| `hashpladeforbandelsen` | Hashpladeforbandelsen | Uafklaret offentlig kilde; Adgang: Betaling | — (2) | — |

## Særlige kildemismatch og sikkerhed

- **Fri Mads:** Den oprindelige audit-baseline (`10f8680`) havde katalogets `Link` på artikel #140, mens Sheet `Link` var `https://frihedsbrevet.dk/nyhedsbrev/fri-mads/`. Den eksisterende automatiske katalogsync i [PR #503](https://github.com/vm2026-manager/podcast-ratings/pull/503) opdaterede derefter katalogets `Link` fra Sheet-masteren. Den aktuelle Sheet `Link` og katalogets `Link` peger begge på oversigten; Sheet `Kilde` peger fortsat på `https://frihedsbrevet.dk/fri-mads-140-verden-af-i-gaar/`. Frontend bruger katalogets `Link`, så den aktuelle visning åbner oversigten. Denne audit foretog ingen Sheet- eller katalogskrivning. Fri Mads er artikel/nyhedsbrev, ikke en lydpodcast.
- **Friis’ diplomatpost:** Sheet har allerede et Omny-RSS-link, men dets kanal er den generelle Frihedsbrevet-kanal. Apple-opslaget for præcis show-ID 1706073378 giver det dedikerede Friis-feed med kanalnavnet `Friis' diplomatpost`; det indeholder 100 poster, hvor 77 er trailere/uddrag og 23 klassificeres som fulde offentlige poster. Feedet er derfor en langt bedre dækningskilde, men er ikke automatisk importeret.
- **Eksterne affærer:** `Apple:6818511364` løses til præcis Apple-identitet og Omny-feed. Apple viser seks poster, men RSS eksponerer kun én `Pilot`. Sheet siger `Betalt`; feedposten klassificeres derfor betalt og kan ikke importeres.
- **I krig med PET:** Apple-kilden viser tre trailere. Den fundne Omny-kandidat har korrekt kanalnavn, men nul RSS-poster. Kandidaten giver ingen importgrundlag.
- **I krig med HA:** Apple og Omny stemmer eksakt; alle fire RSS-poster er trailere. Ingen import.
- Der blev ikke oprettet episoder, databaseposter, katalogposter eller lydenclosures. Skriptet har eksplicit `writesPerformed: false`, `supabaseCalls: 0` og `importAllowed: false`.

## Kilder

- [Podcast ratings – redaktionel master](https://docs.google.com/spreadsheets/d/1V21y9uMx_fGethrT47hILWczgK_ZSNRfksSKWuR69ss/edit)
- [Apple Podcasts Lookup API](https://itunes.apple.com/lookup)
- [Frihedsbrevets offentlige hovedfeed](https://frihedsbrevet.dk/feed/) (kun tidligere undersøgt som generel kanal; anvendt ikke som identitet for en serie)
