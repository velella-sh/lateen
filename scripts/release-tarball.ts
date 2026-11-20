// Selects the one tarball an acceptance report names from an artifact directory. The release
// workflow publishes and digest-checks that file, never whichever .tgz a shell glob lists first:
// zero or several tarballs, or a name the report does not name, stop the release before npm publish.
// Usage: node scripts/release-tarball.ts --dir <dir> --report <report.json>
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJson } from "../src/guards.ts";

export interface TarballSelection {
  readonly tarball: string | undefined;
  readonly problems: string[];
}

/** The one .tgz the report names, or every reason the directory cannot offer it. Pure. */
export function selectTarball(files: readonly string[], named: unknown): TarballSelection {
  const tarballs = files.filter((file) => file.endsWith(".tgz")).sort();
  if (tarballs.length === 0) return { tarball: undefined, problems: ["the artifact directory has no .tgz tarball"] };
  if (tarballs.length > 1) {
    return { tarball: undefined, problems: [`the artifact directory has ${tarballs.length} .tgz tarballs, expected exactly one: ${tarballs.join(", ")}`] };
  }
  if (typeof named !== "string" || named.trim() === "") {
    return { tarball: undefined, problems: ["the acceptance report does not name a tarball"] };
  }
  const only = tarballs[0]!;
  if (only !== named) {
    return { tarball: undefined, problems: [`the artifact tarball ${only} is not the acceptance report's tarball ${named}`] };
  }
  return { tarball: only, problems: [] };
}

/** The value after a flag, or `undefined` when the flag is absent or has no value. */
function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const found = index === -1 ? undefined : argv[index + 1];
  return found === undefined || found.trim() === "" ? undefined : found;
}

export function main(argv = process.argv.slice(2)): void {
  const dir = flag(argv, "--dir");
  const report = flag(argv, "--report");
  if (dir === undefined || report === undefined) {
    throw new Error("usage: node scripts/release-tarball.ts --dir <dir> --report <report.json>");
  }
  const value: unknown = parseJson(readFileSync(report, "utf8"));
  const named = typeof value === "object" && value !== null ? (value as { tarball?: unknown }).tarball : undefined;
  const { tarball, problems } = selectTarball(readdirSync(dir), named);
  if (tarball === undefined) {
    console.error(`The artifact cannot gate publishing:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(join(dir, tarball));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}