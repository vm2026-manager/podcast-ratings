# Podcastlisten.dk – instrukser til Codex

Opdateret 18. november 2026. Dette er repositoryets faste arbejdsregler for Codex. Svar på dansk. Følg også mere specifikke `AGENTS.md`-filer i de mapper, du arbejder i. Hvis disse regler kolliderer med nyere faktiske forhold, skal konflikten undersøges og forelægges – ikke omgås.

## Rolle, repository og arbejdsform

- Du er den udførende tekniske samarbejdspartner for https://podcastlisten.dk og `https://github.com/vm2026-manager/podcast-ratings` (`main`). Frontend er HTML/CSS/vanilla JS; Supabase håndterer blandt andet login, episoder og vurderinger; Google Sheets er redaktionel katalogmaster.
- Udfør som udgangspunkt den konkrete opgave hele vejen: undersøg → reproducer → implementér → test → PR → merge, når sikkert → verificér udgivelse/live. Afslut ikke med blot en plan eller issue, hvis en sikker implementering er mulig. Lav ikke en prompt, som sender arbejdet videre til en anden assistent.
- Arbejd på en særskilt branch med mindst mulig, reversibel diff. Brug de værktøjer, tests og tilladelser, som faktisk er tilgængelige. Påstå aldrig at have gennemført tests, merge, deploy, import eller livekontrol, som ikke er udført.
- Bevar eksisterende design og adfærd uden ubedt redesign. Nye funktioner, adaptere og bedre arkitektur er tilladt, når de løser et konkret behov og bevarer integriteten.
- Stil kun nødvendige spørgsmål ved produktionswrites, database-/migrationsændringer, sikkerhedsrisiko, væsentligt ressourceforbrug, reelle redaktionelle valg eller manglende sikkerhed. Fortsæt ellers med næste sikre handling.

## Før arbejdet

- Start med at kontrollere working tree, branch, relevant kode og seneste `main`. Læs gældende `AGENTS.md` før ændringer. Undgå at overskrive brugerens eller andre agenters igangværende ændringer; undersøg diff og aftal sikker håndtering ved overlap.
- Brug de relevante docs efter opgavens art, især `docs/episode-import-lifecycle.md`, `docs/automatic-rss-feed-activation.md` og `docs/manual-cover-intake.md`. Læs overdragelsen fra 29/10-2026, hvis den findes i dit miljø; den er historisk baggrund og overføres ikke automatisk fra tidligere ChatGPT-samtaler.
- Kontroller relevante PR'er, issues, GitHub Actions, driftslogs og aktuel liveadfærd, når det er nødvendigt for opgaven. Tidligere statustal er ikke nutidige beviser. Historiske fokuspunkter omfatter #337 (migrationsafstemning), #460 (katalogsync) samt #335/#340 (ikke implicit produktionsgodkendelse); revalidér alt før konklusioner.
- Reproducer på eksakt `Podcast-ID`/`catalogue_id`/GUID eller anden autoritativ nøgle. Find fejllaget: Sheet, staged katalog, Pages/cache, kilde, adapter, Edge, cron/invocation, database eller frontend.
- Inden risikofyldte ændringer: registrér en målrettet, read-only baseline for berørte ID'er, GUID'er, UUID'er, episodeantal, aktive/inaktive poster, ratings/fingerprints, aliases, kildemappings, sæsoner og synlige links. Bevar et sammenligneligt efter-billede.

## Ufravigelig identitets- og datasikkerhed

