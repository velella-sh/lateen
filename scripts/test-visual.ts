// The screenshot runner of the visual gates: builds the visual fixture site, serves it on a local
// port, and takes one full-page screenshot in Chromium for every entry of test/visual/matrix.json
// into test/visual/out/. The runner, the matrix and the capture settings live in visual/index.ts,
// next to the export a site calls on its own pages (#505).
//
// Setup: npm ci && npx playwright install chromium
// Usage: node scripts/test-visual.ts [--only <case name substring>] [--out <folder>] [--update]
// Each shot is compared with test/visual/baselines/<case>.png; a failure writes before, after and diff
// images into <out>/review/. --update writes the baselines and is the only thing that does.
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser } from "playwright";
import { buildFixture } from "../test/visual/fixtures/build.ts";
import {
  capture,
  expandMatrix,
  launchChromium,
  loadMatrix,
  newVisualContext,
  startServer,
  type VisualMatrix,
} from "../visual/index.ts";
import { checkPage, formatFinding, type PageFinding } from "./visual-checks.ts";
import { formatReview, reviewShots } from "./visual-review.ts";

// The runner and the matrix live in the export a site uses (visual/index.ts); re-exported for the tests.
export {
  CONTEXT_OPTIONS,
  DEFAULT_VIEWPORT,
  MAX_HEIGHT,
  STABILIZE_CSS,
  capture,
  expandMatrix,
  isLocalRequest,
  loadMatrix,
  newVisualContext,
} from "../visual/index.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Where the screenshots go; `.gitignore` keeps it out of the repository. */
export const OUT_DIR = join(ROOT, "test/visual/out");

/** The committed baselines. */
export const BASELINE_DIR = join(ROOT, "test/visual/baselines");

export interface RunOptions {
  readonly out?: string;
  /** Only cases whose name contains this text. */
  readonly only?: string;
  /** A matrix other than test/visual/matrix.json. */
  readonly matrix?: VisualMatrix;
  /** Receives the layout findings of the in-page checks (scripts/visual-checks.ts). */
  readonly findings?: PageFinding[];
}

/** Builds the fixture, serves it and shoots every matrix entry. Returns the files written. */
export async function runVisual(options: RunOptions = {}): Promise<string[]> {
  const out = resolve(options.out ?? OUT_DIR);
  const site = join(ROOT, ".mizzen/visual/fixture-site");
  rmSync(site, { recursive: true, force: true });
  buildFixture(site);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const entries = expandMatrix(options.matrix ?? loadMatrix()).filter((entry) => options.only === undefined || entry.case.includes(options.only));
  const viewports = [...new Map(entries.map((entry) => [`${entry.width}x${entry.height}`, { width: entry.width, height: entry.height }])).values()];

  const server = await startServer(site, "");
  let browser: Browser | undefined;
  const written: string[] = [];
  try {
    browser = await launchChromium();
    for (const viewport of viewports) {
      const context = await newVisualContext(browser, server.url, viewport);
      try {
        const page = await context.newPage();
        for (const entry of entries) {
          if (entry.width !== viewport.width || entry.height !== viewport.height) continue;
          const file = join(out, `${entry.case}.png`);
          await capture(page, `${server.url}${entry.path}`, file, {
            theme: entry.theme,
            media: entry.section === "print" ? "print" : "screen",
            forcedColors: entry.section === "forced-colors",
          });
          written.push(file);
          options.findings?.push(...(await checkPage(page, entry.name, entry.case)));
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await server.close();
  }
  return written;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const value = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };
  const out = value("--out");
  const only = value("--only");
  const findings: PageFinding[] = [];
  const files = await runVisual({ findings, ...(only !== undefined ? { only } : {}), ...(out !== undefined ? { out } : {}) });
  const shots = resolve(out ?? OUT_DIR);
  console.log(`wrote ${files.length} screenshots to ${shots}`);
  for (const finding of findings) console.log(formatFinding(finding));
  if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} layout finding(s)`);
    process.exitCode = 1;
  }
  const update = argv.includes("--update");
  if (update && process.env["CI"] === undefined) console.warn("note: baselines are recorded on CI (docs/design/visual-gates.md); a local baseline should not be committed");
  const { lines, ok } = formatReview(reviewShots({ shots, baselines: BASELINE_DIR, review: join(shots, "review"), update }));
  console.log(lines.join("\n"));
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
