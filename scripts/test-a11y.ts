// The accessibility gate: builds the docs site and a small fixture site, serves them, and runs
// axe-core in Chromium over the layouts, both color themes, the English and right-to-left locales,
// and the open drawer and search states. A critical or serious violation fails the run unless it is
// listed as known in test/accessibility/baseline.json; moderate and minor findings do not fail it.
//
// Setup: npm ci && npx playwright install chromium   (add --with-deps on Linux CI)
// Usage: node scripts/test-a11y.ts [--only <case name substring>] [--report <file>]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright";
import { SEARCH_INPUT_ID } from "../chrome/search/index.ts";
import { THEME_KEY } from "../chrome/theme-toggle/key.ts";
import { fileForRequest, startServer, type StaticServer } from "../visual/index.ts";
import { commitOf, reportPath, schemaAt, versionOf, writeReport } from "./report.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BASELINE = join(ROOT, "test/accessibility/baseline.json");

/** The themes every case is audited in: the theme script's stored choices. */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The layouts the theme ships, as the matrix's coverage key. */
export const LAYOUTS = [
  "api",
  "changelog",
  "doc",
  "embedded",
  "guide",
  "home",
  "list",
  "not-found",
  "record",
  "search-results",
  "tutorial",
  "versions",
] as const;
export type LayoutName = (typeof LAYOUTS)[number];

/** One page state the gate audits. `site` picks which build and server it comes from. */
export interface AuditCase {
  readonly name: string;
  readonly site: "docs" | "fixtures" | "network";
  /** URL path, including the docs site's `/lateen` base and the server's mount. */
  readonly path: string;
  readonly layout: LayoutName;
  readonly lang: "en" | "fa" | "ar";
  readonly width: number;
  readonly height: number;
  readonly open?: "drawer" | "search" | "ask";
}

const DESKTOP = { width: 1280, height: 900 } as const;
const MOBILE = { width: 375, height: 800 } as const;

/**
 * The matrix. The docs site supplies the real component pages; the fixture site supplies the
 * layouts the docs site does not use, the two right-to-left locales, and a rich document page.
 * The last two cases open an overlay before the audit, so the focus and ARIA state of the drawer
 * and the search palette are part of the gate.
 */
