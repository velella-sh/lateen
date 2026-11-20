// The screen-reader path audit: builds the integration fixture, opens search, compare, and a
// code-copy path at desktop and mobile widths, and records the accessibility tree a screen reader
// navigates. Spoken output is not captured; the report names that as the unresolved finding at each
// reproducible location. The JSON is validated against schema/screen-reader-audit.schema.json and
// checks in as the release evidence.
//
// Usage: node scripts/audit-screen-reader.ts [--report <file>]
// Setup: npm run ui:build && npx playwright install chromium
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { startServer, type StaticServer } from "../visual/index.ts";
import { commitOf, reportPath, schemaAt, writeReport } from "./report.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MIZZEN = join(ROOT, "node_modules/@velella/mizzen/bin/mizzen.js");
const FIXTURE = join(ROOT, "fixtures/integration");

export const REPORT_FILE = join(ROOT, "test/accessibility/screen-reader.json");

export interface ScreenReaderCase {
  readonly name: string;
  readonly path: string;
  /** The element whose tree is recorded. */
  readonly target: string;
  /** Roles the snapshot must contain at desktop width for the path to count as recorded. */
  readonly roles: readonly string[];
  /** Roles the snapshot must contain at mobile width; the responsive layout may replace a header. */
  readonly mobileRoles?: readonly string[];
  /** Prepares the state a reader meets: the open dialog, the loaded table, the copy control. */
  readonly prepare: (page: Page) => Promise<void>;
}

export const CASES: readonly ScreenReaderCase[] = [
  {
    name: "search",
    path: "/guide/install/",
    target: "dialog[data-search]",
    roles: ["dialog", "combobox"],
    async prepare(page) {
      await page.locator("[data-search-open]").click();
      await page.locator("dialog[data-search][open]").waitFor({ state: "visible" });
    },
  },
  {
    name: "compare",
    path: "/compare/",
    target: "[data-compare]",
    roles: ["table", "columnheader", "rowheader"],
    // Below 40rem the table repeats each record title in its value cells instead of a header row.
    mobileRoles: ["table", "rowheader"],
    async prepare(page) {
      await page.locator("[data-compare] table").waitFor({ state: "visible" });
    },
  },
  {
    name: "code copy",
    path: "/guide/install/",
    target: ".code-frame",
    roles: ["button"],
    async prepare(page) {
      await page.locator(".code-copy").first().waitFor({ state: "visible" });
    },
  },
];

export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** A missing required role, naming the path and selector where a screen-reader pass must reproduce it. */
export function missingRole(snapshot: string, roles: readonly string[], path: string, target: string): string | undefined {
  for (const role of roles) {
    if (!new RegExp(`(^|\\n)\\s*- ${role}\\b`).test(snapshot)) return `${path} ${target} has no ${role} in the accessibility tree`;
  }
  return undefined;
}

/** The report in a stable order: cases, then desktop before mobile, with no clock. */
export function buildScreenReaderReport(
  commit: string,
  cases: readonly { name: string; path: string; viewport: string; snapshot: string; finding?: string }[],
): Readonly<Record<string, unknown>> {
  return {
    tool: "lateen/screen-reader-audit",
    version: 1,
    commit,
    cases: cases.map((item) => ({
      name: item.name,
      path: item.path,
      viewport: item.viewport,
      snapshot: item.snapshot,
      ...(item.finding === undefined ? {} : { finding: item.finding }),
    })),
    findings: cases.flatMap((item) =>
      item.finding === undefined ? [] : [{ location: `${item.path} ${item.viewport}`, note: item.finding }],
    ),
  };
}

async function snapshotCase(page: Page, item: ScreenReaderCase, base: string): Promise<Locator> {
  await page.goto(new URL(item.path, base).href, { waitUntil: "networkidle" });
  await item.prepare(page);
  const target = page.locator(item.target).first();
  await target.waitFor({ state: "visible" });
  return target;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const file = reportPath(argv) ?? REPORT_FILE;
  const out = mkdtempSync(join(tmpdir(), "lateen-screen-reader-"));
  let server: StaticServer | undefined;
  let browser: Browser | undefined;
  const cases: { name: string; path: string; viewport: string; snapshot: string; finding?: string }[] = [];

  try {
    if (spawnSync(process.execPath, [MIZZEN, "build", FIXTURE, "--out", out, "--theme", ROOT], { encoding: "utf8" }).status !== 0) {
      throw new Error("the integration fixture did not build");
    }
    server = await startServer(out, "");
    browser = await chromium.launch();

    for (const item of CASES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        try {
          const page = await context.newPage();
          const target = await snapshotCase(page, item, server.url);
          const snapshot = await target.ariaSnapshot();
          const roles = viewport.name === "mobile" ? (item.mobileRoles ?? item.roles) : item.roles;
          const missing = missingRole(snapshot, roles, item.path, `${item.target} at ${viewport.name}`);
          if (missing !== undefined) throw new Error(missing);
          cases.push({
            name: item.name,
            path: item.path,
            viewport: viewport.name,
            snapshot,
            finding: "Spoken output was not captured in this environment; the accessibility tree is recorded here.",
          });
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser?.close();
    await server?.close();
    rmSync(out, { recursive: true, force: true });
  }

  writeReport(file, schemaAt("screen-reader-audit.schema.json"), buildScreenReaderReport(commitOf(), cases));
  console.log(`OK: ${cases.length} screen-reader paths recorded in ${file}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
