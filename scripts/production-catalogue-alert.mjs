import { readFile } from "node:fs/promises";
import { formatCatalogueHealthReport } from "./catalogue-health-report.mjs";

// Share the same open issue with the Sheet sync workflow so one stalled
// publication cannot fan out into separate, competing alerts.
export const PRODUCTION_CATALOGUE_ALERT_TITLE = "Catalogue sync blocked: unattended publication";
const HEALTH_SECTION_MARKER = "<!-- production-catalogue-health -->";

function mergeHealthSection(existingBody, healthBody) {
  const existing = String(existingBody || "");
  const markerIndex = existing.indexOf(HEALTH_SECTION_MARKER);
  const retained = markerIndex < 0 ? existing : existing.slice(0, markerIndex).trimEnd();
  return [retained, HEALTH_SECTION_MARKER, healthBody].filter(Boolean).join("\n\n");
}

export function productionHealthExcerpt(log) {
  const relevant = String(log)
    .split(/\r?\n/u)
    .filter((line) =>
      /^(?:Error: )?CRITICAL (?:PRODUCTION CATALOGUE HEALTH|CATALOGUE PIPELINE) FAILURE\b/u.test(line) ||
      /^- (?:catalogue row count |blank Podcast-ID |duplicate Podcast-ID |podcast-display-groups\.json |production app\.js |production data\/|Google Sheet changes |Changed Podcast-ID|The scheduled catalogue sync|No (?:scheduled )?catalogue sync run|Latest (?:scheduled |non-scheduled )?catalogue sync run|Catalogue PR #|https:\/\/podcastlisten\.dk\/)/u.test(line)
    );

  return (relevant.slice(-80).join("\n") || "No recognized production catalogue diagnostic was captured.")
    .split("`").join("'")
    .replace(/@/gu, "＠")
    .slice(-16000);
}

export async function updateProductionCatalogueAlert({
  github,
  context,
  core,
  outcome,
  checks,
  resolveIncident = false,
  readLog = () => readFile(".production-catalogue-health.log", "utf8"),
  now = () => new Date().toISOString()
}) {
  if (!["failure", "success"].includes(outcome)) return;

  const runUrl = `${context.serverUrl || "https://github.com"}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const metadata = `Time (UTC): ${now()}\nWorkflow run: ${runUrl}\nCommit SHA: ${context.sha}`;

  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo,
    state: "open",
    per_page: 100
  });
  const alert = issues.find(
    (issue) => !issue.pull_request && issue.title === PRODUCTION_CATALOGUE_ALERT_TITLE
  );

  if (outcome === "failure") {
    core.error("Catalogue health reported a failure; inspect the independent check results below.");
    const log = await readLog().catch(() => "");
    const checkReport = checks ? `${formatCatalogueHealthReport(checks)}\n\n` : "";
    const body = `## Catalogue health monitoring reported a failure

${checkReport}The workflow fails if a required check fails. A pipeline-freshness failure alone does not mean the production catalogue or Google Sheets comparison failed.

This check does **not** delete or modify ratings, profiles, authentication data, or other user data.

${metadata}

Relevant diagnostics:

~~~text
${productionHealthExcerpt(log)}
~~~`;

    if (alert) {
      await github.rest.issues.update({
        ...context.repo,
        issue_number: alert.number,
        body: mergeHealthSection(alert.body, body),
        assignees: [context.repo.owner]
      });
    } else {
      await github.rest.issues.create({
        ...context.repo,
        title: PRODUCTION_CATALOGUE_ALERT_TITLE,
        body,
        assignees: [context.repo.owner]
      });
    }
    return;
  }

  if (alert && resolveIncident === true) {
    await github.rest.issues.createComment({
      ...context.repo,
      issue_number: alert.number,
      body: `Production catalogue health recovered successfully in ${runUrl}.\n\n${metadata}`
    });
    await github.rest.issues.update({
      ...context.repo,
      issue_number: alert.number,
      state: "closed",
      state_reason: "completed"
    });
  }
}