export const CASES: readonly AuditCase[] = [
  { name: "docs home", site: "docs", path: "/lateen/", layout: "home", lang: "en", ...DESKTOP },
  { name: "docs document", site: "docs", path: "/lateen/install/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs code tabs", site: "docs", path: "/lateen/components/code-tabs/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs variables form", site: "docs", path: "/lateen/components/variables-form/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs details", site: "docs", path: "/lateen/components/details/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs table", site: "docs", path: "/lateen/components/table/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs compare", site: "docs", path: "/lateen/components/compare/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs compare narrow", site: "docs", path: "/lateen/components/compare/", layout: "doc", lang: "en", ...MOBILE },
  { name: "docs terminal", site: "docs", path: "/lateen/components/terminal/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs tabs", site: "docs", path: "/lateen/components/tabs/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs callout", site: "docs", path: "/lateen/components/callout/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs ask agent", site: "docs", path: "/lateen/ask-agent/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "docs not found", site: "docs", path: "/lateen/404.html", layout: "not-found", lang: "en", ...DESKTOP },
  { name: "fixture home", site: "fixtures", path: "/", layout: "home", lang: "en", ...DESKTOP },
  { name: "fixture showpiece", site: "fixtures", path: "/showpiece/", layout: "home", lang: "en", ...DESKTOP },
  { name: "fixture showpiece persian", site: "fixtures", path: "/fa/showpiece/", layout: "home", lang: "fa", ...DESKTOP },
  { name: "fixture showpiece arabic", site: "fixtures", path: "/ar/showpiece/", layout: "home", lang: "ar", ...DESKTOP },
  { name: "fixture showpiece mobile", site: "fixtures", path: "/showpiece/", layout: "home", lang: "en", ...MOBILE },
  { name: "fixture document", site: "fixtures", path: "/doc/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture document mobile", site: "fixtures", path: "/doc/", layout: "doc", lang: "en", ...MOBILE },
  { name: "fixture guide", site: "fixtures", path: "/guide/install/", layout: "guide", lang: "en", ...DESKTOP },
  { name: "fixture guide persian", site: "fixtures", path: "/fa/guide/install/", layout: "guide", lang: "fa", ...DESKTOP },
  { name: "fixture guide arabic", site: "fixtures", path: "/ar/guide/install/", layout: "guide", lang: "ar", ...DESKTOP },
  { name: "fixture list", site: "fixtures", path: "/books/", layout: "list", lang: "en", ...DESKTOP },
  { name: "fixture list persian", site: "fixtures", path: "/fa/books/", layout: "list", lang: "fa", ...DESKTOP },
  { name: "fixture list arabic", site: "fixtures", path: "/ar/books/", layout: "list", lang: "ar", ...DESKTOP },
  { name: "fixture record", site: "fixtures", path: "/books/a/", layout: "record", lang: "en", ...DESKTOP },
  { name: "fixture record persian", site: "fixtures", path: "/fa/books/a/", layout: "record", lang: "fa", ...DESKTOP },
  { name: "fixture record arabic", site: "fixtures", path: "/ar/books/a/", layout: "record", lang: "ar", ...DESKTOP },
  { name: "fixture embedded record", site: "fixtures", path: "/books/a/embed/", layout: "embedded", lang: "en", ...DESKTOP },
  { name: "fixture embedded record persian", site: "fixtures", path: "/fa/books/a/embed/", layout: "embedded", lang: "fa", ...DESKTOP },
  { name: "fixture embedded record arabic", site: "fixtures", path: "/ar/books/a/embed/", layout: "embedded", lang: "ar", ...DESKTOP },
  { name: "fixture embedded record mobile", site: "fixtures", path: "/books/a/embed/", layout: "embedded", lang: "en", ...MOBILE },
  { name: "fixture timeline", site: "fixtures", path: "/timeline/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture timeline persian", site: "fixtures", path: "/fa/timeline/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "fixture timeline arabic", site: "fixtures", path: "/ar/timeline/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "fixture charts", site: "fixtures", path: "/charts/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture charts persian", site: "fixtures", path: "/fa/charts/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "fixture charts arabic", site: "fixtures", path: "/ar/charts/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "fixture api", site: "fixtures", path: "/api/", layout: "api", lang: "en", ...DESKTOP },
  { name: "fixture changelog", site: "fixtures", path: "/changelog/", layout: "changelog", lang: "en", ...DESKTOP },
  { name: "fixture search results", site: "fixtures", path: "/search/", layout: "search-results", lang: "en", ...DESKTOP },
  { name: "fixture tutorial", site: "fixtures", path: "/tutorial/", layout: "tutorial", lang: "en", ...DESKTOP },
  { name: "fixture versions", site: "fixtures", path: "/versions/", layout: "versions", lang: "en", ...DESKTOP },
  { name: "fixture reports", site: "fixtures", path: "/reports/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture reports persian", site: "fixtures", path: "/fa/reports/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "fixture reports arabic", site: "fixtures", path: "/ar/reports/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "fixture cli demo", site: "fixtures", path: "/cli-demo/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture cli demo persian", site: "fixtures", path: "/fa/cli-demo/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "fixture cli demo arabic", site: "fixtures", path: "/ar/cli-demo/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "fixture cli demo mobile", site: "fixtures", path: "/cli-demo/", layout: "doc", lang: "en", ...MOBILE },
  { name: "docs cli demo", site: "docs", path: "/lateen/components/cli-demo/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture not found", site: "fixtures", path: "/404.html", layout: "not-found", lang: "en", ...DESKTOP },
  { name: "fixture persian", site: "fixtures", path: "/fa/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "fixture arabic", site: "fixtures", path: "/ar/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "fixture brand", site: "fixtures", path: "/brand/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture brand persian", site: "fixtures", path: "/fa/brand/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "fixture brand arabic", site: "fixtures", path: "/ar/brand/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "fixture refinement", site: "fixtures", path: "/refinement/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture refinement persian", site: "fixtures", path: "/fa/refinement/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "fixture refinement arabic", site: "fixtures", path: "/ar/refinement/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "fixture refinement mobile", site: "fixtures", path: "/refinement/", layout: "doc", lang: "en", ...MOBILE },
  { name: "fixture status badge", site: "fixtures", path: "/status/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "fixture status badge persian", site: "fixtures", path: "/fa/status/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "fixture status badge arabic", site: "fixtures", path: "/ar/status/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "fixture brand mobile", site: "fixtures", path: "/brand/", layout: "doc", lang: "en", ...MOBILE },
  { name: "network alpha", site: "network", path: "/alpha/", layout: "doc", lang: "en", ...DESKTOP },
  { name: "network alpha persian", site: "network", path: "/alpha/fa/", layout: "doc", lang: "fa", ...DESKTOP },
  { name: "network alpha arabic", site: "network", path: "/alpha/ar/", layout: "doc", lang: "ar", ...DESKTOP },
  { name: "network search", site: "network", path: "/alpha/search/", layout: "search-results", lang: "en", ...DESKTOP },
  { name: "network drawer open", site: "network", path: "/alpha/", layout: "doc", lang: "en", ...MOBILE, open: "drawer" },
  { name: "docs drawer open", site: "docs", path: "/lateen/install/", layout: "doc", lang: "en", ...MOBILE, open: "drawer" },
  { name: "docs search open", site: "docs", path: "/lateen/install/", layout: "doc", lang: "en", ...DESKTOP, open: "search" },
  { name: "docs ask agent open", site: "docs", path: "/lateen/install/", layout: "doc", lang: "en", ...DESKTOP, open: "ask" },
];

/** The WCAG 2.2 A and AA rules axe runs; best-practice rules are out of scope. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

/** The parts of an axe node and violation this script reads. */
export interface AxeNode {
  readonly target: ReadonlyArray<string | readonly string[]>;
}
export interface AxeViolation {
  readonly id: string;
  readonly impact?: string | null;
  readonly help: string;
  readonly helpUrl: string;
  readonly nodes: readonly AxeNode[];
}

/** One critical or serious violation on one element. */
export interface Finding {
  readonly case: string;
  readonly theme: Theme;
  readonly rule: string;
  readonly impact: "critical" | "serious";
  readonly target: string;
  readonly help: string;
  readonly helpUrl: string;
}

/** A known violation. `case: "*"` allows the element on every case, for a component used site-wide. */
export interface BaselineEntry {
  readonly case: string;
  readonly theme: Theme;
  readonly rule: string;
  readonly target: string;
}

type Keyed = Pick<Finding, "case" | "theme" | "rule" | "target">;

export function allows(entry: BaselineEntry, finding: Keyed): boolean {
  return (
    (entry.case === "*" || entry.case === finding.case) &&
    entry.theme === finding.theme &&
    entry.rule === finding.rule &&
    entry.target === finding.target
  );
}

/** The case name's substring filter, from `--only`. */
export function onlyFrom(argv: readonly string[]): string | undefined {
  const index = argv.indexOf("--only");
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value === "") throw new Error("--only needs a case name substring");
  return value;
}

export function selectCases(cases: readonly AuditCase[], only: string | undefined): readonly AuditCase[] {
  return only === undefined ? cases : cases.filter((item) => item.name.includes(only));
}

/** An axe `target` (a selector, or one selector per frame) as text for the report and baseline. */
export function selectorOf(target: AxeNode["target"]): string {
  return target.map((part) => (typeof part === "string" ? part : part.join(" >>> "))).join(" >> ");
}

const blocking = (impact: string | null | undefined): impact is "critical" | "serious" =>
  impact === "critical" || impact === "serious";

/** The critical and serious findings from one axe run. */
export function findingsFrom(item: AuditCase, theme: Theme, violations: readonly AxeViolation[]): Finding[] {
  const findings: Finding[] = [];
  for (const violation of violations) {
    const impact = violation.impact;
    if (!blocking(impact)) continue;
    for (const node of violation.nodes) {
      findings.push({
        case: item.name,
        theme,
        rule: violation.id,
        impact,
        target: selectorOf(node.target),
        help: violation.help,
        helpUrl: violation.helpUrl,
      });
    }
  }
  return findings;
}

/** Splits findings into those the baseline allows and those it does not, and finds stale entries. */
export function splitBaseline(
  findings: readonly Finding[],
  known: readonly BaselineEntry[],
): { unexpected: Finding[]; stale: BaselineEntry[] } {
  return {
    unexpected: findings.filter((finding) => !known.some((entry) => allows(entry, finding))),
    stale: known.filter((entry) => !findings.some((finding) => allows(entry, finding))),
  };
}

/** One finding in the report: every impact the gate saw, not only the two that fail it. */
export interface ReportFinding {
  readonly case: string;
  readonly theme: Theme;
  readonly rule: string;
  readonly impact: "minor" | "moderate" | "serious" | "critical";
  readonly target: string;
  readonly help: string;
  readonly helpUrl: string;
}

const REPORT_IMPACTS = ["minor", "moderate", "serious", "critical"] as const;
export type ReportImpact = (typeof REPORT_IMPACTS)[number];

/** Every finding of one axe run, moderate and minor included; a null impact is not classifiable and is left out. */
export function reportFindingsFrom(item: AuditCase, theme: Theme, violations: readonly AxeViolation[]): ReportFinding[] {
  const found: ReportFinding[] = [];
  for (const violation of violations) {
    const impact = violation.impact;
    if (impact !== "minor" && impact !== "moderate" && impact !== "serious" && impact !== "critical") continue;
    for (const node of violation.nodes) {
      found.push({
        case: item.name,
        theme,
        rule: violation.id,
        impact,
        target: selectorOf(node.target),
        help: violation.help,
        helpUrl: violation.helpUrl,
      });
    }
  }
  return found;
}

/** One keyboard or no-JavaScript journey and what it showed. */
export type JourneyTheme = Theme | "system";

export interface JourneyResult {
  readonly name: string;
  readonly theme: JourneyTheme;
  readonly result: "pass" | "fail" | "skip";
  readonly detail?: string;
}

/** The journeys the gate performs and the report names in plain words; each one is run below. */
export const JOURNEYS = [
  "open the navigation",
  "search the site",
  "change the language",
  "copy a code block",
  "ask your agent",
  "read without JavaScript",
] as const;
export type JourneyName = (typeof JOURNEYS)[number];

/** Everything the report records about one run. */
export interface A11yReportInput {
  readonly commit: string;
  readonly tools: Readonly<Record<"node" | "playwright" | "axe" | "chromium", string>>;
  readonly cases: readonly AuditCase[];
  readonly themes: readonly Theme[];
  readonly findings: readonly ReportFinding[];
  readonly known: readonly BaselineEntry[];
  readonly journeys: readonly JourneyResult[];
}

/** The report as the schema describes it, every list in a stable order and no wall-clock time. */
export function buildA11yReport(input: A11yReportInput): Readonly<Record<string, unknown>> {
  const byKey = (a: readonly string[], b: readonly string[]): number => {
    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      if (a[index] !== b[index]) return (a[index] ?? "") < (b[index] ?? "") ? -1 : 1;
    }
    return a.length - b.length;
  };
  const matrix = input.cases
    .flatMap((item) =>
      input.themes.map((theme) => ({
        case: item.name,
        site: item.site,
        path: item.path,
        layout: item.layout,
        lang: item.lang,
        theme,
        width: item.width,
        height: item.height,
        ...(item.open === undefined ? {} : { open: item.open }),
      })),
    )
    .sort((a, b) => byKey([a.case, a.theme], [b.case, b.theme]));
  const findings = [...input.findings].sort((a, b) => byKey([a.case, a.theme, a.rule, a.target], [b.case, b.theme, b.rule, b.target]));
  const known = [...input.known].sort((a, b) => byKey([a.case, a.theme, a.rule, a.target], [b.case, b.theme, b.rule, b.target]));
  const journeys = [...input.journeys].sort((a, b) => byKey([a.name, a.theme], [b.name, b.theme]));
  const count = (impact: ReportImpact) => findings.filter((finding) => finding.impact === impact).length;
  return {
    tool: "lateen/a11y-report",
    version: 1,
    commit: input.commit,
    tools: input.tools,
    rules: [...WCAG_TAGS],
    matrix,
    findings,
    known,
    journeys,
    summary: {
      states: matrix.length,
      findings: { minor: count("minor"), moderate: count("moderate"), serious: count("serious"), critical: count("critical") },
      journeys: {
        pass: journeys.filter((journey) => journey.result === "pass").length,
        fail: journeys.filter((journey) => journey.result === "fail").length,
        skip: journeys.filter((journey) => journey.result === "skip").length,
      },
    },
  };
}

