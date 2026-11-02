# Ranglistesøgning

Ranglistesøgningen beholder de eksisterende kombinerede titel-, vært-, genre-, udgiver- og øvrige tekstmatches. Dertil kommer kuraterede synonymer og en stavefejlstolerance på én indsættelse, sletning, substitution eller ombytning. Stavefejlstolerance undersøger kun titler og emner; alle ord skal passe i samme titel eller samme emne, og højst ét søgeord må være upræcist. Ord kortere end syv tegn, almindelige stopord og korte tal/romertal bruges ikke til fuzzy matches.

Synonymerne ligger i `RANKING_SEARCH_SYNONYM_GROUPS` i `app.js`. Grupperne repræsenterer samme begreb, fx `WWII` / `2. verdenskrig`, `AI` / `kunstig intelligens`, `klimaforandringer` / `klimaændringer` og `fodbold` / `soccer`. Beslægtede, men forskellige begreber som økonomi/finans, mord/drab og første/anden verdenskrig er bevidst adskilt. Tilføj kun nye aliaser efter kontrol af, at de er udskiftelige i ranglistens søgefelter.

Hvert katalogobjekts titel- og emnetokens forberedes én gang i en `WeakMap`, forespørgsler gemmes i en lille afgrænset cache, og de filtrerede resultater bruger ranglistens eksisterende cache. Ydelsesbudgettet er under 300 ms for én fuld gennemgang af kataloget ved en mobil viewport. Regressionstesten måler alle 1.309 poster ved 320, 375 og 390 px samt 1280 og 1440 px med Chromium. Seneste kørsel målte 42,1 ms ved 320 px første gang og 4,5–6,5 ms ved de efterfølgende visningsbredder. Viewporttesten emulerer skærmstørrelse, ikke en langsommere mobil-CPU; budgettet giver plads til variation. Der foretages ingen serverkald.

Den avancerede matchfunktion bruges kun af ranglisten. `matchesPodcastTopicSearch` og `getExploreSearchParts` forbliver uændrede, så Udforsk og mobilforsidens søgeoverlay får ikke den bredere matchlogik.
