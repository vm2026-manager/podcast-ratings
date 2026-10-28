# Joachim B. Olsen Sheet master follow-up

The published `Ark1` source currently places the five “Kapitel 1–5” Joachim B. Olsen episodes on Podcast-ID `superzoom`. The sync script contains a narrow, identity-based fallback so the generated catalogue routes them to `joachim b olsen` while that source remains incorrect.

The authoritative Google Sheet row still needs an owner edit: remove those five episode titles from `superzoom` and put them in that order on `joachim b olsen`. The fallback becomes a no-op after the Sheet is corrected and can then be removed in a later change.

No Supabase episode, mapping, rating, provenance, or history rows were changed for this correction. The five existing inactive `superzoom` episode UUIDs remain untouched.