/** The static server of the a11y gate is the visual runner's, so a page is served the same way in both gates. */
export { fileForRequest, startServer, type StaticServer };

function build(site: string, out: string): void {
  const bin = join(dirname(createRequire(import.meta.url).resolve("@velella/mizzen/package.json")), "bin/mizzen.js");
  const result = spawnSync(process.execPath, [bin, "build", site, "--theme", ".", "--out", out], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`mizzen build ${site} failed`);
  }
  console.log(`built ${site}`);
}

function readBaseline(file: string): readonly BaselineEntry[] {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  const known = typeof parsed === "object" && parsed !== null ? (parsed as { known?: unknown }).known : undefined;
  if (!Array.isArray(known)) throw new Error(`${file}: expected a "known" array`);
  return known as BaselineEntry[];
}

/** Reveals the island, opens the overlay, and waits for the dialog to report itself open. */
async function openOverlay(page: Page, overlay: "drawer" | "search" | "ask"): Promise<void> {
  if (overlay === "ask") {
    await page.locator("[data-search-open]").click();
    await page.locator("dialog[data-search][open]").waitFor({ state: "visible" });
    await page.locator(`#${SEARCH_INPUT_ID}`).fill("install theme");
    await page.locator("[data-ask-agent-open]").waitFor({ state: "visible" });
    await page.locator("[data-ask-agent-open]").click();
    await page.locator(".ask-agent-panel").waitFor({ state: "visible" });
    return;
  }
  const trigger = overlay === "drawer" ? "[data-drawer-open]" : "[data-search-open]";
  await page.locator(trigger).click();
  await page.locator(`dialog[data-${overlay}][open]`).waitFor({ state: "visible" });
}

