# Episode-feed production monitor and deferred read identity

Status: the Step 1 monitor is implemented as a bounded observer. The Step 2
database reader is a proposal only. No production grant, role, RLS policy,
GitHub secret, import, backfill, or database write has been applied.

## Current production controls

The existing daily `episode-feed-coverage.yml` job remains the only schedule
(06:37 UTC). It continues the offline catalogue-to-adapter audit, then compares
only exact Podcast-IDs whose catalogue Feed was added/changed/removed or whose
static adapter mapping changed. Runtime routing changes without exact ID scope
are reported as a review warning and do not trigger a broad query.

The production probe uses the existing project URL and anon key. It sends
PostgREST `HEAD` requests for one exact `podcast_key` and `is_active=true`, with
`Prefer: count=exact` and `Range: 0-0`. A second request, only when active
episodes exist, filters the same Podcast-ID by `imported_at >= observed_at`.
Responses contain count metadata only. The workflow caps each run at 10 IDs and
20 API requests; full response bodies, episode rows, and all-feed scans are not
used. Issue #256 stores the small pending state, deduplicated in one comment.
Resolved checks are retained for at most 36 hours to avoid schedule-lookback
re-alerts.

Observed production privileges were checked before implementation:

| Table | anon SELECT grant | anon SELECT RLS policy | Use |
| --- | --- | --- | --- |
| `podcast_episodes` | yes | yes, active rows only | exact-ID active count |
| `episode_import_runs` | no | no | inaccessible; no attempt is made |

An HTTP 200 is accepted only when `Content-Range` contains an exact count.
`*/0` is a legitimate empty count; missing/malformed count metadata is an API
error. HTTP 401/403 is authorization denied, absent URL/key is authorization
missing, and other HTTP/network failures are API errors. A zero active count is
reported separately from those conditions. Since anon RLS hides inactive rows,
the monitor explicitly reports inactive/teaser visibility as unknown; it never
infers “no stored episodes” or “only teasers” from an RLS-filtered zero.

Active rows with `imported_at >= observed_at` show a post-change episode was
observed, but do not prove the current Edge Function deployment or a successful
import-run record. Active rows without one are marked as pre-existing with
import unverified. A changed ID with zero active rows is given a 36-hour import
grace period, then remains an actionable zero-active-episode status. Feed
content is not fetched by this monitor, and it cannot classify upstream 404,
empty RSS, malformed XML, or importer database-select errors. Existing
adapter tests and issues #450–454 remain responsible for those concrete source
failures until protected importer status is available.

The episode count uses the existing
`podcast_episodes_active_published_at_idx (podcast_key, is_active, published_at
DESC)` index for the exact key and active filter. The timestamp predicate may be
a residual filter. No migration or index change is proposed. A previous
production EXPLAIN audit measured the 19-ID aggregate at 17.5 ms / 57 shared
buffer hits, while the all-326 scan was 351.7 ms / 14,464 hits and the 45-day
import-run window used temporary disk and 4.16 s. The all-feed and 45-day forms
are excluded from daily operation. Real HTTP queries return no row body; the
live check used one ID and verified 200 + exact `Content-Range`, while invalid
credentials returned 401.

## Deferred Step 2: least-privilege import status

This is a design requiring explicit owner authorization before any production
role, policy, credential, or GitHub-secret change.

Proposed interface:

1. Create a dedicated Supabase Auth machine identity with a single fixed user
   UUID, distinct from `anon`, normal application users, and service role. After
   owner approval, store its password only in a protected GitHub Actions
   environment secret, exchange it for a short-lived access JWT during the
   existing workflow, mask all tokens, and never echo credentials. Restrict the
   environment to this workflow, require reviewers, rotate the password on a
   90-day schedule, and revoke it immediately after suspected exposure. Use
   separate `PODCAST_EPISODE_MONITOR_EMAIL` and
   `PODCAST_EPISODE_MONITOR_PASSWORD` environment secrets. For rotation, set a
   new password in Supabase Auth, update the protected GitHub secret, run one
   approved workflow smoke check, confirm the old credential no longer works,
   and revoke outstanding sessions. Never place either value in the repository,
   workflow inputs, artifacts, or issue comments.
