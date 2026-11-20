// Links a release's evidence into one ledger: the commit, the CI run, the acceptance and post-publish
// runs, the archived accessibility and performance reports, and the npm page. The packed and published
// tarball digests and the exact Mizzen version must agree; any missing or failed evidence keeps the
// ledger complete: false. No wall-clock time is recorded, so the same evidence writes the same file.
// Usage: node scripts/release-ledger.ts --version <x.y.z> --acceptance <file> --published <file>
//        --tarball <file.tgz> --a11y <file> --performance <file> [--run <url>] [--npm <url>]
//        [--out <file>]
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readIndex } from "./archive-reports.ts";
import { root, schemaAt, writeReport } from "./report.ts";

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const COMMIT = /^[0-9a-f]{7,40}$/;
const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export interface ReleaseLedger {
  readonly tool: "lateen/release-ledger";
  readonly version: 1;
  readonly release: {
    readonly version: string;
    readonly commit: string;
    readonly mizzen: string;
    readonly npm: string;
    readonly run: string;
  };
  readonly tarball: { readonly candidate: string; readonly published: string };
  readonly evidence: {
    readonly acceptance: string;
    readonly published: string;
    readonly accessibility: string;
    readonly performance: string;
  };
  readonly complete: boolean;
  readonly problems: readonly string[];
}

/** The evidence the ledger is built from: report files as text, digests as hex, and the archive entry. */
export interface LedgerInput {
  readonly version: string;
  readonly run: string;
  readonly npm: string;
  /** The candidate tarball's SHA-256, or an empty string when it could not be read. */
  readonly tarball: string;
  readonly acceptance?: string;
  readonly published?: string;
  /** The accessibility report file's SHA-256, or an empty string when it could not be read. */
  readonly accessibility?: string;
  readonly performance?: string;
  /** The hashes the archive index records for this version, when it has an entry. */
  readonly stored?: { readonly accessibility: string; readonly performance: string };
}

const sha256 = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

const stringOf = (value: unknown): string => (typeof value === "string" ? value : "");

function objectOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** One report file as an object, or a problem naming why it cannot be read. */
function reportOf(text: string | undefined, label: string, problems: string[]): Record<string, unknown> | undefined {
  if (text === undefined) {
    problems.push(`the ${label} report is missing`);
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    problems.push(`the ${label} report is not valid JSON: ${(error as Error).message}`);
    return undefined;
  }
  const report = objectOf(value);
  if (report === undefined) problems.push(`the ${label} report is not a JSON object`);
  return report;
}

function httpsProblem(value: string, name: string): string | undefined {
  if (value.trim() === "") return `${name} needs an https URL`;
  try {
    if (new URL(value).protocol !== "https:") return `${name} ${JSON.stringify(value)} is not an https URL`;
  } catch {
    return `${name} ${JSON.stringify(value)} is not an https URL`;
  }
  return undefined;
}

/** Every reason the evidence cannot be called a complete release, one line each. */
function problemsOf(input: LedgerInput): string[] {
  const problems: string[] = [];
  if (!VERSION.test(input.version)) problems.push(`the release version ${JSON.stringify(input.version)} is not semver without a leading v`);
  const run = httpsProblem(input.run, "--run");
  if (run !== undefined) problems.push(run);
  const npm = httpsProblem(input.npm, "--npm");
  if (npm !== undefined) problems.push(npm);

  const acceptance = reportOf(input.acceptance, "acceptance", problems);
  const published = reportOf(input.published, "published", problems);

  if (acceptance === undefined) {
    problems.push("the release has no acceptance evidence");
  } else {
    if (acceptance.ok !== true) problems.push("the acceptance run did not pass");
    if (typeof acceptance.commit !== "string" || !COMMIT.test(acceptance.commit)) {
      problems.push(`the acceptance report's commit ${JSON.stringify(stringOf(acceptance.commit))} is not 7-40 lowercase hex characters`);
    }
    if (typeof acceptance.mizzen !== "string" || !EXACT.test(acceptance.mizzen)) {
      problems.push(`the acceptance report's Mizzen version ${JSON.stringify(stringOf(acceptance.mizzen))} is not an exact version`);
    }
    const digest = stringOf(acceptance.digest);
    if (input.tarball === "") problems.push("the candidate tarball is missing or unreadable");
    else if (digest !== input.tarball) problems.push(`the candidate tarball's sha256 ${input.tarball} is not the acceptance report's digest ${digest === "" ? "(missing)" : digest}`);
  }

  if (published !== undefined) {
    if (published.ok !== true) problems.push("the published run did not pass");
    if (acceptance !== undefined) {
      if (published.commit !== acceptance.commit) {
        problems.push(`the published report is for commit ${JSON.stringify(stringOf(published.commit))}, not ${JSON.stringify(stringOf(acceptance.commit))}`);
      }
      if (published.digest !== acceptance.digest) problems.push("the published report's tarball digest is not the acceptance report's digest");
      if (published.mizzen !== acceptance.mizzen) {
        problems.push(`the published report used Mizzen ${JSON.stringify(stringOf(published.mizzen))}, not ${JSON.stringify(stringOf(acceptance.mizzen))}`);
      }
    }
  }

  if (input.accessibility === undefined) {
    problems.push("the accessibility report is missing");
  } else if (input.stored !== undefined && input.accessibility !== input.stored.accessibility) {
    problems.push(`the accessibility report's sha256 ${input.accessibility} is not the archived sha256 ${input.stored.accessibility}`);
  }
  if (input.performance === undefined) {
    problems.push("the performance report is missing");
  } else if (input.stored !== undefined && input.performance !== input.stored.performance) {
    problems.push(`the performance report's sha256 ${input.performance} is not the archived sha256 ${input.stored.performance}`);
  }

  return problems;
}

