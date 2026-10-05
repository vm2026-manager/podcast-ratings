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

## Workflow

Install Python 3 with `Pillow==12.2.0` and Node.js. Run `python scripts/intake_manual_podcast_covers.py` to validate/report without writes. After explicit identity and artwork review, add a registry record containing the exact source path, SHA256, canonical ID, stable asset key, expected title/publisher/image URL, VERIFIED verdict and evidence. Never infer a record from its filename. Local canonical additions and explicit historical suppression are read from app.js without changing them.

Run `python scripts/intake_manual_podcast_covers.py --apply` on a dedicated branch, or `./scripts/publish-manual-podcast-covers.ps1 -Prepare`. The historical publisher now audits by default and never commits, pushes, merges or publishes. Review changes and open a PR.

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