/** Fails unless `selector` is the focused element. */
async function expectFocus(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((value) => document.activeElement === document.querySelector(value), selector);
}

/**
 * The themes a journey is actually run in. The no-JavaScript page has no theme script and no stored
 * choice, so it follows the browser's own scheme; that run is reported as `system` and is never
 * duplicated as a light or dark row that was not executed.
 */
export function journeyThemes(name: JourneyName): readonly JourneyTheme[] {
  return name === "read without JavaScript" ? ["system"] : THEMES;
}

/** Focuses a control with the keyboard's focus model and fails unless it is the active element. */
async function focusControl(page: Page, selector: string) {
  const control = page.locator(selector).first();
  await control.waitFor({ state: "visible" });
  await control.focus();
  await expectFocus(page, selector);
  return control;
}

/**
 * One keyboard or no-JavaScript journey. Every interactive step starts from keyboard focus and an
 * Enter or Space key press; the test never calls `click()`, so a pointer-only control would fail.
 * Each journey runs in its own context so the page it visits or the clipboard permission it needs
 * cannot change the audit's state; a failed step is reported with its message rather than stopping
 * the rest of the matrix.
 */
async function runJourney(
  browser: Browser,
  servers: Readonly<Record<"docs" | "fixtures" | "network", StaticServer>>,
  name: JourneyName,
  theme: JourneyTheme,
): Promise<JourneyResult> {
  const noScript = name === "read without JavaScript";
  const context = await browser.newContext({
    viewport: noScript ? { width: 1280, height: 900 } : name === "open the navigation" ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    ...(noScript ? { javaScriptEnabled: false } : {}),
  });
  if (name === "copy a code block" || name === "ask your agent") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  try {
    if (!noScript) {
      await context.addInitScript(
        ({ key, value }: { key: string; value: string }) => {
          (globalThis as unknown as { localStorage: { setItem(name: string, text: string): void } }).localStorage.setItem(key, value);
        },
        { key: THEME_KEY, value: theme },
      );
    }
    const page = await context.newPage();
    if (name === "open the navigation") {
      await page.goto(`${servers.docs.url}/lateen/install/`, { waitUntil: "load" });
      await focusControl(page, "[data-drawer-open]");
      await page.keyboard.press("Enter");
      await page.locator("dialog[data-drawer][open]").waitFor({ state: "visible" });
      if ((await page.locator("[data-drawer-open]").getAttribute("aria-expanded")) !== "true") {
        throw new Error("the navigation trigger does not say it is expanded");
      }
      await page.waitForFunction(() => document.activeElement?.closest("dialog[data-drawer]") !== null);
      await page.keyboard.press("Escape");
      await page.locator("dialog[data-drawer][open]").waitFor({ state: "hidden" });
      await expectFocus(page, "[data-drawer-open]");
    } else if (name === "search the site") {
      await page.goto(`${servers.docs.url}/lateen/install/`, { waitUntil: "load" });
      await focusControl(page, "[data-search-open]");
      await page.keyboard.press("Enter");
      await page.locator("dialog[data-search][open]").waitFor({ state: "visible" });
      await expectFocus(page, `#${SEARCH_INPUT_ID}`);
      await page.keyboard.type("install");
      await page.locator("[role='option']").first().waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await page.locator("dialog[data-search][open]").waitFor({ state: "hidden" });
      await expectFocus(page, "[data-search-open]");
    } else if (name === "change the language") {
      await page.goto(`${servers.fixtures.url}/fa/`, { waitUntil: "load" });
      await focusControl(page, "[data-language-switcher] a[hreflang='ar']");
      await page.keyboard.press("Enter");
      await page.waitForURL((url) => url.pathname === "/ar/");
      if ((await page.locator("html").getAttribute("lang")) !== "ar") throw new Error("the Arabic page did not set lang");
    } else if (name === "copy a code block") {
      await page.goto(`${servers.docs.url}/lateen/components/code/`, { waitUntil: "load" });
      await focusControl(page, ".code-copy");
      await page.keyboard.press("Space");
      await page.waitForFunction(() => (document.querySelector(".code-copy-status")?.textContent ?? "") !== "");
      const status = page.locator(".code-copy-status").first();
      if ((await status.textContent())?.trim() === "") throw new Error("the copy control said nothing");
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      if (copied.trim() === "") throw new Error("the clipboard is empty after a copy");
      await expectFocus(page, ".code-copy");
    } else if (name === "ask your agent") {
      await page.goto(`${servers.docs.url}/lateen/install/`, { waitUntil: "load" });
      await focusControl(page, "[data-search-open]");
      await page.keyboard.press("Enter");
      await page.locator("dialog[data-search][open]").waitFor({ state: "visible" });
      await expectFocus(page, `#${SEARCH_INPUT_ID}`);
      await page.keyboard.type("install theme");
      await page.locator("[data-ask-agent-open]").waitFor({ state: "visible" });
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Enter");
      await page.locator(".ask-agent-panel").waitFor({ state: "visible" });
      await page.waitForFunction(() => document.activeElement?.closest(".ask-agent-panel") !== null);
      await focusControl(page, ".ask-agent-copy");
      await page.keyboard.press("Space");
      await page.waitForFunction(() => (document.querySelector(".ask-agent-status")?.textContent ?? "") !== "");
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      if (!copied.includes("install theme")) throw new Error("the copied prompt does not carry the question");
      await page.keyboard.press("Escape");
      await page.locator("dialog[data-search][open]").waitFor({ state: "hidden" });
      await expectFocus(page, "[data-search-open]");
    } else {
      await page.goto(`${servers.docs.url}/lateen/install/`, { waitUntil: "load" });
      const article = page.locator("article");
      await article.waitFor({ state: "visible" });
      if (!((await article.textContent()) ?? "").includes("Install")) throw new Error("the prose is missing without JavaScript");
      if ((await page.locator(".code-copy").count()) !== 0) throw new Error("a copy control appeared without its island");
      if ((await page.locator("[data-search-open]").getAttribute("hidden")) === null) {
        throw new Error("the search trigger is visible without its island");
      }
    }
    return { name, theme, result: "pass" };
  } catch (error) {
    return { name, theme, result: "fail", detail: (error as Error).message };
  } finally {
    await context.close();
  }
}

