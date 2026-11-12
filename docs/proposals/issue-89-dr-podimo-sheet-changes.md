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

Stagingfanen `LÆS FØRST #89` samt ejerens udtrykkelige bekræftelse den 12.11.2026 dokumenterer den fulde redaktionelle beslutning: DR's `Kampen om historien` er en ny hovedpodcast uden redaktionel totalscore; Rwanda `7,7` og Sovjetunionen `5,9` knyttes til DR med eksakte, uændrede anmeldelses-ID'er; Podimos `Styr på historien` bevarer Podcast-ID `kampen om historien` og score `5,8`; bruger-/episodevurdering følger `magten`. De godkendte stagingbeskrivelser gælder som fallbacktekster. Dette er redaktionel indholdsgodkendelse, ikke tilladelse til at skrive til originalarket eller produktionsdata.

## Foreslået indhold

### Eksisterende podcastidentiteter

- Bevar `rwanda verdens hurtigste folkemord` med score `7,7` og `sovjetunionen lenin og stalins danske agent` med score `5,9`. Deres DR-hovedserie-tilknytning er et forslag; ID, score, metadata og historisk identitet ændres ikke.
- Vis posten `kampen om historien` som `Styr på historien` fra Podimo. Bevar ID og score `5,8`; ingen scoreoverførsel.
- Den officielle Podimo-profil er `https://podimo.com/dk/shows/styr-pa-historien`. Dens showbillede linker til `https://img.podimo.com/podcast/45d3a310-9003-4e38-a82f-39879927b5c7?h=400&s=fc1aRlkafgBcnHi58OugNDOdmQ0&w=400`; coverkilden er verificeret mod profilens showbillede. Billedets asset-UUID er **ikke** Podimo-showets UUID.
- De godkendte Podimo M/O-tekster er `Adam Holm fortæller om historiske konflikter og begivenheder, der har formet den verden, vi lever i.` / `I Styr på historien undersøger Adam Holm historiske konflikter og begivenheder og deres betydning for den verden, vi lever i i dag.` DR fallbackens eksakte M/O-tekst er `DR’s historiske podcast om fortidens begivenheder og deres betydning.` / `Kampen om historien er DR’s historiske podcast om begivenheder, konflikter og personer, der har sat spor i historien.` Feedcellen forbliver tom, og importen deaktiveret, indtil Podimo-show-UUID er positivt verificeret.

### Ny DR-hovedpodcast

Foreslået ID: `kampen om historien dr`; titel `Kampen om historien`; udgiver `DR`; score tom; profil `https://www.dr.dk/lyd/p1/kampen-om-historien-3166339029000`; cover `https://api.dr.dk/podcasts/v1/images/urn:dr:podcast:image:69b92600196d91f77288ecdc.jpg`; feed `https://api.dr.dk/podcasts/v1/feeds/kampen-om-historien-3.xml?format=podcast`. Det officielle DR-feed har kanalidentiteten `Kampen om historien`, og dets kanalbillede matcher cover-URL'en. Feedimporten forbliver deaktiveret, indtil destination, synkronisering og episodeidentiteter er særskilt godkendt.

## Obligatorisk kontrol før enhver fremtidig master-write

1. Læs den aktuelle master direkte; brug ikke stagingkoordinater, denne tabels stagingadresser, gamle PR-adresser, cachede rækker eller rækkenumre som skriveadresser.
2. Genfind hver eksisterende post ved eksakt, entydigt `Podcast-ID` i kolonne V. Læs den aktuelle række og kontroller alle relevante før-værdier, mindst titel (B), score (D), udgiver (F), hovedserie (G) og Podcast-ID (V); kontrollér også de konkrete førværdier for hvert felt, der skal ændres.
3. Fortsæt kun hvis hvert ID findes præcis én gang, og alle kontrollerede førværdier matcher det særskilt godkendte ændringsforslag. Ved manglende ID, flere matches eller én eneste afvigelse: stop uden writes og få forslaget genauditeret.
4. Før en ny DR-række kan foreslås i master, søg i den aktuelle kolonne V efter det eksakte kandidat-ID `kampen om historien dr`; stop hvis det allerede findes. Find først derefter en aktuel, godkendt indsættelsesposition, og kontrollér tabelstruktur og rækkeændringer igen.
5. Vis ejer de aktuelt genfundne rækker og før/efter-værdier til særskilt godkendelse umiddelbart før write. Denne dokumentation er ikke i sig selv skrivegodkendelse.

