// Proves the generated UI assets are reproducible and fresh: two clean builds in separate
// directories must match byte for byte, and the checkout's copies must match a clean build.
// Usage: node scripts/check-ui-build.ts
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

/** Repo-relative path of each generated asset, in build order. */
export const ASSETS = ["styles/generated.css", "components/performance-chart/chart.min.js"] as const;

function run(name: string, args: string[]): void {
  execFileSync(join(root, "node_modules/.bin", name), args, { cwd: root, stdio: "inherit" });
}

/** Writes a clean build of every generated asset into `dir`, keyed by repo-relative path. */
export function buildAssets(dir: string): Record<string, Buffer> {
  const css = join(dir, ASSETS[0]);
  const chart = join(dir, ASSETS[1]);
  mkdirSync(dirname(css), { recursive: true });
  mkdirSync(dirname(chart), { recursive: true });
  run("tailwindcss", ["-i", "styles/src/ui.css", "-o", css, "--minify"]);
  run("esbuild", ["scripts/chart-entry.ts", "--bundle", "--minify", "--format=esm", "--outfile=" + chart]);
  return {
    [ASSETS[0]]: readFileSync(css),
    [ASSETS[1]]: readFileSync(chart),
  };
}

/** The assets in `dir` that are absent, empty, or differ from `expected`. */
export function staleAssets(expected: Record<string, Buffer>, dir: string): string[] {
  return ASSETS.filter((path) => {
    try {
      const actual = readFileSync(join(dir, path));
      return actual.length === 0 || !actual.equals(expected[path] as Buffer);
    } catch {
      return true;
    }
  });
}

export function problems(repo: string = root): string[] {
  const first = mkdtempSync(join(tmpdir(), "ui-build-a-"));
  const second = mkdtempSync(join(tmpdir(), "ui-build-b-"));
  try {
    const expected = buildAssets(first);
    buildAssets(second);
    return [
      ...staleAssets(expected, second).map((path) => `${path} changes between clean builds`),
      ...staleAssets(expected, repo).map((path) => `${path} is missing, empty, or stale: run npm run ui:build`),
    ];
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
}

function main(): void {
  const found = problems();
  if (found.length > 0) {
    for (const problem of found) console.error(problem);
    process.exitCode = 1;
    return;
  }
  console.error(`two clean builds of ${ASSETS.length} generated assets match each other and the checkout`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
