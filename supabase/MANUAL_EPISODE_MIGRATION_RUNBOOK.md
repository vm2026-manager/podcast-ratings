# Manual episode ratings deployment gate

Run this sequence manually and stop on any failed assertion or unexpected
conflict. The frontend is deliberately not the migration coordinator.

1. Apply `20260830105704_manual_catalogue_episode_canonicalization.sql`.
2. Verify its canonical postconditions: 1,027 exact manifest mappings, 15
   reviewed `manual_sheet` reuses, 1,012 `manual_catalogue_v1` canonical rows,
   and no unresolved or duplicate identities.
3. Apply `20260830105706_rescued_manual_episode_ratings_CORRECTED.sql`.
4. Verify all 21 rescued-rating outcomes. Preserve and investigate every
   `conflict_existing_server_rating`; never replace a server rating.
5. Only then deploy the frontend, including the `app.js` cache-buster.

Do not deploy the frontend before steps 1–4 have completed successfully.
