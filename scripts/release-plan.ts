// The release workflow's decisions: a dispatch input must be one bare `v<version>` ref whose
// version is the package.json version of the commit it names, a prerelease goes to the `next`
// dist-tag, and a version npm already serves is verified instead of published.
// Usage: node scripts/release-plan.ts --tag <tag> [--version <package.json version>] [--github-output <file>]
//        node scripts/release-plan.ts --tag <tag> --served <npm view output> [--github-output <file>]
//        node scripts/release-plan.ts --tag <tag> --served <npm view output> --outcome
//          --acceptance <success|failure|skipped> --publish <...> --post-publish <...>
//          [--tag-exists false] [--release-exists true] [--github-output <file>]
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The only tag shape a release accepts. The workflow preflight checks the same string. */
export const TAG_PATTERN = "^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$";

const TAG = new RegExp(TAG_PATTERN);
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export type DistTag = "next" | "latest";
export type Stage = "success" | "failure" | "skipped";
export type ReleaseAction = "create" | "exists" | "none";

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

/** A version with a prerelease suffix never moves the `latest` dist-tag. */
export function distTagOf(version: string): DistTag {
  return version.includes("-") ? "next" : "latest";
}

/** Whether npm already serves this exact version, given `npm view`'s output. */
export function alreadyPublished(served: string, version: string): boolean {
  return served.trim() === version;
}

export interface ReleaseState {
  readonly version: string;
  /** `npm view name@version version`; empty when npm serves nothing. */
  readonly served: string;
  readonly tagExists: boolean;
  readonly acceptance: Stage;
  readonly publish: Stage;
  readonly postPublish: Stage;
  readonly releaseExists: boolean;
}

export interface ReleaseOutcome {
  readonly distTag: DistTag;
  /** True when npm served nothing: the first publish. A retry verifies instead. */
  readonly firstPublish: boolean;
  readonly verified: boolean;
  readonly action: ReleaseAction;
  readonly reason: string;
}

/**
 * The first-publish and retry state machine. Only acceptance, publish and the post-publish run
 * passing make a release verified, so no retry or partial publish can create a GitHub Release
 * from an invalid transition.
 */
export function releaseOutcome(state: ReleaseState): ReleaseOutcome {
  const distTag = distTagOf(state.version);
  const firstPublish = !alreadyPublished(state.served, state.version);
  const stop = (reason: string): ReleaseOutcome => ({ distTag, firstPublish, verified: false, action: "none", reason });
  if (!state.tagExists) return stop("the tag does not name this commit");
  if (state.acceptance !== "success") return stop("the acceptance gate did not pass");
  // A first publish must have published; an existing version must not have failed to publish.
  if (firstPublish ? state.publish !== "success" : state.publish === "failure") {
    return stop(firstPublish ? "npm publish did not succeed" : "npm publish failed for a version npm already serves");
  }
  if (state.postPublish !== "success") return stop("the post-publish acceptance run did not pass");
  return state.releaseExists
    ? { distTag, firstPublish, verified: true, action: "exists", reason: "the GitHub Release already exists" }
    : { distTag, firstPublish, verified: true, action: "create", reason: "verified; create the GitHub Release" };
}

/** The `key=value` lines the workflow reads for one publish/verify run. */
export function planOutputs(version: string, served: string): string[] {
  const distTag = distTagOf(version);
  const published = alreadyPublished(served, version);
  return [
    `version=${version}`,
    `dist-tag=${distTag}`,
    `published=${published}`,
    `publish=${!published}`,
    `prerelease=${distTag === "next"}`,
  ];
}

/** The value after a flag exactly as given, including an empty string. */
function value(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

/** The value after a flag, or `undefined` when the flag is absent or has no value. */
export function flag(argv: readonly string[], name: string): string | undefined {
  const found = value(argv, name);
  return found === undefined || found.trim() === "" ? undefined : found;
}

function stage(argv: readonly string[], name: string): Stage {
  const value = flag(argv, name);
  return value === "success" || value === "failure" ? value : "skipped";
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
  // Empty is meaningful here: npm serves nothing, so this is a first publish.
  const served = value(argv, "--served");
  if (served === undefined) {
    // Preflight only needs the version; it runs before anything is checked out or published.
    if (output !== undefined) appendFileSync(output, `version=${version}\n`);
    console.log(`Release tag ${tag} names ${version}`);
    return;
  }
  if (!argv.includes("--outcome")) {
    const lines = planOutputs(version, served);
    if (output !== undefined) appendFileSync(output, `${lines.join("\n")}\n`);
    console.log(lines.join("\n"));
    return;
  }
  const outcome = releaseOutcome({
    version,
    served,
    tagExists: flag(argv, "--tag-exists") !== "false",
    acceptance: stage(argv, "--acceptance"),
    publish: stage(argv, "--publish"),
    postPublish: stage(argv, "--post-publish"),
    releaseExists: flag(argv, "--release-exists") === "true",
  });
  const lines = [`action=${outcome.action}`, `reason=${outcome.reason}`, `dist-tag=${outcome.distTag}`, `first-publish=${outcome.firstPublish}`];
  if (output !== undefined) appendFileSync(output, `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
  if (!outcome.verified) {
    console.error(`The release is not verified: ${outcome.reason}. No GitHub Release is created.`);
    process.exitCode = 1;
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