/** The ledger for one release and every problem that keeps it from being complete. Pure. */
export function ledgerOf(input: LedgerInput): { ledger: ReleaseLedger; problems: string[] } {
  const problems = problemsOf(input);
  const acceptance = (() => {
    try {
      return objectOf(JSON.parse(input.acceptance ?? "null"));
    } catch {
      return undefined;
    }
  })();
  const published = (() => {
    try {
      return objectOf(JSON.parse(input.published ?? "null"));
    } catch {
      return undefined;
    }
  })();
  const commit = stringOf(acceptance?.commit);
  const mizzen = stringOf(acceptance?.mizzen);
  const ledger: ReleaseLedger = {
    tool: "lateen/release-ledger",
    version: 1,
    release: { version: input.version, commit, mizzen, npm: input.npm, run: input.run },
    tarball: {
      candidate: input.tarball === "" ? "" : `sha256:${input.tarball}`,
      published: stringOf(published?.digest) === "" ? "" : `sha256:${stringOf(published?.digest)}`,
    },
    evidence: {
      acceptance: input.run,
      published: input.run,
      accessibility: `/reports/${input.version}/a11y.json`,
      performance: `/reports/${input.version}/performance.json`,
    },
    complete: problems.length === 0,
    problems,
  };
  return { ledger, problems };
}

/** The value after a flag, or `undefined` when the flag is absent or has no value. */
function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const found = index === -1 ? undefined : argv[index + 1];
  return found === undefined || found.trim() === "" ? undefined : found;
}

function textAt(file: string | undefined): string | undefined {
  return file === undefined || !existsSync(file) ? undefined : readFileSync(file, "utf8");
}

function hashAt(file: string | undefined): string | undefined {
  return file === undefined || !existsSync(file) ? undefined : sha256(file);
}

/** The default CI run URL, when the workflow environment names one. */
function runFromEnvironment(): string {
  const server = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const id = process.env.GITHUB_RUN_ID;
  if (server === undefined || repository === undefined || id === undefined) return "";
  return `${server.replace(/\/+$/, "")}/${repository}/actions/runs/${id}`;
}

/**
 * Reads the evidence named on the command line, writes the ledger, and returns it. `base` is the
 * repository root; a test passes a temporary copy so it never touches the real archive.
 */
export function releaseLedger(argv: readonly string[], base = root): ReleaseLedger {
  const version = flag(argv, "--version");
  if (version === undefined) throw new Error("--version needs a release version such as 0.3.0");
  const file = (name: string): string | undefined => {
    const value = flag(argv, name);
    return value === undefined ? undefined : resolve(base, value);
  };
  const tarball = file("--tarball");
  const acceptance = textAt(file("--acceptance"));
  const published = textAt(file("--published"));
  const accessibility = hashAt(file("--a11y"));
  const performance = hashAt(file("--performance"));
  const entry = readIndex(join(base, "site/_data/reports")).releases.find((release) => release.version === version);
  const { ledger } = ledgerOf({
    version,
    run: flag(argv, "--run") ?? runFromEnvironment(),
    npm: flag(argv, "--npm") ?? `https://www.npmjs.com/package/@velella/lateen/v/${version}`,
    tarball: tarball === undefined || !existsSync(tarball) ? "" : sha256(tarball),
    ...(acceptance === undefined ? {} : { acceptance }),
    ...(published === undefined ? {} : { published }),
    ...(accessibility === undefined ? {} : { accessibility }),
    ...(performance === undefined ? {} : { performance }),
    ...(entry === undefined ? {} : { stored: { accessibility: entry.a11y.sha256, performance: entry.performance.sha256 } }),
  });
  const out = file("--out") ?? join(base, "site/_data/releases", `${version}.json`);
  writeReport(out, schemaAt("release-ledger.schema.json"), ledger);
  return ledger;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const ledger = releaseLedger(process.argv.slice(2));
    if (!ledger.complete) {
      console.error(`The release ledger for ${ledger.release.version} is incomplete:\n- ${ledger.problems.join("\n- ")}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
