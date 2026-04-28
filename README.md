# Podcast Ratings

En personlig, statisk rankingside til podcasts bygget med ren HTML, CSS og vanilla JavaScript. Projektet kan hostes direkte på GitHub Pages uden build-step.

## Filer

- `index.html` indeholder sidens struktur
- `style.css` indeholder design, layout og responsiv styling
- `app.js` håndterer dataindlæsning, søgning, filtrering og sortering
- `data/podcasts.json` indeholder podcastdata i samme struktur som dit Google Sheet

## Datastruktur

`data/podcasts.json` skal være et array af objekter med præcis disse felter:

```json
[
  {
    "Placering": "1",
    "Titel": "Eksempel-podcast",
    "Vært": "Navn på vært",
    "Vurdering (1-10)": "9,5",
    "Genre": "True Crime",
    "Udgiver": "Eksempel Medie",
    "Antal afsnit": "7",
    "Årstal afspillet": "2024-",
    "Link": "https://example.com"
  }
]
```

## Feltforklaring

- `Placering`: bruges som standardsortering på siden
- `Titel`: vises som hovedtitel og bruges i søgning
- `Vært`: vises under titlen og bruges i søgning
- `Vurdering (1-10)`: må gerne være skrevet med dansk komma, fx `9,5`
- `Genre`: bruges både til visning og filtrering
- `Udgiver`: bruges både til visning og filtrering
- `Antal afsnit`: kan være tal eller tekst, fx `20`, `Ugentlig`, `Månedligt`, `Fredage` eller `STOPPET`
- `Årstal afspillet`: kan være et årstal eller et interval, fx `2023` eller `2017-`
- `Link`: vises kun som knap, hvis feltet ikke er tomt

## Funktioner

- Standardvisning efter placering
- Sortering efter placering, vurdering, titel og årstal afspillet
- Filtrering på genre og udgiver
- Søgning på titel og vært
- Dansk brugerflade
- Pæn håndtering af tomme felter
- Korrekt numerisk sortering af vurderinger med dansk komma
- Klar til hosting på GitHub Pages

## Google Sheets til JSON

Hvis dine data starter i Google Sheets, skal kolonnenavnene matche disse felter præcist:

- `Placering`
- `Titel`
- `Vært`
- `Vurdering (1-10)`
- `Genre`
- `Udgiver`
- `Antal afsnit`
- `Årstal afspillet`
- `Link`

Når du eksporterer eller kopierer data over i `data/podcasts.json`, skal hver række fra arket blive til ét objekt i JSON-arrayet.

## Lokal brug

Åbn projektet i en simpel lokal webserver for at teste dataindlæsningen. Hvis du bare dobbeltklikker på `index.html`, kan nogle browsere blokere `fetch` af JSON-filen.

Et nemt eksempel med Python:

```bash
python -m http.server 8000
```

Besøg derefter `http://localhost:8000`.

## Udgivelse med GitHub Pages

1. Upload projektfilerne til dit GitHub-repository.
2. Sørg for, at `index.html` ligger i roden af repoet.
3. Gå til `Settings` i repositoryet.
4. Vælg `Pages`.
5. Under `Build and deployment` vælger du `Deploy from a branch`.
6. Vælg branch `main` og mappen `/ (root)`.
7. Klik `Save`.
8. Vent et øjeblik, og åbn den URL GitHub Pages viser.

Hvis dit repository hedder `podcast-ratings`, bliver adressen typisk:

```text
https://brugernavn.github.io/podcast-ratings/
```

## Tilpasning

Du kan løbende udskifte indholdet i `data/podcasts.json`, når du opdaterer dine ratings eller importerer nye rækker fra Google Sheets.