Der er ingen godkendte master-writes i dette forslag. Ingen databaseændringer, scoreændringer, episodeimport eller ID-remapping er godkendt.

## Katalogoverførsel efter godkendelse

Dette afsnit er et før/efter-forslag til normal Google Sheets → GitHub PR-proces; det indeholder ingen master-write-instruktion med faste rækker. Den 12.11.2026 blev originalens `Ark1` læst skrivebeskyttet: eksakte ID-søgninger i `V1:V2960` fandt hver af de tre eksisterende ID'er præcis én gang; det nye DR-ID havde nul matches. De viste masterceller nedenfor er kun en dateret førværdi-audit og må ikke genbruges som senere skriveadresser. Stagingværdierne er godkendte mål. På ændringstidspunktet skal en frisk masterlæsning finde hver post ved eksakt `Podcast-ID` i kolonne V; sammenlign alle førværdierne og stop ved mismatch. Brug derefter aktuelt fundne rækker til et begrænset, gennemgåeligt katalogforslag og CI-valideret katalog-PR.

| Eksakt Podcast-ID | Læst original-master førværdi (kun audit) | Godkendt stagingmål | Genkontrol før fremtidig Sheet→PR-proces |
| --- | --- | --- | --- |
| `rwanda verdens hurtigste folkemord` | `D=7,7`; `F=DR`; `G=Kampen om historien`; `V` er eksakt ID | Kun `G → Kampen om historien (DR)`; behold D/F/V og alle anmeldelsesfelter | Søg ID entydigt igen; førværdierne D/F/G/V skal alle matche. Stagingens G123 er ikke en masteradresse. |
| `sovjetunionen lenin og stalins danske agent` | `D=5,9`; `F=DR`; `G=Kampen om historien`; `V` er eksakt ID | Kun `G → Kampen om historien (DR)`; behold D/F/V og alle anmeldelsesfelter | Søg ID entydigt igen; førværdierne D/F/G/V skal alle matche. Stagingens G440 er ikke en masteradresse. |
| `kampen om historien` | `B=Kampen om historien`; `D=5,8`; `F=Podimo`; `J=https://podimo.com/dk`; `L=https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSj5UgrqudhMuJgWw12fGQnLcwv7ekWknNAQw&s`; `M=Adam Holm undersøger, hvordan historien bruges, formes og bekæmpes.`; `O=Adam Holm undersøger, hvordan historiske begivenheder bliver fortolket, brugt og forandret i nutidens politiske og kulturelle kampe. Sammen med forskere og andre gæster diskuterer han, hvem der får lov til at definere fortiden, og hvorfor historieskrivning fortsat skaber konflikt.`; `X=https://podimo.com/dk`; `V` er eksakt ID | `B=Styr på historien`; behold `D=5,8`, `F=Podimo`, `V`; `J`/`X=https://podimo.com/dk/shows/styr-pa-historien`; use official profile cover at `L`; set exact approved M/O texts above | Søg ID entydigt igen; alle førværdier for B/D/F/J/L/M/O/X/V skal matche. Stagingens B/J/L/M/O/X448 er ikke masteradresser. |
| `kampen om historien dr` | Ingen match i originalens eksakte-ID-søgning på `V1:V2960` | Ny DR-post: `B=Kampen om historien`; `D` blank; `F=DR`; `V=kampen om historien dr`; brug godkendte DR-værdier i J/L/M/O/S/X, mens runtime-importen forbliver deaktiveret | Gentag hele ID-kolonne-søgningen; stop ved ethvert eksisterende match/dublet og vælg aktuel indsættelsesposition først derefter. Staging A1371:Y1371 er ikke en masterdestination. |

PR #536 er den eksisterende katalogpipeline-PR og må ikke omgås. Før en separat #89 katalog-PR oprettes, skal pipelinefejlen løses gennem normal review/gates, og ændringsforslaget baseres på ny masteraudit med eksakte ID'er og førværdier. Ingen produktionssynkronisering, Sheet-write, import eller databasewrite er godkendt her.

## Resterende godkendelser

1. Den redaktionelle løsning og beskrivelser er godkendt; katalogsyncens tekniske koordinering og #536-pipelineblokering er fortsat åbne.
2. Podimo-showets UUID verificeres positivt før feedcellen udfyldes eller import aktiveres; billedets asset-UUID må ikke bruges som erstatning.
3. Enhver senere originalarkændring kræver særskilt udgivelsesgodkendelse efter ny ID- og førværdi-audit. Stagingkoordinaterne må aldrig bruges til master-write.