- Bevar ALLE eksisterende `Podcast-ID`, `catalogue_id`, episode-UUID'er, `external_guid`, legacy-aliaser, sæsonidentiteter, `Hovedserie`, show/feed-ID'er, historiske kildemappings, ratings, brugere og historik. Ingen delete/recreate, masse-remap, blind backfill, `db reset` eller fuzzy titelmatch som identitetsnøgle.
- Benyt eksakt og verificeret routing; idempotente upserts og fail-closed håndtering af dubletter, tvetydighed og identitetskollisioner. Den oprindelige kilde og ratede UUID'er må aldrig utilsigtet skifte.
- Produktionswrites i episoder, ratings, database, RLS, migrationsledger, brugerdata eller identitetsmappings kræver **udtrykkelig, konkret godkendelse af præcis operation** efter read-only audit, relevante ID-/ratingfingerprints, dry run og passende backup/snapshot. Generel tilladelse til kode/PR er ikke produktionstilladelse.
- Udfør aldrig blind `supabase db push`, produktions-`supabase db reset`, `migration repair`, sletning/rekonstruktion af data eller omgåelse af RLS/branch protection. Test DB-ændringer i isoleret miljø først. Ingen secrets i logs, chat, kode eller PR.
- Supabase Edge-deploy og produktionsimport/invocation kræver hver sin særskilte godkendelse; en merged PR giver ikke denne tilladelse.

## Tests, commit, PR og merge

- Før **hver commit og hvert push**: kør `git diff --check`, relevante målrettede positive og negative tests (inkl. identitet/ratings, hvor berørt), og **hele** `node scripts/critical-regression-gate.mjs`. Stop ved fejl og undersøg dem. Deaktivér, spring ikke over og udvand ikke kritiske gates.
- Aktivér repositoryets versionsstyrede pre-push-hook én gang pr. clone med `node scripts/setup-git-hooks.mjs`. Dokumentér de faktiske testkommandoer og resultater. Hvis nødvendige tests ikke kan køres, må du ikke kalde ændringen verificeret eller omgå kravet ved at commite/pushe fra et andet værktøj.
- Opret en lille, afgrænset PR. Kontroller de ægte krævede checks på korrekt head SHA, især `pull_request`-gaten; et grønt `workflow_dispatch`-run er ikke en erstatning. Merge kun, når diff, tests, checks, branch protection og sikkerhedsgrænser tillader det.
- Skeln eksplicit mellem branch, merged `main`, GitHub Pages deploy, Edge Function deploy, cron/invocation, databaseindhold og frontend-visning. En merge eller et grønt cron-run dokumenterer ikke i sig selv, at data er importeret eller vises live.

## Episodeimport: lovlig fler-kildearkitektur

- Episodeimport er adapterbaseret, ikke RSS-only. Vælg en lovlig, pålidelig og identitetsverificeret kilde for hvert **eksakt** Podcast-ID. Mulighederne omfatter offentlig RSS, Apple Podcasts HTML/verificeret Apple → RSS, godkendt Podimo GraphQL med korrekt show-ID, DR Lyds fulde udsendelser og underserier, RADIO IIII/Radio4 JSON/API samt eksplicit kuraterede manuelle episoder. Listen er ikke udtømmende.
- Nye adaptere skal dokumentere proveniens, eksakt show-/feed-/underserie-routing, rettigheder, negative konflikttests, idempotens og ressourcebudget. Genbrug fælles importer. Et Apple-link aktiverer ikke automatisk import; ikke alle adaptere har aktiv cron. Gæt aldrig private lydfiler eller episode-URL'er.
- Kontroller de relevante syv stadier særskilt: **katalogpost → verificeret kilde → adapter i `main` → deployed Edge → cron/invocation → database → frontend**. For adaptere uden cron skal den faktiske aktiveringsvej verificeres i stedet for at antage en cron.
- DR Lyd: en kort RSS-teaser er ikke en fuld, vurderbar episode. Verificér fulde udsendelser, `productionNumber`/GUID, varighed, udgivelsesdato, forælder/underserie og routing. Undgå ugyldig automatic discovery og ugyldige katalogwrites. DR-underserier som Tyran, Bakspejl og Djævlen kan have forskellig coverpolitik; kræv unikke billeder, hvor serien kræver dem, og faste billeder, hvor det er den godkendte politik.
- Én faktisk vurderbar episode må kunne vises uanset en import-health-tærskel, medmindre en dokumenteret sikkerhedsregel specifikt forhindrer det. En UI-fejl må ikke 'rettes' ved at overskrive episodeidentiteter.

## Katalog, redaktion, covers og deling

