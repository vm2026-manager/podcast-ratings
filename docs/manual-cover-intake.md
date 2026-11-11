# Manual cover intake — investigation and verification

The publisher previously enumerated only manifest entries flagged as manual overrides. It did not inspect `manual-inbox`, so placing a file there could not register or publish it. The old local, untracked `process_manual_podcast_covers.py` used normalized filenames/title aliases and was not part of the tracked publication flow. It is deliberately not imported into this PR. The local publisher also differed from origin/main; all implementation work uses a clean branch from origin/main.

## Identity audit

`manual-cover-identity-audit.json` records all eight original inbox files, SHA256, candidate titles, canonical IDs, publisher, catalogue/stable keys, historical IDs, external images, local and main manifest entries, rating identities, verdicts and evidence. The audit was printed before changes. Magasinet Jennings was subsequently upgraded to VERIFIED after inspecting its existing main master: it is the same studio photograph with padding. That revised verdict was printed before registration.

Exact mappings (all paths begin `assets/podcast-covers/manual-inbox/`):

| Source | Existing canonical Podcast-ID |
| --- | --- |
| `mediano jennings.png` | `mediano sport og perspektiv` |
| `Magasinet Jennings.png` | `magasinet jennings` |
| `gift ved første blik podcast.png` | `gift ved forste blik podcasten` |

Sport & Perspektiv and Magasinet Jennings remain distinct. Jennings retains its existing manifest stable key `magasinet-jennings-manual-series`; this is a cover update, not a new podcast.

Unresolved sources remain in the original local inbox and were neither mapped nor copied into this PR:

- `Mediano Special.png`: AMBIGUOUS; generic Mediano image, identical to the Der var engang file.
- `Der var engang et mål.png`: AMBIGUOUS; generic branding cannot prove a programme identity.
- `Brüchmann ringer til.png`: AMBIGUOUS; unlabelled photograph without repository asset provenance.
- `Bandeland.png`: AMBIGUOUS; two season IDs and no season on the artwork; conflicting season link evidence.
- `amerikas kolde drom dr.png`: UNKNOWN; unlabelled illustration without verified asset provenance.

## Amerikas kolde drøm follow-up — 2026-10-04

The original unresolved verdict above is historical. The supplied identity review now verifies this source against the DR image URL. `amerikas kolde drom dr.png` is explicitly registered to the existing `amerikas kolde drom dr` ID with SHA256 `ee8b2d7766d78a0a41f853de77e24d8af6ba033d815aa63bcec003668a3aee0c`. Only this registration and its derived cover files are added; the other four unresolved files remain untouched. The current verdict is recorded in `manual-cover-identity-audit.json`.

## Der var engang et mål follow-up — 2026-11-03

The five official Mediano releases are verified as episodes of the series, but no identity-specific cover was verified. The existing `Der var engang et mål.png` remains AMBIGUOUS and is byte-identical to generic Mediano branding. The historical Google Sheets episode row `der var engang et mal af peter møller mod farum` uses the sponsor image `sparekassen-kronjylland.jpg`; that image is not series artwork and the row remains unchanged.

The official Andrés Iniesta article exposes this candidate image: `https://images.squarespace-cdn.com/content/v1/573c1b7d01dbae9b52cd0936/147b3387-8786-4f5d-b2dc-459a1ccf2ef0/476352274_1159571366171636_4833220818807679421_n.jpg` (525×350). Visual inspection shows a generic “Støt Mediano 2025” multi-programme promo, with no “Der var engang et mål” title or artwork. It is documented as a rejected candidate, not registered or published. Keep the existing generic fallback until Mediano supplies dedicated artwork or an identity-bearing official source is found.

## Owner-approved editorial cover — 2026-11-04

The owner supplied and approved `assets/podcast-covers/manual-inbox/der_var_engang_et_mal_editorial.png` for the exact canonical ID `der var engang et mal`. Its SHA-256 is `9807a7db699e0ba8b1b8b78ef27bd66d89a5d039711a9d3f7a352e387d960177`; it is a 1254×1254 PNG. Register this as Podcastlisten editorial artwork, explicitly not an official Mediano cover. The earlier `Der var engang et mål.png` remains ambiguous and untouched, as does the historic Peter episode's sponsor image and identity. The regular intake produces the same full-image contained 1400×1400 master and manifest variants; no creative alteration is permitted.

## Workflow

Install Python 3 with `Pillow==12.2.0` and Node.js. Run `python scripts/intake_manual_podcast_covers.py` to validate/report without writes. After explicit identity and artwork review, add a registry record containing the exact source path, SHA256, canonical ID, stable asset key, expected title/publisher/image URL, VERIFIED verdict and evidence. Never infer a record from its filename. Local canonical additions and explicit historical suppression are read from app.js without changing them.

