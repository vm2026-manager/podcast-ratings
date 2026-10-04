import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ALERT_TITLE, identityExcerpt, updateIdentityAlert } from "./catalogue-identity-alert.mjs";

const workflow = (await readFile(new URL("../.github/workflows/sync-sheet-data.yml", import.meta.url), "utf8"))
  .replace(/\r\n?/gu, "\n");
const step = (name) => {
  const text = workflow.split(`      - name: ${name}\n`)[1];
  assert.ok(text, `missing step: ${name}`);
  return text.split("      - name: ")[0];
};
const gate = step("Hard podcast identity integrity gate");
assert.match(workflow, /permissions:\n(?:  [^\n]+\n)*  issues: write/u);
assert.match(workflow, /group: sync-podcast-sheet-data\n  cancel-in-progress: false/u);
assert.match(gate, /id: identity-gate/u);
assert.match(gate, /shell: bash/u);
assert.match(gate, /set -o pipefail\n\s+node scripts\/podcast-identity-integrity.mjs --before data\/podcasts.json --candidate .sync-stage\/data\/podcasts.json --migrations data\/podcast-id-migrations.json 2>&1 \| tee .identity-gate.log/u);
assert.doesNotMatch(gate, /continue-on-error|\|\| true|set \+e|exit 0/u);
assert.match(step("Alert on blocked catalogue identity"), /if: failure\(\) && steps.identity-gate.outcome == 'failure'/u);
assert.match(step("Alert on blocked catalogue identity"), /outcome: "failure"/u);
assert.match(step("Resolve catalogue identity alert"), /if: success\(\) && steps.identity-gate.outcome == 'success'/u);
assert.match(step("Resolve catalogue identity alert"), /outcome: "success"/u);
const promote = step("Promote validated staged JSON");
assert.doesNotMatch(promote, /if:|continue-on-error/u, "promotion must retain default success-only execution");
assert.ok(workflow.indexOf("Hard podcast identity integrity gate") < workflow.indexOf("Alert on blocked catalogue identity"));
assert.ok(workflow.indexOf("Resolve catalogue identity alert") < workflow.indexOf("Promote validated staged JSON"));

const context = { repo: { owner: "owner", repo: "repo" }, serverUrl: "https://github.com", runId: 42, sha: "abc123" };
const log = 'noise TOKEN=private-value\nError: CRITICAL PODCAST IDENTITY REGRESSION\n- blank Podcast-ID for "Har du hørt?"\n- stable Podcast-ID "har du hørt" disappeared; candidate: matching candidate has blank Podcast-ID\n    at ignored stack';
const calls = [];
let issues = [
  { number: 1, title: `${ALERT_TITLE} unrelated` },
  { number: 2, title: ALERT_TITLE, pull_request: {} }
];
const summary = { addHeading() { return this; }, addRaw() { return this; }, addLink() { return this; },
  async write() { calls.push(["summary"]); } };
const api = {
  listForRepo() {},
  async create(args) { calls.push(["create", args]); issues.push({ number: 3, title: args.title }); },
  async createComment(args) { calls.push(["comment", args]); },
  async update(args) { calls.push(["update", args]); issues = issues.filter((issue) => issue.number !== args.issue_number); }
};
const github = { rest: { issues: api }, async paginate(endpoint, args) {
  assert.equal(endpoint, api.listForRepo);
  assert.equal(args.state, "open");
  assert.equal(args.per_page, 100);
  return issues;
} };
const options = { github, context, core: { summary, error(message) { calls.push(["error", message]); } },
  readLog: async () => log, now: () => "2026-10-04T10:00:00.000Z", sensitiveValues: ["private-value"] };
await updateIdentityAlert({ ...options, outcome: "failure" });
assert.deepEqual(calls.map(([name]) => name), ["error", "summary", "create"]);
const body = calls.at(-1)[1].body;
for (const required of ["Catalogue promotion BLOCKED", "Google Sheets", "Podcast-ID", "2026-10-04T10:00:00.000Z", "/actions/runs/42", "abc123", "Har du hørt?", "har du hørt"]) assert.ok(body.includes(required), required);
assert.doesNotMatch(body, /private-value|ignored stack/u);
calls.length = 0;
await updateIdentityAlert({ ...options, outcome: "failure" });
assert.deepEqual(calls.map(([name]) => name), ["error", "summary", "comment"]);
assert.equal(calls.at(-1)[1].issue_number, 3);
calls.length = 0;
await updateIdentityAlert({ ...options, outcome: "success", readLog: () => { throw new Error("must not read log on recovery"); } });
assert.deepEqual(calls.map(([name]) => name), ["comment", "update"]);
assert.match(calls[0][1].body, /Catalogue identity gate recovered successfully in https:\/\/github.com\/owner\/repo\/actions\/runs\/42/u);
assert.deepEqual(calls[1][1], { ...context.repo, issue_number: 3, state: "closed", state_reason: "completed" });
assert.equal(issues.length, 2, "unrelated issues and pull requests remain untouched");
calls.length = 0;
for (const outcome of ["success", "skipped", "cancelled"]) await updateIdentityAlert({ ...options, outcome });
assert.equal(calls.length, 0, "no issue means recovery is a no-op; skipped/cancelled never resolve alerts");
await updateIdentityAlert({ ...options, outcome: "failure", readLog: async () => { throw new Error("missing log"); } });
assert.match(calls.at(-1)[1].body, /No recognized identity diagnostic/u);

assert.equal(identityExcerpt(Array.from({ length: 120 }, (_, i) => `- blank Podcast-ID for "row ${i}"`).join("\n")).split("\n").length, 80);
assert.ok(identityExcerpt(`- blank Podcast-ID ${"x".repeat(20000)}`).length <= 16000);
assert.equal(identityExcerpt('- blank Podcast-ID secret ``` @someone', ["secret"]), "- blank Podcast-ID [REDACTED] ''' ＠someone");
assert.doesNotMatch(identityExcerpt("arbitrary environment=value"), /environment=value/u);

// A failed comment must not close the alert; API errors must remain visible.
calls.length = 0;
const failingGithub = { ...github, rest: { issues: { ...api, async createComment() { throw new Error("API unavailable"); } } } };
await assert.rejects(updateIdentityAlert({ ...options, github: failingGithub, outcome: "success" }), /API unavailable/u);
assert.equal(calls.length, 0);
console.log("Catalogue identity alert workflow and lifecycle tests passed");