/** Every journey in the themes it actually runs in, in the report's order. */
export async function runJourneys(
  browser: Browser,
  servers: Readonly<Record<"docs" | "fixtures" | "network", StaticServer>>,
): Promise<JourneyResult[]> {
  const results: JourneyResult[] = [];
  for (const name of JOURNEYS) {
    for (const theme of journeyThemes(name)) results.push(await runJourney(browser, servers, name, theme));
  }
  return results;
}

/** The shipped optional-font files, whatever hashed folder the build wrote them to. */
const THEME_FONT = /\/assets\/theme\/fonts\/(?:geist|geist-mono)\//;

/** The woff2 files a page actually requests, including the ones its preload links start. */
async function fontRequests(browser: Browser, url: string): Promise<string[]> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const fonts = new Set<string>();
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.endsWith(".woff2")) fonts.add(path);
    });
    await page.goto(url, { waitUntil: "networkidle" });
    return [...fonts].sort();
  } finally {
    await context.close();
  }
}

/**
 * Records the font requests of a custom-font page and of a page without custom fonts. The first must
 * request none of the shipped Geist or Geist Mono files and at least one of its own; the second must
 * still request a shipped file, which proves the default preloads were not removed for everyone.
 * Returns a failure sentence, or `undefined` when both hold.
 */