Run `python scripts/intake_manual_podcast_covers.py --apply` on a dedicated branch, or `./scripts/publish-manual-podcast-covers.ps1 -Prepare`. The historical publisher now audits by default and never commits, pushes, merges or publishes. Review changes and open a PR.

Owner-approved editorial artwork may use `artworkKind: "OWNER_APPROVED_EDITORIAL"` with an empty `expectedImageUrl`. The registration still requires exact catalogue ID, title, publisher, verified owner approval and source checksum. In this explicit classification, the cover is independent of the current Sheet `Billedlink`, allowing a later complete Sheet image to take over as catalogue metadata while the manual cover manifest continues to identify the approved editorial asset. This classification does not apply to publisher-sourced artwork.

All mappings and image inputs are validated before any writes. Invalid registrations abort the whole batch. Unregistered files are listed and return exit 2; with `--apply`, verified files can still be prepared while unresolved sources remain untouched. The wrapper treats exit 2 as a visible failure requiring review. Unsupported files are also reported. Sources remain in the inbox so registry checks are reproducible.

Every source is processed separately with full-image containment, embedded sRGB and 1400x1400 PNG output. Output filenames use underscores and omit dimensions. Non-square art gets transparent padding; no crop, new text, composite or image generation. Existing encoded files are checksum-validated on repeat runs to avoid differences between encoder versions. Existing conflicting legacy manifest entries require explicit review rather than title-based replacement.

## Verification

- `python scripts/test_manual_cover_intake.py`: 19 tests PASS (duplicates, missing IDs, duplicate catalogue rows, title/ID conflicts, ambiguous and unknown files, checksums, traversal, output collision/corruption, image format, containment, dry-run, idempotency and all-input preflight).
- `node scripts/test-manual-cover-intake.mjs`: PASS; executes actual frontend cover and rating-key functions, verifies three exact-ID covers, distinct Jennings identities, unchanged rating keys/ratings and unrelated cover resolution.
- `node scripts/critical-regression-gate.mjs`: PASS, including cover identity/freshness, rating hydration, canonical and historical identity, ranking isolation and Explore checks.
- `node scripts/test-own-rating-ranking.mjs`: PASS.
- `node scripts/test-explore-clusters.mjs`: PASS.
- `node scripts/test-explore-cluster-ui-integration.mjs`: PASS.
- Full original eight-file inbox copied into an isolated dry-run fixture: three verified, all five unresolved reported, expected exit 2, no writes to original checkout.
- Three final PNGs visually inspected; artwork, Danish characters, logos and composition preserved.
- `git diff --check`: PASS.
- Extra `node scripts/test-community-ranking-load-safety.mjs`: existing FAIL at line 88 (`error` vs `ready`). Reproduced using only the unchanged base-commit app.js and test in a temporary directory. Left untouched as unrelated scope.

All existing manifest identity fields remain unchanged; 1,085 unrelated manifest entries remain semantically identical. Only Jennings cover fields and manifest aggregate cover counters changed, with two new cover entries referencing existing catalogue IDs. Git blob comparisons confirmed no changes to app.js, podcasts.json, podcast-id migrations, episodes, display groups, Explore clusters, recommendation metadata or similarity data. No Podcast-ID, rating key, rating data, title, alias, ranking, filter or Explore data/logic was modified. No database was accessed. The user's original dirty checkout and inbox were not modified.

## Exact files changed

- `.github/workflows/critical-regression-gate.yml`
- `assets/podcast-covers/manual-inbox/Magasinet Jennings.png`
- `assets/podcast-covers/manual-inbox/gift ved første blik podcast.png`
- `assets/podcast-covers/manual-inbox/mediano jennings.png`
- `assets/podcast-covers/manual-originals/gift_ved_forste_blik_podcasten_manual.png`
- `assets/podcast-covers/manual-originals/magasinet_jennings_manual_series.png`
- `assets/podcast-covers/manual-originals/mediano_sport_og_perspektiv_manual.png`
- `data/covers/1400/gift_ved_forste_blik_podcasten_manual.png`
- `data/covers/1400/magasinet_jennings_manual_series.png`
- `data/covers/1400/mediano_sport_og_perspektiv_manual.png`
- `data/covers/original/gift_ved_forste_blik_podcasten_manual.png`
- `data/covers/original/magasinet_jennings_manual_series.png`
- `data/covers/original/mediano_sport_og_perspektiv_manual.png`
- `data/manual-podcast-cover-registrations.json`
- `data/podcast-cover-manifest.json`
- `docs/manual-cover-identity-audit.json`
- `docs/manual-cover-intake.md`
- `scripts/critical-regression-gate.mjs`
- `scripts/intake_manual_podcast_covers.py`
- `scripts/manual-cover-catalogue.mjs`
- `scripts/publish-manual-podcast-covers.ps1`
- `scripts/test-manual-cover-intake.mjs`
- `scripts/test_manual_cover_intake.py`
