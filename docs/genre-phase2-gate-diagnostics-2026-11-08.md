# Genre phase 2 gate timing diagnostics (2026-11-08)

## Finding

The failing assertion was the **per-viewport** check at `scripts/test-genre-phase2.mjs:285`, with one full-gate sample at 320 px measuring 308.4 ms against the existing 300 ms budget. A separate direct run failed the cold-search check at line 254 at 303.8 ms; its four warm samples were 13.2–16 ms. The stable match count was 10 of 1,321 catalogue candidates.

The Frihedsbrevet commit changes no search code or benchmark code: `app.js` and `scripts/test-genre-phase2.mjs` are byte-identical to `origin/main` at `10f868001471736fe5be0b6227c273331d2f5f3d`. The measurements therefore use the same implementation as main. The reported PR #509 measurements were 141.4/147.1 ms on its runner.

## Local measurement series

| Run | Cold search at 320 px | Warm samples (ms) | Per-viewport search (320 / 375 / 390 / 1280 / 1440 px) | Result |
| ---: | ---: | --- | --- | --- |
| 1 | 201.4 ms | 10.5, 10.4, 10.2, 9.1 | 218.3, 28.5, 19.2, 20.3, 30.0 | Pass |
| 2 | 170.0 ms | 26.1, 25.0, 26.2, 10.9 | 140.5, 20.8, 9.8, 11.0, 10.1 | Pass |
| 3 | 94.4 ms | 6.3, 6.0, 5.3, 5.0 | 87.2, 7.9, 6.0, 9.4, 7.8 | Pass |
| 4 | **303.8 ms** | 14.3, 16.0, 14.0, 13.2 | Not reached | Fail, cold assertion |

Earlier full-gate runs passed, while the pre-push hook later measured 308.4 ms at 320 px in the per-viewport check. All successful runs preserved the same match count and assertions. This run-to-run spread, with unchanged source code, indicates a timing-sensitive benchmark on this host rather than a Frihedsbrevet-induced search regression.

## Host and measurement conditions

- Node.js `v24.22.1`; Playwright `1.62.1`; Chromium `151.0.7922.34`.
- Windows reported 8 logical processors, 1,800 MHz maximum clock, and 8,007 MiB visible memory.
- Available memory was sampled at 858 MiB before diagnostics and 1,661 MiB after the failed cold run. WMI CPU load samples during the diagnostic period were 90%, then 59%, and 26% after the failed run. These are host-level readings, not process-attributed measurements.
- The host also had multiple Chrome and Codex processes active. No user applications were closed.

## Stabilization

The gate now runs this same browser-search suite before the other UI suites can accumulate Chromium work. The benchmark, viewports, assertions, and 300 ms limits are unchanged. This reduces test-suite-created contention without ignoring a slow observation. The full gate must pass with this order before commit or push; if it still fails, investigate the measured path further rather than relaxing the budget.
