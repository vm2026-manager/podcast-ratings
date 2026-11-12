# Instagram automatik via Buffer

Workflowet `.github/workflows/instagram-automation.yml` starter altid i `dry-run`. Manuel kørsel tilbyder `dry-run`, `draft` og `queue`. Queue kræver både repository variable `BUFFER_QUEUE_ENABLED=true` og den præcise værdi `I_ACKNOWLEDGE_THIS_WILL_SCHEDULE_A_PUBLIC_POST` i bekræftelsesfeltet. Den daglige tidsplan kl. 08:00 UTC er inert, indtil `INSTAGRAM_DAILY_ENABLED=true`; planlagte queue-opslag kræver desuden `BUFFER_QUEUE_ENABLED=true` og `BUFFER_SCHEDULE_ACK` med den samme bekræftelse.

Før et cover kan vælges, skal en ansvarlig tilføje en rettighedsregistrering i `config/instagram-cover-rights.json` med felterne `podcastId`, `status: "approved"`, `coverChecksum`, `evidenceUrl`, `approvedBy` og `approvedAt`. `podcastId` skal svare eksakt til katalogets `Podcast-ID`; `coverChecksum` skal være hash fra 800 px-varianten i covermanifestet. Evidence-URL'en skal dokumentere rettigheden til at genbruge billedet på Instagram. Ingen godkendelser er forudfyldt.

Dublet- og gentagelseshistorik gemmes i en GitHub Actions cache under `.instagram/`, ikke i en daglig commit eller database. Workflowet serialiseres med GitHub Actions concurrency. Buffer-opslag scannes også med cursorbaseret paginering, og historik fra posts genkendes via Podcastlistens kanoniske profil-URL. Hvis historik mangler eller er ugyldig under tidsplanen, stopper workflowet.

Buffer kræver et offentligt HTTPS-billede, som fortsat er tilgængeligt, når opslaget publiceres. Workflowet kontrollerer billedets offentlige URL umiddelbart før enhver Buffer-mutation.
