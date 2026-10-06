import { readFile } from "node:fs/promises";

export const PRODUCTION_CATALOGUE_ALERT_TITLE = "Production catalogue health alert";

export function productionHealthExcerpt(log) {
  const relevant = String(log)
    .split(/\r?\n/u)
    .filter((line) =>
      /^(?:Error: )?CRITICAL PRODUCTION CATALOGUE HEALTH FAILURE\b/u.test(line) ||
      /^- (?:catalogue row count |blank Podcast-ID |duplicate Podcast-ID |podcast-display-groups\.json |production app\.js |https:\/\/podcastlisten\.dk\/)/u.test(line)
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
    core.error("Production catalogue health check FAILED. Production may show an empty or stale catalogue.");
    const log = await readLog().catch(() => "");
    const body = `## Production catalogue health check FAILED

The production catalogue could not be fetched or did not pass the minimum integrity checks after retries. Deployment/catalogue changes must not be treated as healthy until this alert recovers.

This check does **not** delete or modify ratings, profiles, authentication data, or other user data.

${metadata}

Relevant diagnostics:

~~~text
${productionHealthExcerpt(log)}
~~~`;

    if (alert) {
      await github.rest.issues.createComment({ ...context.repo, issue_number: alert.number, body });
    } else {
      await github.rest.issues.create({
        ...context.repo,
        title: PRODUCTION_CATALOGUE_ALERT_TITLE,
        body
      });
    }
    return;
  }

  if (alert) {
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
