# #89 – forslag til ændringer i Podcast ratings

Dette er et lokalt reviewforslag. Det skriver ikke til originalarket `Podcast ratings` / fanen `Ark1`.

## Eksisterende rækker

| Ark1-række | Kolonne | Forslag | Bevaring |
| --- | --- | --- | --- |
| 122 | G — Hovedserie | `Kampen om historien (DR)` | B-titel, D-score `7,7`, F-udgiver `DR` og V-ID `rwanda verdens hurtigste folkemord` forbliver uændret. |
| 439 | G — Hovedserie | `Kampen om historien (DR)` | B-titel, D-score `5,9`, F-udgiver `DR` og V-ID `sovjetunionen lenin og stalins danske agent` forbliver uændret. |
| 447 | B — Titel | `Styr på historien` | D-score `5,8`, F-udgiver `Podimo` og V-ID `kampen om historien` forbliver uændret. Ejerskab af den eksisterende redaktionelle score skal godkendes. |
| 447 | J — Link | `https://podimo.com/dk/shows/styr-pa-historien` | Officiel Podimo-showprofil. |
| 447 | L — Cover | `https://img.podimo.com/podcast/45d3a310-9003-4e38-a82f-39879927b5c7?h=400&s=fc1aRlkafgBcnHi58OugNDOdmQ0&w=400` | Officiel profil-cover; billedets UUID er ikke dokumentation for showets UUID. |
| 447 | M — Kort beskrivelse | `Adam Holm fortæller om historiske konflikter og begivenheder, der har formet den verden, vi lever i.` | Foreslået, parafraseret tekst baseret på Podimos showprofil; ejerens redaktionelle godkendelse afventes. |
| 447 | O — Lang beskrivelse | `I Styr på historien undersøger Adam Holm historiske konflikter og begivenheder og deres betydning for den verden, vi lever i i dag.` | Foreslået, parafraseret tekst baseret på Podimos showprofil; ejerens redaktionelle godkendelse afventes. |
| 447 | S — Feed | Forbliver tom | Podimo-showets UUID er ikke positivt verificeret. Ingen Podimo-import må aktiveres. |
| 447 | W — adgang | Forbliver `Betaling` | Matcher profilens “Kun på Podimo”-adgang. |
| 447 | X — kilde | `https://podimo.com/dk/shows/styr-pa-historien` | Registrér den primære profilkilde. |

Række 447 bør ikke få et nyt ID. Score `5,8` overføres ikke til en anden podcast og ændres ikke uden ejerens afgørelse af, om den oprindelige anmeldelse gælder Podimo-serien.

## Ny DR-hovedpodcast

Tilføj én ny, ikke-rangeret række ved næste ledige række i `Ark1`. Rækkenummeret skal fastlægges på en godkendt, staged kopi, så eksisterende rækker ikke forskydes.

| Kolonne | Foreslået værdi |
| --- | --- |
| B — Titel | `Kampen om historien` |
| D — Score | Tom |
| F — Udgiver | `DR` |
| G — Hovedserie | Tom |
| J — Link | `https://www.dr.dk/lyd/p1/kampen-om-historien-3166339029000` |
| L — Cover | `https://api.dr.dk/podcasts/v1/images/urn:dr:podcast:image:69b92600196d91f77288ecdc.jpg` |
| M — Kort beskrivelse | `DR’s historiske podcast om fortidens begivenheder og deres betydning.` |
| O — Lang beskrivelse | `Kampen om historien er DR’s historiske podcast om begivenheder, konflikter og personer, der har sat spor i historien.` |
| S — Feed | `https://api.dr.dk/podcasts/v1/feeds/kampen-om-historien-3.xml?format=podcast` |
| V — Podcast-ID | `kampen om historien dr` |
| W — adgang | `Gratis` |
| X — kilde | `https://www.dr.dk/lyd/p1/kampen-om-historien-3166339029000` |
| Y — kontrolleret | `2026-11-11` |

Feedet er læst og kanalidentiteten er `Kampen om historien`; importen forbliver deaktiveret, indtil destination og episodeidentiteter er godkendt. De to historiske anmeldelsesrækker knyttes til DR-hovedserien i katalogvisningen via deres eksisterende eksakte ID’er. Der oprettes ingen episode-ID’er, og vurderingerne forbliver på deres oprindelige rækker.

## Godkendelser før arket ændres

1. Redaktionel ejer godkender, at række 447 er Podimos `Styr på historien`, samt om scoren `5,8` og anmeldelsens redaktionelle betydning fortsat gælder den omdøbte post.
2. Redaktionel ejer godkender DR-seriens metadata og tilknytningen af rækker 122 og 439.
3. Podimo-showets identitet/UUID verificeres positivt, før S447 udfyldes, eller import aktiveres.
4. Ejer godkender de ovenstående celleændringer på staged forslag, før originalarket ændres.
