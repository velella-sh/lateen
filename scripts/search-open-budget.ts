// Measures the mobile search opening time of fixtures/integration: the first opening, which loads the
// search index, and the median of five repeat openings, which reuse it. The numbers are compared with
// a checked-in CI baseline; it is a regression ceiling, not a product target. See docs/performance.md.
// Usage: node scripts/search-open-budget.ts [--report <file>] [--baseline <file>] [--update]
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { startServer, type StaticServer } from "../visual/index.ts";
import { commitOf, schemaAt, writeReport } from "./report.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE = join(ROOT, "fixtures/integration");
const MIZZEN = join(ROOT, "node_modules/@velella/mizzen/bin/mizzen.js");
const VIEWPORT = "mobile" as const;
const REPEATS = 5;

export interface SearchMeasurement {
  readonly firstMs: number;
  readonly repeatMs: number;
}

export interface SearchBaseline extends SearchMeasurement {
  readonly tool: "lateen/search-open-baseline";
  readonly version: 1;
  readonly viewport: typeof VIEWPORT;
}

export interface SearchReport extends SearchMeasurement {
  readonly tool: "lateen/search-open-report";
  readonly version: 1;
  readonly commit: string;
  readonly viewport: typeof VIEWPORT;
  readonly baseline: SearchMeasurement;
  readonly ok: boolean;
}

/** The even-length case rounds the middle pair, so every reported time is a whole millisecond. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median needs at least one value");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

/** The next 100 ms above the measured time: the baseline records a ceiling, never a local claim. */
export function baselineOf(measured: SearchMeasurement): SearchMeasurement {
  return {
    firstMs: Math.ceil(measured.firstMs / 100) * 100,
    repeatMs: Math.ceil(measured.repeatMs / 100) * 100,
  };
}

/** Every ceiling `report` is over, in the order the two openings are measured. */
export function searchVerdict(report: SearchMeasurement & { readonly baseline: SearchMeasurement }): string[] {
  const failures: string[] = [];
  if (report.firstMs > report.baseline.firstMs) {
    failures.push(`first opening ${report.firstMs} ms is over the ${report.baseline.firstMs} ms baseline`);
  }
  if (report.repeatMs > report.baseline.repeatMs) {
    failures.push(`repeat opening ${report.repeatMs} ms is over the ${report.baseline.repeatMs} ms baseline`);
  }
  return failures;
}

/** `--report` and `--baseline` resolve against the repository root; the defaults are the CI paths. */
function fileOf(argv: readonly string[], flag: string, fallback: string): string {
  const index = argv.indexOf(flag);
  const value = index === -1 ? fallback : argv[index + 1];
  if (value === undefined || value.trim() === "") throw new Error(`${flag} needs a file path`);
  return isAbsolute(value) ? value : join(ROOT, value);
}

function build(out: string): void {
  const run = spawnSync(process.execPath, [MIZZEN, "build", FIXTURE, "--out", out, "--theme", ROOT], { encoding: "utf8" });
  if (run.error !== undefined) throw run.error;
  if (run.status !== 0) throw new Error(`mizzen build failed:\n${run.stderr || run.stdout || "no output"}`);
}

function readBaseline(file: string): SearchMeasurement {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  const baseline = parsed as Partial<SearchMeasurement>;
  if (typeof baseline.firstMs !== "number" || typeof baseline.repeatMs !== "number") {
    throw new Error(`${file}: expected numeric firstMs and repeatMs`);
  }
  return { firstMs: baseline.firstMs, repeatMs: baseline.repeatMs };
}

/** One opening, from the click to the visible dialog. */
async function openOnce(page: Page): Promise<number> {
  const start = performance.now();
  await page.locator("[data-search-open]").click();
  await page.locator("dialog[data-search][open]").waitFor({ state: "visible" });
  return Math.round(performance.now() - start);
}

async function closeOnce(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.locator("dialog[data-search][open]").waitFor({ state: "hidden" });
}

/** Builds the fixture into a temporary folder, measures it in a mobile Chromium context, and cleans up. */
async function measure(): Promise<SearchMeasurement> {
  const out = mkdtempSync(join(tmpdir(), "lateen-search-"));
  let server: StaticServer | undefined;
  let browser: Browser | undefined;
  try {
    build(out);
    server = await startServer(out, "");
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    try {
      const page = await context.newPage();
      await page.goto(`${server.url}/guide/install/`, { waitUntil: "load" });
      await page.locator("[data-search-open]").waitFor({ state: "visible" });
      const firstMs = await openOnce(page);
      await closeOnce(page);
      const repeats: number[] = [];
      for (let run = 0; run < REPEATS; run += 1) {
        repeats.push(await openOnce(page));
        await closeOnce(page);
      }
      return { firstMs, repeatMs: median(repeats) };
    } finally {
      await context.close();
    }
  } finally {
    await browser?.close();
    await server?.close();
    rmSync(out, { recursive: true, force: true });
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const reportFile = fileOf(argv, "--report", "test/smoke/out/search-open.json");
  const baselineFile = fileOf(argv, "--baseline", "test/performance/search-baseline.json");
  const measured = await measure();

  const update = argv.includes("--update");
  const baseline: SearchMeasurement = update ? baselineOf(measured) : readBaseline(baselineFile);
  if (update) {
    const written: SearchBaseline = { tool: "lateen/search-open-baseline", version: 1, viewport: VIEWPORT, ...baseline };
    writeFileSync(baselineFile, `${JSON.stringify(written, null, 2)}\n`);
    console.log(`wrote ${relative(ROOT, baselineFile)}`);
  }

  const failures = searchVerdict({ ...measured, baseline });
  const report: SearchReport = {
    tool: "lateen/search-open-report",
    version: 1,
    commit: commitOf(),
    viewport: VIEWPORT,
    ...measured,
    baseline,
    ok: failures.length === 0,
  };
  writeReport(reportFile, schemaAt("search-open-report.schema.json"), report);
  console.log(`mobile search: first ${measured.firstMs} ms, repeat median ${measured.repeatMs} ms`);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(`FAIL: ${failures.length} search opening budget problem(s)`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: the first and repeat openings are within the checked-in baseline (${baseline.firstMs} ms, ${baseline.repeatMs} ms)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
