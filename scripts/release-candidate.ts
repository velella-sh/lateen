// Verifies the commit a release will tag from a clean checkout: the working tree must have no
// changes, then a detached worktree of HEAD installs with `npm ci` and runs every release gate.
// The report names the commit and the exact package and engine versions, so the commit later tagged
// must be the one this run proved. No wall-clock time is recorded; two runs on one commit agree.
// Usage: node scripts/release-candidate.ts [--report <file>]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { commitOf, reportPath, root, schemaAt, versionOf, writeReport } from "./report.ts";

/** One release gate: the name it is reported under and the command a clean checkout runs. */
export interface Gate {
  readonly name: string;
  readonly command: string;
}

/**
 * Every gate the release candidate must pass, in the order it runs. `npm test` already includes the
 * design, token, and documentation checks; the last gate checks the built site against the theme.
 */
export const GATES: readonly Gate[] = [
  { name: "install", command: "npm ci --no-audit --no-fund" },
  { name: "browsers", command: "npx playwright install chromium" },
  { name: "typecheck", command: "npm run typecheck" },
  { name: "test", command: "npm test" },
  { name: "a11y", command: "npm run test:a11y" },
  { name: "performance", command: "npm run test:performance" },
  { name: "visual", command: "npm run test:visual" },
  { name: "acceptance", command: "npm run test:acceptance" },
  { name: "mizzen", command: "node node_modules/@velella/mizzen/bin/mizzen.js check site --theme ." },
];

export type GateStatus = "passed" | "failed";

export interface GateResult extends Gate {
  readonly status: GateStatus;
}

export interface CandidateReport {
  readonly tool: "lateen/release-candidate";
  readonly version: 1;
  readonly commit: string;
  readonly package: { readonly name: string; readonly version: string };
  readonly mizzen: string;
  readonly status: GateStatus;
  readonly gates: readonly GateResult[];
}

/** Every reason a working tree is not a clean release checkout, one line each. */
export function cleanProblems(porcelain: string): string[] {
  const lines = porcelain.split("\n").filter((line) => line.trim() !== "");
  return lines.map((line) => `the release candidate must be a clean checkout; found: ${line.trim()}`);
}

/** Every gate that did not pass, so a failed run names the command to fix. */
export function gateProblems(results: readonly GateResult[]): string[] {
  return results
    .filter((result) => result.status === "failed")
    .map((result) => `${result.name} failed: ${result.command}`);
}

function git(args: readonly string[], cwd = root): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function sh(command: string, cwd: string): GateStatus {
  try {
    execFileSync("sh", ["-c", command], { cwd, stdio: "inherit" });
    return "passed";
  } catch {
    return "failed";
  }
}

/** The installed engine in `dir`, after `npm ci` has run there. */
function mizzenVersion(dir: string): string {
  const file = join(dir, "node_modules/@velella/mizzen/package.json");
  return (JSON.parse(readFileSync(file, "utf8")) as { version: string }).version;
}

export function main(argv = process.argv.slice(2)): void {
  const problems = cleanProblems(git(["status", "--porcelain"]));
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
    return;
  }

  const commit = commitOf();
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name: string; version: string };
  const dir = mkdtempSync(join(tmpdir(), "lateen-release-"));
  // The worktree is detached at HEAD, so no local generated file reaches the run.
  git(["worktree", "add", "--detach", dir, commit]);

  const results: GateResult[] = [];
  let mizzen = "unknown";
  try {
    for (const gate of GATES) {
      console.log(`\nrelease candidate ${commit}: ${gate.name}`);
      const status = sh(gate.command, dir);
      results.push({ ...gate, status });
      if (gate.name === "install" && status === "passed") mizzen = mizzenVersion(dir);
      if (status === "failed") break;
    }
  } finally {
    git(["worktree", "remove", "--force", dir]);
  }

  const report: CandidateReport = {
    tool: "lateen/release-candidate",
    version: 1,
    commit,
    package: { name: pkg.name, version: pkg.version },
    mizzen,
    status: results.every((result) => result.status === "passed") ? "passed" : "failed",
    gates: results,
  };
  const file = reportPath(argv) ?? join(root, ".mizzen/release-candidate.json");
  writeReport(file, schemaAt("release-candidate.schema.json"), report);

  const failed = gateProblems(results);
  if (failed.length > 0) {
    console.error(failed.join("\n"));
    process.exitCode = 1;
  } else if (results.length !== GATES.length) {
    console.error("the release candidate stopped before every gate ran");
    process.exitCode = 1;
  } else {
    console.log(`release candidate ${commit} passed every gate`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
