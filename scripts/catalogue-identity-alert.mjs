import { readFile } from "node:fs/promises";

export const ALERT_TITLE = "Catalogue sync blocked: podcast identity integrity";

export function identityExcerpt(log, sensitiveValues = []) {
  // Publish only known gate diagnostics, never arbitrary stdout, stacks or env dumps.
  const relevant = String(log).split(/\r?\n/u).filter((line) =>
    /^(?:Error: )?CRITICAL PODCAST IDENTITY REGRESSION\b/u.test(line) ||
    /^- (?:blank Podcast-ID |duplicate Podcast-ID |stable Podcast-ID |rated key |catalogue count dropped )/u.test(line)
  );
  let excerpt = relevant.slice(-80).join("\n") || "No recognized identity diagnostic was captured. See the workflow run for details.";
  for (const value of sensitiveValues.filter(Boolean).sort((a, b) => b.length - a.length)) {
    excerpt = excerpt.split(value).join("[REDACTED]");
  }
  // Keep catalogue text inert in Markdown and stay below the GitHub body limit.
  return excerpt.replace(/`/gu, "'").replace(/@/gu, "＠").slice(-16000);
}

export async function updateIdentityAlert({ github, context, core, outcome,
  readLog = () => readFile(".identity-gate.log", "utf8"),
  now = () => new Date().toISOString(),
  sensitiveValues = [process.env.PODCAST_SUPABASE_URL, process.env.PODCAST_SUPABASE_ANON_KEY, process.env.GITHUB_TOKEN]
}) {
  if (!["failure", "success"].includes(outcome)) return;
  const runUrl = `${context.serverUrl || "https://github.com"}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const metadata = `Time (UTC): ${now()}\nWorkflow run: ${runUrl}\nCommit SHA: ${context.sha}`;
  let body;
  if (outcome === "failure") {
    core.error("Catalogue promotion BLOCKED: check Google Sheets Podcast-ID. The identity gate must pass before publishing.");
    await core.summary.addHeading("🚨 Catalogue promotion BLOCKED", 2)
      .addRaw("Check Google Sheets `Podcast-ID`: a missing or changed stable ID blocks publication.\n\n")
      .addLink("Failed workflow run", runUrl).write();
    const log = await readLog().catch(() => "");
    body = `## Catalogue promotion BLOCKED\n\nCheck Google Sheets \`Podcast-ID\` values, especially missing or changed stable IDs. Identity changes still require an explicit approved migration; do not bypass the gate.\n\n${metadata}\n\nRelevant identity diagnostics (last 80 matching lines, at most 16,000 characters):\n\n\`\`\`text\n${identityExcerpt(log, sensitiveValues)}\n\`\`\``;
  }

  // Paginate the issue API, not search: repeated runs must find even older alerts.
  // The workflow concurrency group serializes this read/create/update sequence.
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo, state: "open", per_page: 100
  });
  const alert = issues.find((issue) => !issue.pull_request && issue.title === ALERT_TITLE);
  if (outcome === "failure") {
    if (alert) {
      await github.rest.issues.createComment({ ...context.repo, issue_number: alert.number, body });
    } else {
      await github.rest.issues.create({ ...context.repo, title: ALERT_TITLE, body });
    }
  } else if (alert) {
    await github.rest.issues.createComment({ ...context.repo, issue_number: alert.number,
      body: `Catalogue identity gate recovered successfully in ${runUrl}.\n\n${metadata}\n\nThis resolves the identity block; subsequent catalogue checks still apply.` });
    await github.rest.issues.update({ ...context.repo, issue_number: alert.number, state: "closed", state_reason: "completed" });
  }
}