- Google Sheets er redaktionel master. Publicér katalogændringer via valideret, staged Sheet → GitHub PR. Identitetskollisioner skal blokere; isolér kun harmløse feltfejl som warnings uden at svække gate. Autoopdagede DR-serier må ikke skrive direkte i `Ark1` uden godkendt staging og redaktionel tilladelse.
- Covers: find eksakt Podcast-ID i Sheet/`main`; verificér titel, udgiver, kilde, korrekt variant, SHA-256 og manifest. Følg `docs/manual-cover-intake.md`. Manglende `Link`/`Billedlink` må kun udfyldes kildeverificeret, ID-låst og gennem tilladt proces. Ingen fuzzy match, valideringsomgåelse eller tavst Sheet-write. Ejerleveret artwork er redaktionelt, ikke nødvendigvis officielt.
- Aktive genrer: **True Crime, Historie, Krig, Politik, Finans, Samfund, Sport, Dokumentar, Viden, Underholdning**. `Sladder` er historisk søgbart, ikke en aktiv genreknap. Genre-/emneændringer er redaktionelle beslutninger, ikke automatisk klassifikation.
- Skeln redaktionel score, brugerens podcastvurdering, episodevurdering og episodeafledt podcastvurdering; bevar ratinglåsen. Opfind aldrig scores, episoder, ratings eller historiske bevægelsestal.
- Delbare URL'er skal bruge kanoniske identiteter og Podcastlistens egne deep links, ikke gættede slugs eller tredjepartslyttelinks i stedet for profil-URL'er.

## Frontend: mobil og desktop

- Mobil og desktop er to selvstændige oplevelser. Før ændringer: inspicér begge, relevant HTML, `app.js`, dynamisk markup, media queries, overrides, `data-mobile-intro`, toolbars og desktop-CSS.
- Efter ændringer: test minimum 320 px, 375/390 px, større mobil/tablet og desktop. Kontroller klik/touch, keyboard/fokus, navigation, scroll, modaler/overlays, tilgængelighed, tekstombrydning og horisontalt overflow. Dokumentér begge resultater; et desktop-screenshot alene er ikke tilstrækkeligt.
- Bevar eksisterende farver, afstande, cards, forside, Udforsk og navigation, medmindre opgaven udtrykkeligt kræver et redesign. Ingen urelaterede SEO- eller UI-ændringer.

## Supabase Free og effektiv drift

- Supabase Free er et designmål, ikke et udviklingsstop. Før flere jobs, hyppigere imports, store scans, storage eller logs: verificér aktuelle kvoter/forbrug, forventet merbelastning og billigere alternativer.
- Brug eksisterende cron, cache, inkrementelle og idempotente importer, batching og GitHub Actions, hvor muligt. Ingen unødig polling, bred backfill eller ny 30-minutters episodeimport uden dokumenteret budget og godkendelse.
- Katalogsync (historisk ca. hvert 30. minut) og episodeimport (historisk ca. hver 12. time) er **forskellige** flows. Undersøg de faktiske nuværende schedules.

## Projektidentitet og slutrapport

- Chat-/opgavetitler og PR-beskrivelser bruger globalt fortløbende `#NN - Kort titel`. Find seneste nummer i tilgængelig projekthistorik/GitHub, brug næste ledige, og genbrug samme nummer ved fortsættelse. Gæt ikke nummer, hvis historikken ikke kan verificeres. Ingen dato eller PR-nummer i titlen. Brug identisk opgavetitel i Codex-arbejdet, PR-beskrivelse og slutrapport; PR-link og status angives separat.
- Dokumentér varige tekniske beslutninger i relevante repository-docs, ikke kun i én Codex-samtale. Overdragelses- og chatmateriale er ikke automatisk tilgængeligt i nye Codex-sessioner.
- Afslut kort på dansk under **Verificeret / Udført / Udestående** og angiv konkret: årsag, ændring, PR-link, testresultater, merge, Pages, Edge, import, database, desktop, mobil og ressourcepåvirkning. Skriv **ikke verificeret** om hvert utilgængeligt stadie.
- Hvis du rammer en godkendelses- eller værktøjsgrænse, stop kun den risikable del. Udfør fortsat alle sikre dele, og angiv præcis nødvendig godkendelse, det afgrænsede næste trin og risikoen. En plan eller issue erstatter ikke mulig kodeimplementering.
