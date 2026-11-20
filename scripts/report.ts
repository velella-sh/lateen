// Shared plumbing for the two report files the gates write: the commit that identifies a run, the
// versions of the tools that ran, the `--report` argument, and writing the file only after it
// validates against its checked-in schema. No clock: the commit is the identity, so two runs on the
// same commit produce the same bytes.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate, type JsonSchema } from "../src/report-schema.ts";
import type { Identities } from "../test/acceptance/ledger.ts";

export const root = fileURLToPath(new URL("../", import.meta.url));

const require = createRequire(import.meta.url);

/** The commit a run is identified by: the CI variable first, then the checkout's `HEAD`. */
export function commitOf(): string {
  const fromEnv = process.env.LATEN_COMMIT ?? process.env.GITHUB_SHA;
  if (fromEnv !== undefined && /^[0-9a-f]{7,40}$/.test(fromEnv)) return fromEnv;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    throw new Error("the commit is unknown: run in a git checkout or set GITHUB_SHA");
  }
}

/** The installed version of a package, from its own `package.json`. */
export function versionOf(packageName: string): string {
  const file = join(dirname(require.resolve(`${packageName}/package.json`)), "package.json");
  return (JSON.parse(readFileSync(file, "utf8")) as { version: string }).version;
}

/** The exact runtime, declared engine and package identities of this checkout. */
export function identities(): Identities {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    name: string;
    version: string;
    engines: { node: string };
  };
  return {
    node: process.versions.node,
    npm: execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
    engines: { node: pkg.engines.node },
    package: { name: pkg.name, version: pkg.version },
  };
}

/** The `--report <file>` value, relative to the repository root; `undefined` when the flag is absent. */
export function reportPath(argv: readonly string[]): string | undefined {
  const index = argv.indexOf("--report");
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.trim() === "") throw new Error("--report needs a file path");
  return isAbsolute(value) ? value : join(root, value);
}

/** The checked-in schema for a report, so a script validates with the same file a test reads. */
export function schemaAt(name: string): JsonSchema {
  return JSON.parse(readFileSync(join(root, "schema", name), "utf8")) as JsonSchema;
}

/**
 * Writes `report` to `file` after checking it against `schema`. An invalid report fails the run and
 * leaves no file behind, so a deploy can never publish a report no test would accept.
 */
export function writeReport(file: string, schema: JsonSchema, report: unknown): void {
  const problems = validate(schema, report);
  if (problems.length > 0) throw new Error(`${file} does not satisfy its schema:\n- ${problems.join("\n- ")}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${file}`);
}
