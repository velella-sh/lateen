// Records whether the GitHub Release may be presented as verified: the release exists and the
// post-publish acceptance run and digest check passed for one tarball. The result reuses the
// ledger's evidence and tarball shapes, so the release step and the release ledger name the same
// evidence. A missing release or check keeps verified: false and exits 1.
// Usage: node scripts/release-result.ts --tag v0.2.3 --exists true|false --run <url>
//        --accepted <sha256-hex> --published <sha256-hex>
import { fileURLToPath } from "node:url";
import type { ReleaseLedger } from "./release-ledger.ts";

export interface ReleaseState {
  readonly tag: string;
  /** Whether `gh release view` found the release in its final, published state. */
  readonly exists: boolean;
  /** The CI run that produced both the acceptance and the post-publish report. */
  readonly run: string;
  /** The acceptance report's tarball SHA-256, or an empty string when it recorded none. */
  readonly accepted: string;
  /** The installed published tarball's SHA-256, or an empty string when it could not be read. */
  readonly published: string;
}

export interface ReleaseResult {
  readonly tag: string;
  readonly exists: boolean;
  readonly evidence: Pick<ReleaseLedger["evidence"], "acceptance" | "published">;
  readonly tarball: ReleaseLedger["tarball"];
  readonly checks: {
    readonly release: boolean;
    readonly acceptance: boolean;
    readonly digest: boolean;
  };
  readonly verified: boolean;
  readonly problems: readonly string[];
}

const sha256Of = (digest: string): string => (digest === "" ? "" : `sha256:${digest}`);

const httpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** The release's verified state and every reason it cannot be called verified. Pure. */
export function releaseResultOf(state: ReleaseState): ReleaseResult {
  const problems: string[] = [];
  const release = state.exists;
  const acceptance = httpsUrl(state.run);
  const digest = state.accepted !== "" && state.published === state.accepted;
  if (!release) problems.push(`the GitHub Release ${state.tag} does not exist`);
  if (!acceptance) problems.push(`the post-publish acceptance run ${JSON.stringify(state.run)} is not an https URL`);
  if (state.accepted === "") problems.push("the post-publish run has no accepted tarball digest");
  else if (!digest) {
    problems.push(`the published tarball digest ${state.published === "" ? "(missing)" : state.published} is not the accepted tarball digest ${state.accepted}`);
  }
  return {
    tag: state.tag,
    exists: state.exists,
    evidence: { acceptance: state.run, published: state.run },
    tarball: { candidate: sha256Of(state.accepted), published: sha256Of(state.published) },
    checks: { release, acceptance, digest },
    verified: problems.length === 0,
    problems,
  };
}

/** The line the release step and its summary carry for a verified release. */
export function releaseNote(result: ReleaseResult): string {
  if (!result.verified) return `The GitHub Release ${result.tag} is not verified:\n- ${result.problems.join("\n- ")}`;
  return `Verified GitHub Release ${result.tag}: post-publish acceptance passed in ${result.evidence.published}; the published tarball is ${result.tarball.published}.`;
}

/** The value after a flag, or `undefined` when the flag is absent or has no value. */
function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const found = index === -1 ? undefined : argv[index + 1];
  return found === undefined || found.trim() === "" ? undefined : found;
}

export function main(argv = process.argv.slice(2)): void {
  const tag = flag(argv, "--tag");
  if (tag === undefined) {
    throw new Error("usage: node scripts/release-result.ts --tag <tag> --exists <true|false> --run <url> --accepted <sha256> --published <sha256>");
  }
  const result = releaseResultOf({
    tag,
    exists: flag(argv, "--exists") === "true",
    run: flag(argv, "--run") ?? "",
    accepted: flag(argv, "--accepted") ?? "",
    published: flag(argv, "--published") ?? "",
  });
  const note = releaseNote(result);
  if (!result.verified) {
    console.error(note);
    process.exitCode = 1;
    return;
  }
  console.log(note);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
