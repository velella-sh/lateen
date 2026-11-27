// Verifies every source and generated artifact the installed theme needs: units, islands, styles,
// fonts, tokens, translations, schemas, the visual export, the skill, and the
// starters. prepack runs it after `ui:build`, and scripts/smoke-package.sh runs it against the
// installed copy, so a file the tarball leaves out fails at the pack, not in a reader's build.
//
// It requires what a consumer's build reads, not everything the checkout holds. The Tailwind sources
// under `styles/src` are build input for `npm run ui:css`, and the engine bundles only the top-level
// `styles/*.css` sheets (it lists that folder's files, not its subfolders), so those sources stay out
// of the tarball and out of this list.
// Usage: node scripts/check-package.ts [dir]
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

/** Generated assets the theme ships; required even when a fresh checkout has not built them yet. */
const GENERATED = ["styles/generated.css", "components/performance-chart/chart.min.js"];

/** Files under `repo/dir` with one of the extensions, as repo-relative paths with `/` separators. */
function filesUnder(repo: string, dir: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.some((extension) => entry.name.endsWith(extension))) {
        found.push(relative(repo, full).split(sep).join("/"));
      }
    }
  };
  walk(join(repo, dir));
  return found;
}

/** Files directly under `repo/dir` with one of the extensions, as `<dir>/<name>`, sorted. */
function filesIn(repo: string, dir: string, extensions: readonly string[]): string[] {
  return readdirSync(join(repo, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

/** Every artifact the installed theme needs, derived from the checkout, in path order and once each. */
export function requiredArtifacts(repo: string = root): string[] {
  const sources = [
    ...filesUnder(repo, "src", [".ts"]),
    ...filesUnder(repo, "layouts", [".ts"]),
    ...filesUnder(repo, "chrome", [".ts"]),
    ...filesUnder(repo, "components", [".ts"]),
    ...filesUnder(repo, "visual", [".ts"]),
    ...filesIn(repo, "styles", [".css"]),
    ...filesUnder(repo, "tokens", [".json"]),
    ...filesUnder(repo, "fonts", [".woff2"]),
    ...filesUnder(repo, "i18n", [".json", ".ts"]),
    ...filesUnder(repo, "schema", [".json"]),
    ...filesUnder(repo, "starters", [".json", ".md", ".yml"]),
    ...filesUnder(repo, "docs/spec", [".md", ".ts"]),
    "skills/lateen/SKILL.md",
  ];
  return [...new Set([...sources, ...GENERATED])].sort();
}

/** The required paths that are absent or empty in `dir`. */
export function missingArtifacts(dir: string, required: readonly string[] = requiredArtifacts()): string[] {
  return required.filter((path) => {
    try {
      return statSync(join(dir, path)).size === 0;
    } catch {
      return true;
    }
  });
}

export function main(argv = process.argv.slice(2)): void {
  const dir = argv[0] ?? root;
  const required = requiredArtifacts();
  const missing = missingArtifacts(dir, required);
  if (missing.length > 0) {
    for (const path of missing) console.error(`the package omits ${path}`);
    process.exitCode = 1;
    return;
  }
  // stderr keeps prepack stdout clean for `npm pack --json` consumers (scripts/acceptance.ts).
  console.error(`all ${required.length} required theme artifacts are present`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}