# Ranglistesøgning

Ranglistesøgningen matcher alle søgeord på den samme podcast, også når ordene står i forskellige titel-, værts-, hovedserie-, genre-, udgiver- eller emnefelter, og rækkefølgen er fri. Et søgeord på mindst fire tegn kan også matche begyndelsen af et metadataord. Præfikser matcher kun fra ordets start; korte ord, stopord, tal og romertal åbner ikke for præfiksmatch. Det begrænser tilfældige sammenfald som korte bogstavstumper på tværs af metadata.

Søgningen beholder danske normaliseringsvarianter, translitterering, kompakte sammenhængende match og kuraterede synonymer. Den har også stavefejlstolerance på én indsættelse, sletning, substitution eller ombytning. Stavefejlstolerance undersøger kun titler og emner; alle ord skal passe i samme titel eller samme emne, og højst ét søgeord må være upræcist. Ord kortere end syv tegn, almindelige stopord og korte tal/romertal bruges ikke til fuzzy matches.

Synonymerne ligger i `RANKING_SEARCH_SYNONYM_GROUPS` i `app.js`. Grupperne repræsenterer samme begreb, fx `WWII` / `2. verdenskrig`, `AI` / `kunstig intelligens`, `klimaforandringer` / `klimaændringer` og `fodbold` / `soccer`. Beslægtede, men forskellige begreber som økonomi/finans, mord/drab og første/anden verdenskrig er bevidst adskilt. Tilføj kun nye aliaser efter kontrol af, at de er udskiftelige i ranglistens søgefelter.

Hvert katalogobjekts søgefelter og præfikstokens forberedes én gang i en `WeakMap`, forespørgsler gemmes i en lille afgrænset cache, og de filtrerede resultater bruger ranglistens eksisterende cache. Ydelsesbudgettet er under 300 ms for én fuld gennemgang af kataloget ved en mobil viewport. Regressionstesten måler hele kataloget ved 320, 375, 390, 768, 1280 og 1440 px med Chromium. Viewporttesten emulerer skærmstørrelse, ikke en langsommere mobil-CPU; budgettet giver plads til variation. Der foretages ingen serverkald.

Den avancerede matchfunktion bruges af ranglisten og desktop-/mobilforslag. `matchesPodcastTopicSearch` og `getExploreSearchParts` forbliver uændrede, så Udforsk beholder sin eksisterende identitets- og emnematchning uden fuzzy værtsidentitet eller nye forbindelser mellem podcasts.
