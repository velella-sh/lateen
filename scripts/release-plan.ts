// The release workflow's tag decisions: a dispatch input must be one bare `v<version>` ref whose
// version is the package.json version of the commit it names. A branch name, a full ref, a range or
// shell syntax must stop before anything checks that ref out.
// Usage: node scripts/release-plan.ts --tag <tag> [--version <package.json version>] [--github-output <file>]
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The only tag shape a release accepts. The workflow preflight checks the same string. */
export const TAG_PATTERN = "^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$";

const TAG = new RegExp(TAG_PATTERN);
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

/** Every reason the tag cannot release this version, one line each. Pure. */
export function tagProblems(tag: string, version: string): string[] {
  const problems: string[] = [];
  if (!TAG.test(tag)) {
    // The whole input must be the ref: `refs/tags/v1.2.3`, a branch name, whitespace or shell
    // syntax would make checkout resolve something other than the tag's version.
    problems.push(`the release tag must be exactly v<major>.<minor>.<patch> or a prerelease of it, such as v1.2.3-rc.1; got ${JSON.stringify(tag)}`);
  }
  if (!VERSION.test(version)) {
    problems.push(`package.json version ${JSON.stringify(version)} is not a release version such as 1.2.3 or 1.2.3-rc.1`);
  } else if (tag !== `v${version}`) {
    problems.push(`the release tag ${JSON.stringify(tag)} does not match package.json version ${version}; bump the version before releasing`);
  }
  return problems;
}

/** The value after a flag, or `undefined` when the flag is absent or has no value. */
export function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const found = index === -1 ? undefined : argv[index + 1];
  return found === undefined || found.trim() === "" ? undefined : found;
}

export function main(argv = process.argv.slice(2)): void {
  const tag = flag(argv, "--tag");
  if (tag === undefined) {
    throw new Error("usage: node scripts/release-plan.ts --tag <tag> [--version <package.json version>] [--github-output <file>]");
  }
  const version = flag(argv, "--version") ?? (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
  const problems = tagProblems(tag, version);
  if (problems.length > 0) {
    console.error(`The release tag cannot be released:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const output = flag(argv, "--github-output");
  if (output !== undefined) appendFileSync(output, `version=${version}\n`);
  console.log(`Release tag ${tag} names ${version}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
