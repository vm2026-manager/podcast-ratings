# Catalogue and frontend counts

The published catalogue row count and `state.podcasts.length` count different
things. The JSON contains stable catalogue identities; the app's current list
adds a small, reviewed set of local canonical Mediano series and omits exact
legacy episode identities when their canonical series is available.

For the 12 November 2026 audit, the input had 1,378 unique Podcast-IDs. The app
had five local canonical rows absent from that JSON and routed 27 exact legacy
episode IDs to existing canonical series, yielding:

```text
1,378 raw rows + 5 local canonical rows - 27 legacy episode rows = 1,356
```

Current `main` adds the verified local canonical Podcast-ID
`kampen om historien dr`, so the same catalogue now yields:

```text
1,378 raw rows + 6 local canonical rows - 27 legacy episode rows = 1,357
```

The 27 omitted IDs are explicit entries in
`MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS`; they are not removed from the source
JSON and are not re-keyed by title matching. The mapping targets are:

| Canonical Podcast-ID | Legacy episode Podcast-IDs |
| --- | --- |
| `magasinet jennings` | `ciao gianni`; `vm special om trump infantino indrejseproblemer og manden bag balogun breaking`; `vm optakt sadan lyder infantino bag facaden`; `sprængfarlig rapport om datagigant det gra marked i england og tryktest af christiansborg`; `infantinos mislykkede fredsforsøg dyrt vm og saudisk nedjustering`; `fodbold og samfund med wrexham st pauli athletic club vsk og aarhus fremad`; `eksklusivt interview med jesper møller om fifa og infantino`; `infantino foran genvalg iran overladt til sig selv og fifa i mystisk sponsorat`; `forudsigelsesmarkederne er kommet for at blive derfor skal det bekymre dig`; `jesper møller ved ikke om dbu vil stemme pa infantino det har vi ikke taget stilling til endnu`; `trumps krig sætter fifa i kattepine og european super league er død`; `her er scenariet alle frygter betting bag superliga og samtlige divisioner`; `vm boykot handboldchef har faet nok og city sag trækker i langdrag`; `infantino abner for russisk comeback dbu reagerer`; `landskabet for dansk børnefodbold med politiken og fc københavn`; `flere priser flere aftaler og flere penge op af fansenes lommer`; `fra johnny til donny fredspris fifa og forspil til vm 2026`; `whistlebloweren der afslørede qatar sadan snød vi verdenspressen` |
| `klub mediano` | `vi præsenterer erik skjærbæk`; `sadan blev han victor froholdt`; `den store talentserie` |
| `mediano special` | `mediano special hvad siger data om superligaen`; `sagen om de 15 point forsvandt fra i lommen af den gamle dame` |
| `der var engang et mal` | `der var engang et mal af peter møller mod farum` |
| `transfer special` | `her er vores bud pa de ti spillere har været de største transfersucceser i superligaen` |
| `bruchmann ringer til` | `kristjaan speakmann` |
| `troels bech i en samtale` | `landsholdets analytiker mounir akhiat` |

These exact legacy keys continue to resolve through `state.podcastByKey` to
their mapped canonical entry. The raw rows remain available to the
historical-episode builder, which appends reviewed episodes to canonical series.
Unknown aliases and aliases with a missing canonical target fail closed and
remain visible as ordinary catalogue identities.

Display groups are a separate presentation transform. The two active groups
contain 13 catalogue members (12 Narkobetjenten rows and one Kirsten ringer til
Rasmus row) and replace those rows with two ranking display groups, a net
reduction of 11 ranking cards. Their member Podcast-IDs remain in
`state.podcasts` and exact-ID lookups; group-season synthetic identities are
stored separately. This grouping does not explain the 1,378-to-1,356 runtime
count.

`balkans knuste hjerte` and `hvem er saveus` are ordinary, unsuppressed exact
Podcast-IDs. Both remain searchable and can be opened through the app's
`?podcast=<Podcast-ID>` deep link.