export async function checkFontPreloads(
  browser: Browser,
  servers: Readonly<Record<"docs" | "fixtures" | "network", StaticServer>>,
): Promise<string | undefined> {
  const custom = await fontRequests(browser, `${servers.fixtures.url}/brand/`);
  const shipped = custom.filter((path) => THEME_FONT.test(path));
  if (shipped.length > 0) return `a custom-font page still requested ${shipped.join(", ")}`;
  if (!custom.some((path) => path.startsWith("/fonts/example-"))) {
    return `a custom-font page requested none of its own fonts (${custom.join(", ") || "none"})`;
  }
  const defaults = await fontRequests(browser, `${servers.docs.url}/lateen/install/`);
  if (!defaults.some((path) => THEME_FONT.test(path))) return "a page without custom fonts requested none of the shipped fonts it preloads";
  return undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const only = onlyFrom(argv);
  const reportFile = reportPath(argv);
  const cases = selectCases(CASES, only);
  if (cases.length === 0) throw new Error("no case matches --only; see CASES in scripts/test-a11y.ts");

  build("site", ".mizzen/a11y/docs");
  build("test/accessibility/fixtures/site", ".mizzen/a11y/fixtures");
  build("test/accessibility/fixtures/network", ".mizzen/a11y/network");

  const servers = {
    docs: await startServer(join(ROOT, ".mizzen/a11y/docs"), "/lateen"),
    fixtures: await startServer(join(ROOT, ".mizzen/a11y/fixtures"), ""),
    network: await startServer(join(ROOT, ".mizzen/a11y/network"), "/alpha"),
  };
  let browser: Browser | undefined;
  let chromiumVersion = "unknown";
  const findings: Finding[] = [];
  const reported: ReportFinding[] = [];
  let journeys: JourneyResult[] = [];
  try {
    browser = await chromium.launch();
    chromiumVersion = browser.version();
    for (const item of cases) {
      for (const theme of THEMES) {
        const context = await browser.newContext({ viewport: { width: item.width, height: item.height } });
        try {
          await context.addInitScript(
            ({ key, value }: { key: string; value: string }) => {
              (globalThis as unknown as { localStorage: { setItem(name: string, text: string): void } }).localStorage.setItem(key, value);
            },
            { key: THEME_KEY, value: theme },
          );
          const page = await context.newPage();
          const response = await page.goto(`${servers[item.site].url}${item.path}`, { waitUntil: "load" });
          if (response === null || response.status() !== 200) {
            throw new Error(`${item.name}: ${item.path} did not load (HTTP ${response?.status() ?? "none"})`);
          }
          const html = page.locator("html");
          if ((await html.getAttribute("lang")) !== item.lang) {
            throw new Error(`${item.name}: expected lang ${item.lang}, got ${await html.getAttribute("lang")}`);
          }
          if ((await html.getAttribute("data-theme")) !== theme) {
            throw new Error(`${item.name}: expected the ${theme} theme, got ${await html.getAttribute("data-theme")}`);
          }
          if (item.open !== undefined) await openOverlay(page, item.open);
          await page.evaluate(async () => {
            const fonts = (globalThis as unknown as { document?: { fonts?: Promise<unknown> } }).document?.fonts;
            if (fonts !== undefined) await fonts;
          });
          const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
          findings.push(...findingsFrom(item, theme, results.violations));
          reported.push(...reportFindingsFrom(item, theme, results.violations));
        } finally {
          await context.close();
        }
      }
    }
    journeys = await runJourneys(browser, servers);
    const fontProblem = await checkFontPreloads(browser, servers);
    if (fontProblem !== undefined) throw new Error(`font preloads: ${fontProblem}`);
    console.log("font preloads: custom fonts suppress the shipped preloads; default pages keep them");
  } finally {
    await browser?.close();
    await servers.docs.close();
    await servers.fixtures.close();
    await servers.network.close();
  }

  const known = readBaseline(BASELINE);
  if (reportFile !== undefined) {
    const report = buildA11yReport({
      commit: commitOf(),
      tools: {
        node: process.version,
        playwright: versionOf("playwright"),
        axe: versionOf("axe-core"),
        chromium: chromiumVersion,
      },
      cases,
      themes: THEMES,
      findings: reported,
      known,
      journeys,
    });
    writeReport(reportFile, schemaAt("a11y-report.schema.json"), report);
  }
  const failedJourneys = journeys.filter((journey) => journey.result !== "pass");
  for (const journey of failedJourneys) {
    console.warn(`warn: journey "${journey.name}" (${journey.theme}) ${journey.result}: ${journey.detail ?? ""}`);
  }

  const { unexpected, stale } = splitBaseline(findings, known);
  // A filtered run sees only part of the matrix, so it cannot tell which entries are stale.
  if (only === undefined && stale.length > 0) {
    console.warn(
      `warn: ${stale.length} baseline entr${stale.length === 1 ? "y is" : "ies are"} no longer needed; remove them from test/accessibility/baseline.json`,
    );
  }
  if (unexpected.length > 0) {
    for (const finding of unexpected) {
      console.error(
        `  ${finding.case} (${finding.theme}) [${finding.impact}] ${finding.rule} at ${finding.target}\n` +
          `    ${finding.help}\n    ${finding.helpUrl}`,
      );
    }
    console.error(`FAIL: ${unexpected.length} new critical or serious accessibility violation${unexpected.length === 1 ? "" : "s"}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `OK: ${cases.length * THEMES.length} page states, 0 new critical or serious violations ` +
      `(${findings.length} findings, all listed in test/accessibility/baseline.json); ` +
      `${journeys.filter((journey) => journey.result === "pass").length} of ${journeys.length} journeys passed`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
