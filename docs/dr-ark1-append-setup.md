# DR metadata append setup

The append workflow is part of the existing `Sync Podcastlisten catalogue` workflow. It runs after the normal catalogue sync, on protected `main`, and is serialized separately for both DR feeds. Discovery and the normal catalogue sync never write to Google Sheets.

## Default behavior

The writer is disabled until every gate is configured. It accepts only the exact editable spreadsheet ID already recorded in this script, the `Ark1` tab, the complete reviewed header schema, and the two source-verified DR records. It reads the sheet once, appends missing IDs as raw values, then reads back and checks identity. Existing rows are never sent in an update request. Ratings, review dates, playback years, manual episode lists, and other user-history fields are left blank in new rows.

The normal catalogue sync continues to prefer a sheet row when its exact Podcast-ID is present. This lets a later sheet edit replace generated metadata in the site catalogue without modifying the sheet row.

## Owner setup required before production writes

No production write is enabled by this code change. The owner must first:

1. Make and independently verify a restorable, versioned copy of the complete original spreadsheet, including every tab. The copy must not be accessible to the writer identity.
2. Confirm the approved write architecture. Sheets API Editor access is file-wide and cannot be technically restricted to append-only. The script enforces append-only, but a compromised workflow credential could still edit the file. The repository's earlier security review required a separate staging sheet and an owner-controlled append gate; do not grant Editor to the service account on the original unless the owner explicitly re-approves that risk.
3. Enable the Sheets API in a dedicated Google Cloud project; configure Workload Identity Federation with no JSON key and restrict provider conditions to `vm2026-manager/podcast-ratings`, protected `refs/heads/main`, and this exact workflow file. Allow only the service account to impersonate the federated identity.
4. If direct append access to the original is explicitly approved, share only that spreadsheet with the dedicated service account as Editor. Otherwise, use a staging spreadsheet plus an owner-controlled gate; the production target must then be changed and separately reviewed before activation.
5. Configure repository Actions variables `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` and `GOOGLE_SHEETS_SERVICE_ACCOUNT`. Configure Actions secrets `GOOGLE_SHEETS_SPREADSHEET_ID` (the editable ID, never the published CSV URL), `GOOGLE_SHEETS_WRITE_ENABLED=true`, and `GOOGLE_SHEETS_BACKUP_VERIFIED=true`. Keep both boolean secrets unset until steps 1–4 are complete.
6. Run the existing sync workflow once with the write gate closed and inspect its dry-run-only result. Then enable writes and verify the appended row in `Ark1`, rerun to confirm zero duplicates, edit a description in the sheet, and confirm the next catalogue sync publishes that edit.

The service account must not have project administrator roles, domain-wide delegation, a downloadable key, or access to any other Drive file. Access tokens are short-lived OIDC credentials and are not logged or stored as artifacts. Do not paste credentials into issues, chat, repository files, or workflow output.
