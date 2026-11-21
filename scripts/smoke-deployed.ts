// The post-deployment smoke gate: visits the public site after a deploy, at desktop and mobile
// widths in light and dark, and fails on console errors, uncaught page errors, failed same-origin
// requests, same-origin responses of 400 or more (except the deliberate 404 document), and URLs
// outside the deployed base path. It also exercises navigation, theme persistence, search, and the
// copy control. The JSON report records the deployed commit and is uploaded by the deploy workflow.
//
// Usage: node scripts/smoke-deployed.ts --base https://velella.sh/lateen/ --commit "$GITHUB_SHA"
// Setup: npx playwright install chromium; the deploy writes deploy-commit.txt at the site root so
// this gate waits for its own commit at the edge before it audits anything.
import { chromium, type Browser, type Page } from "playwright";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { reportPath, root, schemaAt, writeReport } from "./report.ts";

export const REPORT_FILE = join(root, "test/smoke/out/deployed.json");

export type DeployedViewport = "desktop" | "mobile";
export type DeployedScheme = "light" | "dark";
export type DeployedCheck = "copy" | "navigation" | "search" | "theme";

/** The public routes the deploy gate visits. The not-found route is the one expected to be 404. */
export interface DeployedCase {
  readonly name: string;
  readonly path: string;
  readonly status: number;
  readonly checks: readonly DeployedCheck[];
  readonly notFound?: boolean | undefined;
}

export const DEPLOYED_CASES: readonly DeployedCase[] = [
  { name: "home", path: "/", status: 200, checks: ["theme", "navigation"] },
  { name: "components", path: "/components/", status: 200, checks: ["copy"] },
  { name: "search", path: "/search/?q=install", status: 200, checks: ["search"] },
  { name: "changelog", path: "/changelog/", status: 200, checks: [] },
  { name: "data", path: "/books/alpha/", status: 200, checks: [] },
  { name: "not found", path: "/this-page-does-not-exist/", status: 404, checks: [], notFound: true },
];

export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;

export const SCHEMES: readonly DeployedScheme[] = ["light", "dark"];

/** The `--base` value: an https URL, normalized to a trailing slash so every route joins it cleanly. */
export function deployedBase(value: string | undefined): string {
  if (value === undefined) throw new Error("--base <https URL> is required");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`the base is not a URL: ${value}`);
  }
  if (url.protocol !== "https:") throw new Error(`the base must be https: ${value}`);
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

/** A commit the report can name: 7-40 lowercase hex characters. */
export function isCommit(value: string): boolean {
  return /^[0-9a-f]{7,40}$/.test(value);
}

/** The `--commit` value, or the CI variable when the flag is absent. */
export function commitFrom(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const index = argv.indexOf("--commit");
  const given = index === -1 ? undefined : argv[index + 1];
  if (index !== -1 && (given === undefined || given.trim() === "" || given.startsWith("--"))) {
    throw new Error("--commit needs a sha");
  }
  const commit = given ?? env.LATEN_COMMIT ?? env.GITHUB_SHA;
  if (commit === undefined) throw new Error("--commit <sha> is required (or set GITHUB_SHA or LATEN_COMMIT)");
  if (!isCommit(commit)) throw new Error(`the commit must be 7-40 lowercase hex characters: ${JSON.stringify(commit)}`);
  return commit;
}

/** The stamp the deploy writes at the site root, so the gate waits for its own commit at the edge. */
export const DEPLOYED_COMMIT_FILE = "deploy-commit.txt";

/** How long the Pages edge may still serve the previous deployment after `deploy-pages` reports success. */
export const DEPLOY_WAIT_MS = 180_000;
const DEPLOY_POLL_MS = 2_000;

/**
 * Waits until the public site reports this commit. `deploy-pages` resolves before the edge serves the
 * new files, so without this wait the smoke test can audit the previous deployment and fail on a
 * difference that no longer exists.
 */
export async function waitForCommit(
  base: string,
  commit: string,
  read: (url: string) => Promise<string> = async (url) => {
    const response = await fetch(url);
    return response.ok ? response.text() : "";
  },
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  waitMs = DEPLOY_WAIT_MS,
): Promise<void> {
  const url = new URL(DEPLOYED_COMMIT_FILE, base).toString();
  const started = Date.now();
  for (;;) {
    const stamp = await read(url).catch(() => "");
    if (stamp.trim() === commit) return;
    if (Date.now() - started + DEPLOY_POLL_MS > waitMs) {
      throw new Error(`the deployed site did not serve commit ${commit} within ${Math.round(waitMs / 1000)}s`);
    }
    await pause(DEPLOY_POLL_MS);
  }
}

