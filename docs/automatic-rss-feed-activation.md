# Automatic activation for new RSS feeds

New ordinary RSS feeds may enter the existing 12-hour episode-import cadence
after the catalogue sync has independently verified the source. The verifier
does not use a title match as proof, and Sheet fields alone never enable a feed.

## Stored evidence

The trusted catalogue-sync workflow writes an `episodeFeedVerification` object
onto the matching row in `data/podcasts.json`. The existing Sheet-to-GitHub
catalogue PR flow publishes that row only after its normal identity checks and
required regression gate pass. The record pins the exact Podcast-ID,
`catalogue_id`, Feed URL, official Link and publisher, plus the channel title,
channel link, RSS self URL, channel owner, and count of unique episode GUIDs.
No episode payload or audio URL is stored in the verification record.

For a Podimo catalogue row, the Sheet Feed remains the exact Podimo show URL;
the RSS URL is discovered only from an exact Apple Podcasts search result and
confirmed again by Apple lookup for that collection ID. The Podimo canonical
page must contain the same show UUID, exact title and exact host set. The Apple
title and host set, RSS title, self URL, publisher and GUIDs must also agree.
Evidence records both the unchanged Podimo catalogue URL and the verified
public RSS URL, plus the Apple collection ID and Podimo show UUID. Ambiguous
Apple results, missing public RSS, non-Podimo publishers, reused URLs, or any
identity mismatch remain blocked. Search results are only candidates; an exact
single title/host match and direct lookup are required before activation.

At runtime the importer requires those values to match the current exact
catalogue row. It pins the verified channel values again against each fetched
RSS document, rejects repeated/missing GUIDs, and checks candidate GUIDs against
all existing episode source owners before writing. A missing preflight reader
or any identity collision fails the import before episode writes.

## Eligibility and limits

Only a new, unique canonical Podcast-ID with a unique existing catalogue ID is
eligible. The official show page must advertise the exact HTTPS RSS URL as its
RSS alternate, identify itself with the exact canonical URL and publisher, and
the RSS channel must agree on title, official Link, self URL and publisher.
Every checked item needs a unique GUID, publication date, audio enclosure and
duration of at least 60 seconds. Teasers, trailers, previews, non-audio items,
and feeds above 500 items remain review-required.

The Podimo public-RSS path permits an explicitly typed or clearly titled
trailer when it has its own GUID, publication date and audio enclosure. Such an
item is imported as inactive with `rateable: false`; the feed must still have
at least one full episode. Trailer status never makes a short item a full,
rateable episode.

The sync checks at most 20 new candidates in one existing catalogue-sync run.
Ordinary RSS uses the existing two bounded HTTPS requests; Podimo public RSS
uses four (canonical page, Apple search, direct Apple lookup and RSS). Each has
a 7-second timeout and 512 KiB response limit. It rejects non-public DNS
answers, IP-literal/private-network URLs and redirects. No new job or import
frequency is added. During automatic imports, only the latest 50 episodes are
considered; later imports keep the same rolling window and existing GUID
upsert behavior.

The RSS dry run and importer share an identity preflight. It checks candidate
GUID owners, the exact podcast's existing episode identities, rating locks,
manual episode mappings and duplicate active feed/source ownership before
episode writes. These are indexed, exact-key reads. A conflicting historical
source or manual identity blocks the import; prior UUIDs and ratings remain in
place, and a repeated import with the same GUIDs is idempotent.

## Changes and special adapters

Evidence is reusable only while Podcast-ID, catalogue ID, Feed URL, official
Link, title and publisher remain exact. A changed Feed URL for an existing ID
is never automatically adopted: the previous code-owned source remains active
and the proposed move is reported for review. A Feed URL already owned in the
published catalogue cannot be claimed by another Podcast-ID. Transient DNS,
timeout and HTTP 5xx failures are retried after 24 hours; identity mismatch,
unsafe URL, redirect, oversize response, duplicate GUID and special-provider
findings require source review.

Private or exclusive Podimo shows, Apple HTML-only feeds, DR feeds (including
umbrella feeds), and configured special adapters stay on their existing
provider-specific rules. Only a Podimo show with the independently verified
public Apple-to-RSS mapping can use this path. No paid audio URL is inferred.

The existing daily coverage workflow (#288) also rechecks up to 20 active
automatically verified feeds in a rotating batch. It records live mismatches in
the same deduplicated issue with the exact source, feed URL, blocking reason,
and required action. More than 20 active feeds are covered by later daily runs.
The live check uses the existing workflow and performs no Supabase reads or
writes. Verification outcomes for new feeds are versioned with the public
catalogue row, so a moved URL or changed catalogue identity cannot reuse stale
evidence. Existing approved RSS sources, episode UUIDs, ratings, aliases,
manual mappings and history are untouched.
