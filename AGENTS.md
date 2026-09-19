# Repository instructions

Before every commit or push, run:

```sh
node scripts/critical-regression-gate.mjs
```

If the gate fails, stop. Do not commit or push until the failing regression is understood and resolved.

For episode and rating work, preserve canonical podcast keys, exact episode IDs, historical source provenance, and legacy aliases. Never resolve rating or identity problems by deleting, rewriting, recreating, migrating, or otherwise changing production rating or episode data unless the user explicitly authorizes that production-data operation.

Enable the version-controlled local pre-push hook once per clone with:

```sh
node scripts/setup-git-hooks.mjs
```
