# #89 – forslag til ændringer i Podcast ratings

Dette er et lokalt reviewforslag. Det skriver ikke til originalarket `Podcast ratings` / fanen `Ark1`. Stagingarket er kun et godkendelsesartefakt; dets række- og cellekoordinater må aldrig bruges som mål ved en senere ændring af masterarket.

## Verificeret staging-audit

Kopien `STAGING – #89 DR og Podimo – KUN TIL GODKENDELSE – 2026-11-11`, fanen `Ark1`, blev fysisk kontrolleret. De følgende A1-adresser gælder **kun stagingkopien på kontroltidspunktet** og er ikke gyldige masteradresser:

| Stagingadresse | Eksakt Podcast-ID | Kontrolleret værdi/status |
| --- | --- | --- |
| `G123` | `rwanda verdens hurtigste folkemord` | Hovedserie foreslået som `Kampen om historien (DR)`; titel, score 7,7, udgiver og ID bevaret. |
| `G440` | `sovjetunionen lenin og stalins danske agent` | Hovedserie foreslået som `Kampen om historien (DR)`; titel, score 5,9, udgiver og ID bevaret. |
| `B448`, `J448`, `L448`, `M448`, `O448`, `X448` | `kampen om historien` | Podimo-postens titel/metadataforslag. ID og score 5,8 bevares. |
| `A1371:Y1371` | `kampen om historien dr` | Ny DR-hovedpodcast foreslået uden redaktionel score. |

Stagingfanen `LÆS FØRST #89` dokumenterer, at ejeren den 11.11.2026 bekræftede, at redaktionel score `5,8` tilhører Podimos `Styr på historien`. Scoren og Podcast-ID `kampen om historien` er derfor godkendt til bevarelse. Det godkender ikke i sig selv øvrige tekst-, cover-, adgangs- eller masterarkændringer.

## Foreslået indhold

### Eksisterende podcastidentiteter

- Bevar `rwanda verdens hurtigste folkemord` med score `7,7` og `sovjetunionen lenin og stalins danske agent` med score `5,9`. Deres DR-hovedserie-tilknytning er et forslag; ID, score, metadata og historisk identitet ændres ikke.
- Vis posten `kampen om historien` som `Styr på historien` fra Podimo. Bevar ID og score `5,8`; ingen scoreoverførsel.
- Den officielle Podimo-profil er `https://podimo.com/dk/shows/styr-pa-historien`. Dens showbillede linker til `https://img.podimo.com/podcast/45d3a310-9003-4e38-a82f-39879927b5c7?h=400&s=fc1aRlkafgBcnHi58OugNDOdmQ0&w=400`; coverkilden er således verificeret mod den officielle profils showbillede. Billedets asset-UUID er **ikke** Podimo-showets UUID.
- Forslag til Podimo-beskrivelserne i `M448`/`O448` er parafraser baseret på profilen. Andre Podimo-metadata og adgangsfeltet kræver fortsat ejerens godkendelse. Feedcellen forbliver tom, og importen deaktiveret, indtil show-UUID er positivt verificeret.

### Ny DR-hovedpodcast

Foreslået ID: `kampen om historien dr`; titel `Kampen om historien`; udgiver `DR`; score tom; profil `https://www.dr.dk/lyd/p1/kampen-om-historien-3166339029000`; cover `https://api.dr.dk/podcasts/v1/images/urn:dr:podcast:image:69b92600196d91f77288ecdc.jpg`; feed `https://api.dr.dk/podcasts/v1/feeds/kampen-om-historien-3.xml?format=podcast`. Det officielle DR-feed har kanalidentiteten `Kampen om historien`, og dets kanalbillede matcher cover-URL'en. Feedimporten forbliver deaktiveret, indtil destination, synkronisering og episodeidentiteter er særskilt godkendt.

## Obligatorisk kontrol før enhver fremtidig master-write

1. Læs den aktuelle master direkte; brug ikke stagingkoordinater, denne tabels stagingadresser, gamle PR-adresser, cachede rækker eller rækkenumre som skriveadresser.
2. Genfind hver eksisterende post ved eksakt, entydigt `Podcast-ID` i kolonne V. Læs den aktuelle række og kontroller alle relevante før-værdier, mindst titel (B), score (D), udgiver (F), hovedserie (G) og Podcast-ID (V); kontrollér også de konkrete førværdier for hvert felt, der skal ændres.
3. Fortsæt kun hvis hvert ID findes præcis én gang, og alle kontrollerede førværdier matcher det særskilt godkendte ændringsforslag. Ved manglende ID, flere matches eller én eneste afvigelse: stop uden writes og få forslaget genauditeret.
4. Før en ny DR-række kan foreslås i master, søg i den aktuelle kolonne V efter det eksakte kandidat-ID `kampen om historien dr`; stop hvis det allerede findes. Find først derefter en aktuel, godkendt indsættelsesposition, og kontrollér tabelstruktur og rækkeændringer igen.
5. Vis ejer de aktuelt genfundne rækker og før/efter-værdier til særskilt godkendelse umiddelbart før write. Denne dokumentation er ikke i sig selv skrivegodkendelse.

Der er ingen godkendte master-writes i dette forslag. Ingen databaseændringer, scoreændringer, episodeimport eller ID-remapping er godkendt.

## Resterende godkendelser

1. Ejerens bekræftelse af Podimo-score 5,8 er dokumenteret og afsluttet.
2. Ejer godkender fortsat DR-seriens metadata, tilknytningen af de to historiske anmeldelser samt katalogsynkroniseringens koordinering.
3. Ejer godkender de øvrige Podimo-metadata (beskrivelser og adgangsfeltet).
4. Podimo-showets UUID verificeres positivt før feedcellen udfyldes eller import aktiveres.
5. Enhver senere masterarkændring kræver særskilt redaktionel godkendelse af de aktuelle, ID- og førværdi-kontrollerede cells; ingen af stagingkoordinaterne kan bruges til den write.
