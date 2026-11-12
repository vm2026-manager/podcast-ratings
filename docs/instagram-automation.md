# Instagram automatik via Buffer

Workflowet `.github/workflows/instagram-automation.yml` starter altid i `dry-run`. Manuel kørsel tilbyder `dry-run`, `draft` og `queue`. Queue kræver både repository variable `BUFFER_QUEUE_ENABLED=true` og den præcise værdi `I_ACKNOWLEDGE_THIS_WILL_SCHEDULE_A_PUBLIC_POST` i bekræftelsesfeltet. Den daglige tidsplan kl. 08:00 UTC er inert, indtil `INSTAGRAM_DAILY_ENABLED=true`; planlagte queue-opslag kræver desuden `BUFFER_QUEUE_ENABLED=true` og `BUFFER_SCHEDULE_ACK` med den samme bekræftelse.

Før et cover kan vælges, skal en ansvarlig tilføje en rettighedsregistrering i `config/instagram-cover-rights.json` med felterne `podcastId`, `status: "approved"`, `coverChecksum`, `evidenceUrl`, `approvedBy` og `approvedAt`. `podcastId` skal svare eksakt til katalogets `Podcast-ID`; `coverChecksum` skal være hash fra 800 px-varianten i covermanifestet. Evidence-URL'en skal dokumentere rettigheden til at genbruge billedet på Instagram. Ingen godkendelser er forudfyldt.

Dublet- og gentagelseshistorik gemmes i en GitHub Actions cache under `.instagram/`, ikke i en daglig commit eller database. Workflowet serialiseres med GitHub Actions concurrency. Buffer-opslag scannes også med cursorbaseret paginering, og historik fra posts genkendes via Podcastlistens kanoniske profil-URL. Hvis historik mangler eller er ugyldig under tidsplanen, stopper workflowet.

Buffer kræver et offentligt HTTPS-billede, som fortsat er tilgængeligt, når opslaget publiceres. Workflowet kontrollerer billedets offentlige URL umiddelbart før enhver Buffer-mutation.

Den separate, manuelle `.github/workflows/instagram-smoke-draft.yml` tester alene Buffer-forbindelsen med én fast Podcast-ID og den førsteparts testgrafik i `assets/instagram/smoke-test.png`. Den bruger en commit-SHA-låst GitHub raw-URL, fast testmarkør og `saveToDraft: true`; den har ingen schedule, queue-tilstand eller kobling til den normale selector. Kørsel kontrollerer eksisterende Buffer-opslag før mutation og læser derefter status tilbage. En genkørsel finder den samme markør og opretter ikke en ny kladde.

## Redaktionel 15-opslagsplan

`.github/workflows/instagram-editorial-plan.yml` er en særskilt manuel, read-only planbygger. Den læser kun den entydige Buffer-kanals eksisterende opslag og den eksisterende Instagram-historikcache; den har ingen create/update-mutation, queue eller schedule. Resultatet er et 30-dages GitHub Actions-artifact med JSON til individuel godkendelse, CSV til gennemgang og korte takes samt en README. Datoerne foreslås mandag, onsdag og fredag over fem uger; de sendes ikke til Buffer.

Udvælgelsen læser alene katalogmasterens `Vuring (1-10)` og `Undervurderet perle`. Scorer fra 7,0 er med; en eksakt `x` i perlefeltet giver også adgang under 7,0. `Uaktuel`, dublerede/manglende Podcast-ID'er, uafklarede katalogposter, manglende eksakt covermanifestmatch, forældede Buffer-opslag og allerede publicerede opslag udelukkes. `featured-reviews.json` er ikke et generelt krav og bruges aldrig til at opfinde ejerens take.

Planens ownerTake-felt starter tomt. Caption og mention-/linkfelter er forslag, ikke publiceringsklar tekst. Ejerens take, første fulde episode-/serielink, publisherhandles, coverrettighed, manuel coverplacering, outputbillede og caption skal godkendes pr. Podcast-ID. Captionhash og kildechecksum bindes til godkendelsen; ændring gør den ugyldig. CSV-felterne kan importeres uden at tildele godkendelse med `node scripts/instagram-editorial-plan.mjs --apply-csv <plan.json> <review.csv> <output-plan.json>`. Derefter bruges `node scripts/instagram-editorial-plan.mjs --validate <output-plan.json>`.

`scripts/instagram_opskaler_cover.py` er en lokal, deterministisk LANCZOS-arbejdskopi; den genererer eller fortolker ikke billedmotivet. Den ændrer ikke kildefilen, beskærer eller farvebehandler ikke coveret og tilføjer kun godkendte tekstlinjer. Den kræver dokumenteret rettighedsmatch på covermanifestets 800 px-checksum samt manuel placering bundet til eksakt Podcast-ID og originalchecksum. Den uploader eller publicerer ikke. Rettighedslisten er tom på main, så billedgenerering er aktuelt blokeret; der faldes ikke tilbage til genrekort.
