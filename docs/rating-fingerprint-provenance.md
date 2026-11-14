# Historical rating fingerprint provenance

## Status as of 14 November 2026

The incident record refers to two earlier rating fingerprints by the prefixes
`f0c25e…` and `58c5b2…`. Their full values, hashing algorithm, selected fields,
canonical ordering/serialization, and the exact historical input snapshot are
not present in the preserved repository history or the local diagnostic
artifacts reviewed for issue #460. The original fingerprints are therefore
**not reproducible or independently verifiable** from the available evidence.

Do not infer a rating change from those values, and do not replace them
silently with hashes produced by a different method. No replacement historical
fingerprint is established by this note. Any future read-only baseline must
document its exact source, field selection, ordering, serialization, and hash
algorithm, and must be labeled as a new baseline rather than a reconstruction
of these historical values.