/** True for a URL on the base's origin. Unparseable and non-http URLs are never same-origin. */
export function sameOrigin(url: string, base: string): boolean {
  try {
    return new URL(url, base).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** True for a same-origin URL inside the deployed base path, so a missing base prefix is caught. */
export function withinBase(url: string, base: string): boolean {
  try {
    const target = new URL(url, base);
    const root = new URL(base);
    if (target.origin !== root.origin) return false;
    const path = root.pathname.endsWith("/") ? root.pathname.slice(0, -1) : root.pathname;
    return target.pathname === path || target.pathname.startsWith(`${path}/`);
  } catch {
    return false;
  }
}

/** A route under the deployed base: `/components/` joins `/lateen/` as `/lateen/components/`. */
export function deployedRoute(path: string, base: string): string {
  return new URL(path.replace(/^\/+/, ""), base).href;
}

/** A same-origin URL outside the base path; external URLs are not this gate's business. */
export function baseFailure(url: string, base: string): string | undefined {
  if (!sameOrigin(url, base) || withinBase(url, base)) return undefined;
  return `${url} is outside the deployed base ${base}`;
}

/** A failed request. A same-origin request must load; a navigation's cancelled request is not a failure. */
export function requestFailure(url: string, errorText: string, base: string): string | undefined {
  const outside = baseFailure(url, base);
  if (outside !== undefined) return outside;
  if (!sameOrigin(url, base) || errorText === "net::ERR_ABORTED") return undefined;
  return `request failed: ${url}: ${errorText}`;
}

/** A response of 400 or more, with the expected 404 document as the one exception. */
export function responseFailure(
  url: string,
  status: number,
  base: string,
  expectedStatus = 200,
  document = false,
): string | undefined {
  const outside = baseFailure(url, base);
  if (outside !== undefined) return outside;
  if (!sameOrigin(url, base) || status < 400) return undefined;
  if (document && status === expectedStatus) return undefined;
  return `HTTP ${status} ${url}`;
}

export interface DeployedResult {
  readonly name: string;
  readonly path: string;
  readonly viewport: DeployedViewport;
  readonly scheme: DeployedScheme;
  readonly status: number;
  readonly ok: boolean;
  readonly error?: string | undefined;
}

export interface DeployedReportInput {
  readonly base: string;
  readonly commit: string;
  readonly cases: readonly DeployedResult[];
}

/** The report in execution order: routes, then desktop before mobile, light before dark. */
export function buildDeployedReport(input: DeployedReportInput): Readonly<Record<string, unknown>> {
  return {
    tool: "lateen/deployed-smoke",
    version: 1,
    base: input.base,
    commit: input.commit,
    ok: input.cases.every((item) => item.ok),
    cases: input.cases.map((item) => ({
      name: item.name,
      path: item.path,
      viewport: item.viewport,
      scheme: item.scheme,
      status: item.status,
      ok: item.ok,
      ...(item.error === undefined ? {} : { error: item.error }),
    })),
  };
}

/** The theme the page actually applied, read from the attribute the toggle writes. */
function themeOf(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.getAttribute("data-theme") ?? "");
}

/** Press the toggle until `data-theme` changes, then reload and require the change to persist. */
async function checkTheme(page: Page, fail: (message: string) => void): Promise<void> {
  const button = page.locator("[data-theme-toggle] .theme-toggle-button").first();
  await button.waitFor({ state: "visible", timeout: 15000 });
  const before = await themeOf(page);
  let after = before;
  for (let press = 0; press < 3 && after === before; press += 1) {
    await button.click();
    after = await themeOf(page);
  }
  if (after === before) {
    fail(`the theme toggle did not change data-theme from ${JSON.stringify(before)}`);
    return;
  }
  await page.reload({ waitUntil: "networkidle" });
  const persisted = await themeOf(page);
  if (persisted !== after) {
    fail(`the theme did not persist: ${JSON.stringify(after)} before reload, ${JSON.stringify(persisted)} after`);
  }
}

/** Follow the visible Components link (the header's, or the home hero's on mobile) and require its URL. */
async function checkNavigation(page: Page, fail: (message: string) => void): Promise<void> {
  const link = page.locator('a[href$="/components/"]:visible, a[href="components/"]:visible').first();
  try {
    await link.waitFor({ state: "visible", timeout: 15000 });
    await link.click();
    await page.waitForURL((url) => url.pathname.endsWith("/components/"), { timeout: 15000 });
  } catch {
    fail("the Components navigation link did not open /components/");
  }
}

/** Type a query into the results page's field and require at least one result link. */
async function checkSearch(page: Page, fail: (message: string) => void): Promise<void> {
  // The dialog repeats the same attributes; the results page names its own field and list.
  const root = page.locator("[data-search-page]").first();
  const input = root.locator("[data-search-input]").first();
  const link = root.locator("a.search-results-link").first();
  try {
    await input.waitFor({ state: "visible", timeout: 15000 });
    await input.fill("install");
    await input.press("Enter");
    await link.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    fail("search for install showed no result link");
  }
}

/** Click a visible copy control and require its status to show the page's copied label. */
async function checkCopy(page: Page, fail: (message: string) => void): Promise<void> {
  const button = page.locator(".code-copy:visible").first();
  try {
    await button.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    fail("the components page has no copy control");
    return;
  }
  const template = page.locator("[data-code-copy]").first();
  const label =
    (await template.count()) === 0 ? "Copied" : ((await template.getAttribute("data-copied"))?.trim() || "Copied");
  await button.click();
  try {
    await page.waitForFunction(
      (copied) =>
        Array.from(document.querySelectorAll(".code-copy-status")).some((node) => node.textContent?.trim() === copied),
      label,
      { timeout: 5000 },
    );
  } catch {
    fail(`the copy control did not show ${JSON.stringify(label)}`);
  }
}

/** A 404 document's own network line is the expected outcome, not a page console error. */
function isExpectedNotFoundConsole(text: string, notFound: boolean | undefined): boolean {
  return notFound === true && /Failed to load resource.*\b404\b/.test(text);
}

async function auditCase(
  browser: Browser,
  base: string,
  item: DeployedCase,
  viewport: DeployedViewport,
  size: { readonly width: number; readonly height: number },
  scheme: DeployedScheme,
): Promise<DeployedResult> {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    colorScheme: scheme,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const errors: string[] = [];
  const fail = (message: string): void => {
    if (!errors.includes(message)) errors.push(message);
  };
  let status = 0;
  try {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (!isExpectedNotFoundConsole(text, item.notFound)) fail(`console error: ${text}`);
    });
    page.on("pageerror", (error) => fail(`page error: ${error.message}`));
    page.on("request", (request) => {
      const failure = baseFailure(request.url(), base);
      if (failure !== undefined) fail(failure);
    });
    page.on("requestfailed", (request) => {
      const failure = requestFailure(request.url(), request.failure()?.errorText ?? "failed", base);
      if (failure !== undefined) fail(failure);
    });
    page.on("response", (response) => {
      const isDocument = response.request().isNavigationRequest() && response.frame() === page.mainFrame();
      const failure = responseFailure(response.url(), response.status(), base, item.status, isDocument);
      if (failure !== undefined) fail(failure);
    });

    const response = await page.goto(deployedRoute(item.path, base), { waitUntil: "networkidle", timeout: 30000 });
    status = response?.status() ?? 0;
    if (response === null) fail("the route returned no response");
    else if (status !== item.status) fail(`expected HTTP ${item.status}, got ${status}`);

    if (item.notFound === true) {
      const heading = page.locator(".not-found h1").first();
      try {
        await heading.waitFor({ state: "visible", timeout: 10000 });
        if ((await heading.textContent())?.trim() === "") fail("the not-found page rendered an empty heading");
      } catch {
        fail("the 404 response did not render the not-found page");
      }
    }

    for (const check of item.checks) {
      if (check === "theme") await checkTheme(page, fail);
      if (check === "navigation") await checkNavigation(page, fail);
      if (check === "search") await checkSearch(page, fail);
      if (check === "copy") await checkCopy(page, fail);
    }
  } catch (error) {
    fail((error as Error).message);
  } finally {
    await context.close();
  }
  return {
    name: item.name,
    path: item.path,
    viewport,
    scheme,
    status,
    ok: errors.length === 0,
    ...(errors[0] === undefined ? {} : { error: errors[0] }),
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const baseIndex = argv.indexOf("--base");
  if (baseIndex === -1) throw new Error("--base <https URL> is required");
  const base = deployedBase(argv[baseIndex + 1]);
  const commit = commitFrom(argv);
  const file = reportPath(argv) ?? REPORT_FILE;
  await waitForCommit(base, commit);

  let browser: Browser | undefined;
  const cases: DeployedResult[] = [];
  try {
    browser = await chromium.launch();
    for (const item of DEPLOYED_CASES) {
      for (const viewport of VIEWPORTS) {
        for (const scheme of SCHEMES) {
          cases.push(await auditCase(browser, base, item, viewport.name, viewport, scheme));
        }
      }
    }
  } finally {
    await browser?.close();
  }

  writeReport(file, schemaAt("deployed-smoke.schema.json"), buildDeployedReport({ base, commit, cases }));

  const failed = cases.filter((item) => !item.ok);
  if (failed.length > 0) {
    for (const item of failed) console.error(`FAIL: ${item.name} (${item.path}) ${item.viewport} ${item.scheme}: ${item.error ?? "failed"}`);
    console.error(`FAIL: ${failed.length} of ${cases.length} deployed visits failed`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${cases.length} deployed visits at ${base} on ${commit}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
