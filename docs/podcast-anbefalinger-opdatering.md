# Sikker opdatering af podcastanbefalinger

Fase 2B bevarer den statiske side og det redaktionelt valgte udvalg. Ingen katalog-sync-, import- eller anbefalingsalgoritmer ændres. Landingssiden laver ingen databasekald. De 15 beskrivelser, genrer, titler, covers og eventuelle redaktionelle vurderinger er kontrolleret mod det nuværende `data/podcasts.json`; siden viser ingen opdateringsdato.

## Eksisterende flow og begrænsning

`.github/workflows/sync-sheet-data.yml` henter kataloget til `.sync-stage`, validerer identiteter, kopierer katalogdata og genberegner anbefalingsproduktet. Ændringer kommer i en PR på `automation/catalogue-sync`, med en fuld Critical Regression Gate mod PR-head og mulighed for automatisk merge efter grønne kontroller.

Flowet regenererer hverken `/podcast-anbefalinger/` eller de eksisterende SEO-podcastsider. `add-paths` omfatter kun katalog- og anbefalingsdata. Landingssidens nuværende test sammenligner hvert kort med kataloget. Ændringer i et valgt podcasts relevante felter stopper derfor kontrollen, indtil landingssiden er opdateret. Det er en eksisterende beskyttelse mod forældet indhold, men ikke automatisk vedligeholdelse.

## Mindst risikable næste opgave

Implementér en særskilt generator for **kun** `podcast-anbefalinger/index.html`, med en fast HTML-skabelon og et reviewed udvalg af de nuværende permanente Podcast-ID'er. Vælg ikke podcasts efter ratings, titelmatch eller popularitet, og tilføj ikke automatisk nye URL'er. Bevar den redaktionelle rækkefølge og alle eksisterende canonical-links fra SEO-sikkerhedsregistret.

Generatoren skal:

- Have dry-run som standard; testkørsler må aldrig skrive versionsstyrede filer.
- Læse `data/podcasts.json` lokalt, kræve gyldigt schema/count og entydige, uændrede ID'er for alle 15 valgte podcasts. Manglende eller tvetydige oplysninger skal stoppe opdateringen og bevare den publicerede HTML; de må ikke fjerne kort eller sider.
- HTML-escape katalogtekst og kun tillade interne, verificerede podcast-links og eksisterende lokale coverfiler. Titel, beskrivelse, genre og redaktionel score skal komme fra den entydige katalogrække. Ingen brugeraggregater må udledes af katalogscore.
- Bygge kandidatindhold i isoleret staging; validere alle kort, SEO-felter, interne links, samme udvalg og alle hidtidige canonical-links før en atomisk udskiftning af den ene HTML-fil. Brug skrivelås, kontrollér kildeændringer under kørsel og afvis symlinks. Staging må aldrig kunne slette publicerede mapper.
- Lade `sitemap.xml`, SEO-sikkerhedsbaseline/-state og alle øvrige publicerede sider være uændrede. Ingen sletninger er nødvendige; en eventuel senere sletning kræver særskilt eksplicit godkendelse.
- Give identiske bytes ved gentagelse med samme kilder. Vis ikke en genereringsdato som katalogets opdateringsdato. En eventuel senere dato skal have verificeret kildeproveniens.

Tilføj særskilte tests for dry-run, manglende/duplikerede ID'er, ugyldig score, HTML-escaping, konflikter i canonical-links, afbrudt staging/publicering, samtidige kildeændringer, idempotens og bevaring af hele sitemap samt alle publicerede sider. Bevar fase 1-generatorens sikkerhedskontroller uændrede.

Først derefter kan katalog-sync kalde generatoren mod det validerede katalog i staging, medtage den ene HTML-fil i samme katalog-PR og køre den fulde gate, også ved opdatering af en eksisterende PR. Test både katalogændringer og uændret katalog. Der skal ikke tilføjes Supabase-kald, nye abonnementer eller direkte publicering til main.

Denne integration bør være en separat PR: skrivelogik, staging, låsning og sync-flowets mulighed for automatisk merge kræver en selvstændig sikkerhedsgennemgang. Indtil da skal ændrede katalogfelter opdateres i en reviewet PR, og den eksisterende katalogsammenligning skal fortsat stoppe ved uoverensstemmelser.

## Verificerede ruter

Appen bruger hash-routing: `/#forside`, `/#ranglister` og `/#udforsk`. `/?podcast=<permanent-ID>` åbner den eksisterende detaljevisning. Der er ingen eksisterende genreparameter til direkte genrevalg. Genreafsnittene linker derfor til ranglisterne og angiver det præcise genrefilter, brugeren skal vælge. True crime har desuden en eksisterende statisk genreside. Der er ikke tilføjet routing eller nye appfunktioner i fase 2B.

Genrevejledningen kontrolleres mod appens `GENRES` og `normalizeGenre`: Nyheder og Erhverv bliver Samfund, Fodbold bliver Sport, Forskning bliver Viden, og Snakke/Kærlighed bliver Underholdning. Ranglisten sammenligner disse normaliserede genrer. Regressionstesten afviser både filtre, der ikke findes, og eksisterende filtre, som ikke inkluderer afsnittets konkrete katalogpodcasts. Ved fremtidige ændringer skal en genre uden et passende verificeret filter i stedet have en vejledning til appens eksisterende søgning/Udforsk; der må ikke opfindes et filter eller en genreparameter.
