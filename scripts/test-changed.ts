// Runs only the unit tests that point at the files you changed, for a fast loop while you work.
// It is not a gate: `npm test` and CI still run everything.
//
// Usage: node scripts/test-changed.ts [--base <ref>] [--list]
// A changed test file runs itself. A changed source file runs every test that mentions its path
// (a component folder, a script, a layout), found by reading the test files, plus the tests in the
// folder that mirrors a chrome unit (`test/chrome/<unit>/`) or a layout (`test/layouts/<layout>*.test.ts`). A change to shared
// inputs (styles, tokens, package files, fixtures) has no narrow answer and says to run `npm test`.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Paths whose change can move any test, so no narrow selection is honest. */
const SHARED = /^(styles\/|tokens\/|fixtures\/|package(-lock)?\.json$|tsconfig\.json$|\.node-version$|scripts\/(tokens|check-design)\.ts$)/;

function git(args: readonly string[]): string[] {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).split("\n").filter((line) => line !== "");
  } catch {
    return [];
  }
}

/** Files changed against the merge base with `base`, plus staged, unstaged and new files. */
export function changedFiles(base: string): string[] {
  const mergeBase = git(["merge-base", base, "HEAD"])[0] ?? base;
  const names = [
    ...git(["diff", "--name-only", `${mergeBase}...HEAD`]),
    ...git(["diff", "--name-only"]),
    ...git(["diff", "--name-only", "--cached"]),
    ...git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(names)].sort();
}

function testFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...testFiles(path));
    else if (entry.name.endsWith(".test.ts")) found.push(path);
  }
  return found;
}

/** The key a test file would use to name `file`: its component or layout folder, else the file without extension. */
export function keyOf(file: string): string {
  const folder = /^((?:components|chrome|layouts|recipes)\/[^/]+)\//.exec(file);
  return folder?.[1] ?? file.replace(/\.[^.]+$/, "");
}

/** Whether `test` sits in the folder that mirrors `key`: `test/chrome/<unit>/` or `test/layouts/<layout>[-part].test.ts`. */
export function mirrors(key: string, test: string): boolean {
  const [area, unit] = key.split("/");
  if (area === "chrome") return test.startsWith(`test/chrome/${unit}/`);
  if (area === "layouts") return test.startsWith(`test/layouts/${unit}.`) || test.startsWith(`test/layouts/${unit}-`);
  return false;
}

export interface Selection {
  readonly tests: string[];
  /** Changed files that no test mentions, or that move every test. */
  readonly unmatched: string[];
  readonly shared: boolean;
}

/** Chooses the tests for `changed`, reading each test file once. */
export function select(changed: readonly string[], tests: Readonly<Record<string, string>>): Selection {
  const chosen = new Set<string>();
  const unmatched: string[] = [];
  let shared = false;
  for (const file of changed) {
    if (/\.test\.ts$/.test(file) && file in tests) {
      chosen.add(file);
      continue;
    }
    if (SHARED.test(file)) {
      shared = true;
      continue;
    }
    if (!/\.(ts|tsx|json|css|md)$/.test(file) || /^(docs\/|changelog\.d\/|README|CHANGELOG|CONTRIBUTING|AGENTS)/.test(file)) continue;
    const key = keyOf(file);
    const hits = Object.entries(tests).filter(([name, text]) => name !== key && (text.includes(key) || mirrors(key, name)));
    if (hits.length === 0) unmatched.push(file);
    for (const [name] of hits) chosen.add(name);
  }
  return { tests: [...chosen].sort(), unmatched, shared };
}

function main(): number {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--base");
  const base = at === -1 ? "origin/main" : (argv[at + 1] ?? "origin/main");
  const changed = changedFiles(base);
  const texts: Record<string, string> = {};
  for (const path of testFiles(join(ROOT, "test"))) texts[relative(ROOT, path)] = readFileSync(path, "utf8");
  const picked = select(changed, texts);
  for (const file of picked.unmatched) console.log(`note: no test mentions ${file}`);
  if (picked.shared) console.log("note: a shared input changed (styles, tokens, fixtures or package files); run `npm test` before you push");
  if (picked.tests.length === 0) {
    console.log(`no test to run for ${changed.length} changed file(s) against ${base}`);
    return 0;
  }
  console.log(`running ${picked.tests.length} test file(s):\n${picked.tests.map((name) => `  ${name}`).join("\n")}`);
  if (argv.includes("--list")) return 0;
  const result = spawnSync(process.execPath, ["--test", ...picked.tests], { cwd: ROOT, stdio: "inherit" });
  return result.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main();
