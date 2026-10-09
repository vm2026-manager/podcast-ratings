# SEO generator: phase 1 safety

`node scripts/generate-seo-podcast-pages.mjs` and `--dry-run` validate in memory
and never write files. `--write` explicitly enables publication of the existing
30 podcast pages and the existing True Crime page. Rendering, identities and
canonical routes are unchanged. Tests publish only into isolated temporary copies.

The reviewed baseline locks all 30 podcast identities/routes, the original 32
sitemap URLs, and minimum source counts (1,309 catalogue / 242 True Crime).
`scripts/seo-podcast-safety-state.json` records counts and sitemap URLs from the
last successful write. Counts cannot fall below either record, and remembered
sitemap URLs cannot disappear. A successful write raises the recorded counts
when the catalogue grows. Previously published True Crime identities must still
appear in the candidate genre page, even if the total count stays the same.

Invalid source schema, duplicate IDs or slugs, invalid IDs, missing titles or
descriptions, canonical conflicts, unsupported/malformed sitemap XML and symlink
targets stop publication. Missing source records never trigger deletion. Extra
manual pages, subdirectories and sitemap entries (including metadata) are kept.
The generator has no deletion or force/bypass option. Any proposed deletion or
lowering of the safety records requires a separate reviewed change and explicit
approval; do not use this generator to perform deletions.

On `--write`, every output and its backup is written to an isolated OS temporary
staging directory and validated before publication. An exclusive lock prevents
overlapping writers. Source and output snapshots are checked again before the
first production write. Each changed file is replaced using a temporary sibling
and atomic rename; unchanged files are not touched. A caught publication failure
restores already replaced files. No production directory is removed recursively.

Atomicity is per file, not across the whole site. A process kill or power loss can
leave a mixture of old and new complete pages, but cannot remove existing pages.
An interrupted write leaves its temporary lock/staging area for investigation;
the next write stops rather than overriding it. If rollback itself fails, the
error names the retained recovery directory. Restore from its backups and review
the cause before removing that specific temporary lock or retrying. Never delete
`podcast/` or `genre/true-crime/` as part of recovery.

Both SEO test suites run inside `node scripts/critical-regression-gate.mjs`.
The existing GitHub PR workflow runs that gate and checks that tests leave the
checkout unchanged. Run the full gate before every commit and push as required
by `AGENTS.md`; keep the repository's pre-push hook enabled.
