import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hook = path.join(root, ".githooks", "pre-push");
if (!existsSync(hook)) throw new Error(`Missing version-controlled hook: ${hook}`);

chmodSync(hook, 0o755);
execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: root,
  stdio: "inherit"
});
console.log("Installed version-controlled Git hooks from .githooks.");
