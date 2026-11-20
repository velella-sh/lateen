// The release workflow's decisions: a dispatch input must be one bare `v<version>` ref whose
// version is the package.json version of the commit it names; a prerelease goes to the `next`
// dist-tag; and a version npm already serves is verified instead of published.
// Usage: node scripts/release-plan.ts --tag <tag> [--version <version>] [--served <npm view output>] [--check-tag] [--github-output <file>]
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The only tag shape a release accepts. The workflow preflight checks the same string. */
export const TAG_PATTERN = "^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$";

const TAG = new RegExp(TAG_PATTERN);
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export type DistTag = "next" | "latest";

export interface ReleasePlan {
  readonly version: string;
  readonly distTag: DistTag;
  readonly published: boolean;
  readonly publish: boolean;
  readonly prerelease: boolean;
  readonly latest: boolean;
}

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

/** A version with a prerelease suffix never moves the `latest` dist-tag. Pure. */
export function distTagOf(version: string): DistTag {
  return version.includes("-") ? "next" : "latest";
}

/** Whether npm already serves this exact version, given `npm view`'s output. Pure. */
export function alreadyPublished(served: string, version: string): boolean {
  return served.trim() === version;
}

/** Every workflow output for one release run, including the retry decision and release flags. Pure. */
export function planRelease(version: string, served: string): ReleasePlan {
  const distTag = distTagOf(version);
  const published = alreadyPublished(served, version);
  return {
    version,
    distTag,
    published,
    publish: !published,
    prerelease: distTag === "next",
    latest: distTag === "latest",
  };
}

/** The `key=value` lines the workflow reads, one per decision. */
export function outputLines(plan: ReleasePlan): string[] {
  return [
    `version=${plan.version}`,
    `dist-tag=${plan.distTag}`,
    `published=${plan.published}`,
    `publish=${plan.publish}`,
    `prerelease=${plan.prerelease}`,
    `latest=${plan.latest}`,
  ];
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
    throw new Error("usage: node scripts/release-plan.ts --tag <tag> [--version <version>] [--served <npm view output>] [--check-tag] [--github-output <file>]");
  }
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name?: string; version?: string };
  // Preflight passes the tag commit's version because this checkout is the default branch.
  const version = flag(argv, "--version") ?? pkg.version;
  if (version === undefined) throw new Error("package.json has no version");
  const problems = tagProblems(tag, version);
  if (problems.length > 0) {
    console.error(`The release tag cannot be released:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const output = flag(argv, "--github-output");
  if (argv.includes("--check-tag")) {
    if (output !== undefined) appendFileSync(output, `version=${version}\n`);
    console.log(`Release tag ${tag} names ${version}`);
    return;
  }
  const plan = planRelease(version, flag(argv, "--served") ?? "");
  const lines = outputLines(plan);
  if (output !== undefined) appendFileSync(output, `${lines.join("\n")}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Releasing ${pkg.name ?? "the package"}@${plan.version} to the \`${plan.distTag}\` dist-tag (already on npm: ${plan.published})\n`,
    );
  }
  console.log(lines.join("\n"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
