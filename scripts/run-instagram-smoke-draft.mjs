import { createBufferClient } from "./buffer-graphql.mjs";
import { runSmokeDraft, SMOKE_MODE } from "./instagram-smoke-draft.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.BUFFER_MODE !== SMOKE_MODE) throw new Error("Set BUFFER_MODE=smoke-draft only through the dedicated manual GitHub Actions workflow");
if (process.env.GITHUB_REF !== "refs/heads/main") throw new Error("Instagram smoke draft is allowed only from merged main");
if (!process.env.BUFFER_API_KEY) throw new Error("BUFFER_API_KEY is not available; no Buffer request was made");

const graphql = createBufferClient({ token: process.env.BUFFER_API_KEY });
await runSmokeDraft({ root, commitSha: process.env.GITHUB_SHA, graphql, mode: process.env.BUFFER_MODE });
