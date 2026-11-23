import assert from "node:assert/strict";
import type { Page } from "playwright";

/**
 * The public acceptance cases: one small, data-driven Playwright check per shipped feature.
 *
 * Every case builds against the acceptance site as a consumer sees it — the theme is installed
 * from the packed tarball, the site names it in `theme.name`, and the installed `mizzen` command
 * builds it — so a case cannot pass by reaching into the repository checkout.
 */

/** One visible expectation on a page. Count zero means the selector must not exist. */
export interface Expectation {
  readonly selector: string;
  /** Exact number of matching elements. Omitted: at least one. */
  readonly count?: number;
  /** The element's text must contain this text. */
  readonly text?: string;
  /** The first element's `href` must contain this text. */
  readonly hrefIncludes?: string;
  /** Count hidden elements too. Default `false`, so a case sees what a reader sees. */
  readonly visible?: boolean;
}

/** One interaction, run before the post-action expectations. */
export interface Action {
  readonly selector: string;
  /** Fill the matching input with this text. */
  readonly fill?: string;
  /** Click the matching element. */
  readonly click?: true;
}

/** One executable acceptance case. */
export interface AcceptanceCase {
  /** The name the feature ledger references. */
  readonly name: string;
  /** URL path on the built acceptance site. */
  readonly path: string;
  /** Expectations checked before the action. */
  readonly expect: readonly Expectation[];
  /** The action that proves the feature works, if any. */
  readonly action?: Action;
  /** Expectations checked after the action. */
  readonly after?: readonly Expectation[];
  readonly javaScript?: boolean;
  readonly verify?: (page: Page) => Promise<void>;
}

export const CASES: readonly AcceptanceCase[] = [
  {
    name: "page-tools",
    path: "/page-tools/",
    expect: [{ selector: "[data-page-tool] input", count: 1 }],
    action: { selector: "[data-page-tool] input", fill: "hello from the tool" },
    after: [{ selector: "[data-page-tool-out]", text: "hello from the tool" }],
  },
  {
    name: "math",
    path: "/math/",
    expect: [
      { selector: 'math[display="inline"]', count: 2 },
      { selector: 'math[display="block"]', count: 1 },
      { selector: 'math[display="block"]', text: "ab=c" },
    ],
  },
  {
    name: "gallery",
    path: "/gallery/",
    expect: [
      { selector: ".gallery-item", count: 2 },
      { selector: ".gallery-facet", count: 1 },
    ],
    action: { selector: 'a[data-gallery-filter][data-gallery-value="Ada"]', click: true },
    after: [{ selector: ".gallery-item", count: 1 }],
  },
  {
    name: "report-issue",
    path: "/report-issue/",
    expect: [{ selector: ".doc-tools > summary" }],
    action: { selector: ".doc-tools > summary", click: true },
    after: [{ selector: '.doc-tools a:text-is("Report a problem with this page")', hrefIncludes: "/issues/new?title=" }],
  },
  {
    name: "blog",
    path: "/blog/archive/",
    expect: [
      { selector: ".blog-item", count: 2 },
      { selector: ".blog-item-title a", text: "A newer post" },
      { selector: "time[datetime]", text: "10 March 2026" },
    ],
  },
  {
    name: "versions",
    path: "/versions/",
    expect: [
      { selector: ".versions-item", count: 3 },
      { selector: 'a[href="/v1/"]', count: 1 },
    ],
  },
  {
    name: "overrides",
    path: "/overrides/",
    expect: [
      { selector: ".overrides-probe", count: 1 },
      { selector: ".overrides-probe", text: "Site guides" },
    ],
  },
  {
    name: "api-reference",
    path: "/reference/ping/",
    expect: [
      { selector: ".api-reference-method", text: "GET" },
      { selector: ".api-reference-path", text: "/ping" },
      { selector: ".api-reference-status", text: "200" },
    ],
  },
  {
    name: "code-annotations",
    path: "/annotations/",
    expect: [
      { selector: ".code-title", text: "answer.ts" },
      { selector: "pre.code .highlighted", count: 1 },
      { selector: "details.code-annotations summary", text: "Annotations (1)" },
    ],
    action: { selector: "details.code-annotations summary", click: true },
    after: [{ selector: "details.code-annotations a", hrefIncludes: "-line-2" }],
  },
  {
    name: "check-report-run",
    path: "/checks/runs/after/",
    javaScript: false,
    expect: [
      { selector: "[data-report-view=run] tbody", text: "Unknown" },
      { selector: "[data-report-view=run] tbody", text: "The sample has no recorded signature result." },
    ],
    async verify(page) {
      const download = page.getByRole("link", { name: "Download report data (JSON)" });
      const href = await download.getAttribute("href");
      assert(href);
      const response = await page.request.get(new URL(href, page.url()).href);
      assert.equal(response.ok(), true);
      const report = await response.json();
      assert.equal(report.runs.find((run: { id: string }) => run.id === "after").findings[0].severity, "unknown");
      const real = report.runs.find((run: { id: string }) => run.id === "installed-run");
      assert(real.checks.some((check: { id: string }) => check.id === "content"));
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.getByRole("table", { name: "Recorded findings" }).isVisible(), true);
    },
  },
  {
    name: "check-report-comparison",
    path: "/checks/compare/before/after/",
    javaScript: false,
    expect: [{ selector: "[data-report-view=comparison] tbody", text: "Resolved" }],
    async verify(page) {
      const before = page.getByRole("link", { name: "Before: before" });
      await before.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL("**/checks/runs/before/");
      assert.equal(await page.getByText("The guide points to a removed page.").isVisible(), true);
      await page.goto(new URL("/checks/compare/after/partial/", page.url()).href);
      assert.equal(await page.getByText("At least one run has incomplete coverage.", { exact: false }).isVisible(), true);
      assert.equal(await page.getByRole("table", { name: "Finding comparison" }).count(), 0);
    },
  },
  {
    name: "check-report-trend",
    path: "/checks/",
    javaScript: false,
    expect: [{ selector: "[data-report-view=overview] .line-chart" }],
    async verify(page) {
      const chart = page.locator("figure").filter({ hasText: "HTML size (KiB)" });
      const table = chart.getByRole("table");
      await chart.locator("summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await table.getByRole("cell", { name: "35" }).isVisible(), true, "Enter reveals the metric value");
      assert.equal(await table.getByRole("cell", { name: "No value" }).isVisible(), true, "Missing measurements remain visible in the table");
      await page.keyboard.press("Enter");
      await page.emulateMedia({ media: "print" });
      assert.equal(await table.isVisible(), true, "The trend table prints from a closed disclosure");
    },
  },
];