2. Do not grant `SELECT` on `episode_import_runs` to `anon`, `authenticated`, or
   `public`. Create a dedicated `episode_monitor_rpc_owner NOLOGIN NOBYPASSRLS`
   role; it must not own the table or any schema. Grant it only column-level
   `SELECT (podcast_key, started_at, status)` on `public.episode_import_runs`.
   Grant only the schema `USAGE` and narrowly required function access. Do not
   grant `BYPASSRLS`, `service_role`, table ownership, or broad schema access to
   this role or the Auth user.
3. Keep RLS enabled. Add one SELECT policy for
   `episode_monitor_rpc_owner` whose predicate is
   `auth.uid() = '<approved fixed monitor-user-uuid>'::uuid`; no policy is
   added for `anon` or general `authenticated` users. The exposed `public`
   schema contains only a minimal `SECURITY INVOKER` wrapper with an empty
   `search_path`, fully qualified names, and an exact fixed `auth.uid()` check.
   It validates 1–10 distinct, non-empty exact Podcast-IDs and an activation
   timestamp no older than 14 days. It invokes the implementation in a
   dedicated non-exposed `episode_monitor_private` schema. That function alone
   is `SECURITY DEFINER`, owned by `episode_monitor_rpc_owner`, with
   `SET search_path = ''`, `row_security = on`, fully qualified names, and its
   own exact fixed `auth.uid()` check. It performs index-driven latest-two-run
   lookups for consecutive-failure state and returns only aggregate fields:
   latest status/timestamp, last observed success/failure timestamps, capped
   consecutive-failure count, run count capped at two, and whether a run
   followed activation. It returns no exception text, feed URL, raw log, episode
   title/GUID, or table row. The private schema must not be in Supabase's
   exposed schemas. Revoke default `PUBLIC` execution on both exact function
   signatures; grant the wrapper to `authenticated`, and grant only the
   execution/schema access required for the wrapper to call the private
   function. The fixed identity check in the private function denies direct
   invocation by every other Auth identity even if its schema is accidentally
   exposed. The function role is not a table or schema owner and has
   `NOBYPASSRLS`, so the row policy remains active.
4. Add database-level negative tests proving anon, ordinary authenticated users, an unrelated
   Auth identity, malformed IDs, more than 10 IDs, out-of-window runs, direct
   table SELECT by anon/authenticated, other RPCs, and expired/revoked
   credentials are denied. Unknown exact IDs with no import run must return an
   explicit “no run observed” aggregate, not an authorization error; they must
   never broaden the query. Positive tests must confirm only aggregate columns
   and exact-ID results are returned. Verify `EXPLAIN (ANALYZE, BUFFERS)` under
   the real reader identity, with two-run-per-ID bounded lookups using the existing
   `episode_import_runs_podcast_key_started_at_idx`, no full-table scan, no
   temporary disk, and a fixed low daily query limit before activation.

The migration and credential setup are not production authorization. Apply
them only to an owner-designated isolated test database until explicit,
concrete approval is recorded for production role, RLS, Auth identity, and
GitHub environment changes. Never treat an inactive or unlabelled Supabase
project as a test environment. The monitor is not considered active until
positive and negative PostgREST tests, query plans, expiry/revocation tests,
and alarm/recovery checks pass in that isolated environment and again in
production following separate owner approval.

An unapplied draft is kept under `supabase/migration-plans/` rather than the
executable `supabase/migrations/` directory so a routine migration push cannot
apply it accidentally. Its identity UUID is a test sentinel: use a distinct
test Auth identity in an isolated environment, and replace it with the
specifically approved machine Auth UUID only for an approved production
application. The current workstation has no Docker/Podman
for local Supabase, and the inactive Supabase project has not been confirmed as
an isolated test target; therefore no database integration test, actual
`EXPLAIN (ANALYZE, BUFFERS)`, or query-budget measurement has been performed.
The accompanying Node test checks source-level security invariants only; it is
not evidence that PostgreSQL grants, RLS, Auth, or PostgREST behave correctly.

After authorization and security review, Step 2 can alert on two consecutive
failed imports, no import following adapter activation, no usable active
episodes, recovery, and identity collisions. Teaser-only/inactive posts and
Edge deploy status remain unknown until separate verified signals exist.
Deduplication belongs in #256 and adapter-routing review in #288;
the five feed-specific issues remain independent. #256 stays open until that
protected reader and post-merge recovery have been verified in production.
