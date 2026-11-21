// The production-build browser smoke gate: builds the docs site and the fixtures that carry data,
// blog, API, search, and versioned routes, serves the built folders, and visits one route per
// feature in Chromium. A console error, an uncaught page error, a failed or 4xx/5xx same-origin
// request, or an external request outside EXTERNAL_HOSTS fails the run. The JSON report is written
// to test/smoke/out/report.json and uploaded by CI as evidence.
//
// Setup: npm ci && npx playwright install chromium   (add --with-deps on Linux CI)
// Usage: npm run test:smoke
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { startServer, type StaticServer } from "../visual/index.ts";
import { commitOf, versionOf } from "./report.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const REPORT_FILE = join(ROOT, "test/smoke/out/report.json");

/** The builds the smoke gate serves, including the two-release fixture with real `/v1/` and `/v2/` pages. */
const SITES = {
  docs: { source: "site", out: join(ROOT, ".mizzen/smoke/docs"), mount: "/lateen" },
  fixtures: { source: "test/accessibility/fixtures/site", out: join(ROOT, ".mizzen/smoke/fixtures"), mount: "" },
  blog: { source: "fixtures/blog", out: join(ROOT, ".mizzen/smoke/blog"), mount: "" },
  versions: { source: "fixtures/docs-versions-theme", out: join(ROOT, ".mizzen/smoke/versions"), mount: "" },
} as const;

export type SmokeSite = keyof typeof SITES;
export type SmokeCategory = "documentation" | "data" | "blog" | "api" | "search" | "versioned";

export interface SmokeCase {
  readonly name: string;
  readonly site: SmokeSite;
  readonly category: SmokeCategory;
  readonly path: string;
}

/** One real built route per feature, plus the documentation page for the data explorer component. */
export const CASES: readonly SmokeCase[] = [
  { name: "docs home", site: "docs", category: "documentation", path: "/lateen/" },
  { name: "docs install", site: "docs", category: "documentation", path: "/lateen/install/" },
  { name: "docs data explorer", site: "docs", category: "data", path: "/lateen/components/data-explorer/" },
  { name: "fixture data explorer", site: "fixtures", category: "data", path: "/explorer/" },
  { name: "fixture blog post", site: "blog", category: "blog", path: "/blog/newer/" },
  { name: "fixture api", site: "fixtures", category: "api", path: "/api/" },
  { name: "fixture search", site: "fixtures", category: "search", path: "/search/?q=install" },
  { name: "fixture versions index", site: "fixtures", category: "versioned", path: "/versions/" },
  { name: "fixture versioned page", site: "versions", category: "versioned", path: "/v1/guide/install/" },
];

/**
 * The only external hosts a smoke page may request. These routes request none; a new third-party
 * asset must be added here with its reason, never ignored globally.
 */
export const EXTERNAL_HOSTS: readonly string[] = [];

export type SmokeFailureKind = "console" | "external" | "page" | "request" | "response";

export interface SmokeFailure {
  readonly kind: SmokeFailureKind;
  readonly detail: string;
}

export type SmokeEvent =
  | { readonly kind: "console"; readonly text: string }
  | { readonly kind: "page"; readonly message: string }
  | { readonly kind: "external"; readonly url: string }
  | { readonly kind: "request"; readonly url: string; readonly errorText: string }
  | { readonly kind: "response"; readonly url: string; readonly status: number };

export function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url, origin).origin === origin;
  } catch {
    return false;
  }
}

/** True for a hostname the run explicitly allows, and never for a same-origin request. */
export function externalAllowed(url: string, origin: string, allowedHosts: readonly string[] = EXTERNAL_HOSTS): boolean {
  if (sameOrigin(url, origin)) return true;
  try {
    return allowedHosts.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** One Playwright event as a failure, or `undefined` when the event is not a failure. */
export function classifySmokeEvent(
  event: SmokeEvent,
  origin: string,
  allowedHosts: readonly string[] = EXTERNAL_HOSTS,
): SmokeFailure | undefined {
  if (event.kind === "console") return { kind: "console", detail: event.text };
  if (event.kind === "page") return { kind: "page", detail: event.message };
  if (event.kind === "external") {
    return externalAllowed(event.url, origin, allowedHosts) ? undefined : { kind: "external", detail: event.url };
  }
  if (event.kind === "request") {
    if (!sameOrigin(event.url, origin)) return undefined;
    return { kind: "request", detail: `${event.url}: ${event.errorText}` };
  }
  if (!sameOrigin(event.url, origin)) return undefined;
  return event.status < 400 ? undefined : { kind: "response", detail: `${event.status} ${event.url}` };
}

const KIND_ORDER: Readonly<Record<SmokeFailureKind, number>> = {
  console: 0,
  page: 1,
  external: 2,
  request: 3,
  response: 4,
};

export function orderFailures(failures: readonly SmokeFailure[]): SmokeFailure[] {
  return [...failures].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.detail.localeCompare(b.detail));
}

export interface SmokeResult extends SmokeCase {
  readonly status: "pass" | "fail";
  readonly failures: readonly SmokeFailure[];
}

export interface SmokeReportInput {
  readonly commit: string;
  readonly tools: Readonly<Record<"node" | "playwright" | "chromium", string>>;
  readonly results: readonly SmokeResult[];
}

/** The report in a stable order: routes by name, failures by kind and detail, with no clock. */
export function buildSmokeReport(input: SmokeReportInput): Readonly<Record<string, unknown>> {
  const routes = [...input.results]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((result) => ({
      name: result.name,
      site: result.site,
      category: result.category,
      path: result.path,
      status: result.status,
      failures: orderFailures(result.failures),
    }));
  return {
    tool: "lateen/smoke-report",
    version: 1,
    commit: input.commit,
    tools: input.tools,
    routes,
    summary: {
      routes: routes.length,
      passed: routes.filter((route) => route.status === "pass").length,
      failed: routes.filter((route) => route.status === "fail").length,
      failures: routes.reduce((total, route) => total + route.failures.length, 0),
    },
  };
}

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function build(source: string, out: string): void {
  const bin = join(dirname(createRequire(import.meta.url).resolve("@velella/mizzen/package.json")), "bin/mizzen.js");
  run(process.execPath, [bin, "build", source, "--theme", ".", "--out", out]);
}

/** Writes the Pagefind index the search-results layout loads. */
function buildSearchIndex(out: string): void {
  run(join(ROOT, "node_modules/.bin/pagefind"), ["--site", out]);
}

async function auditRoute(browser: Browser, servers: Readonly<Record<SmokeSite, StaticServer>>, item: SmokeCase): Promise<SmokeResult> {
  const server = servers[item.site];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const failures: SmokeFailure[] = [];
  const seen = new Set<string>();
  const record = (failure: SmokeFailure | undefined): void => {
    if (failure === undefined) return;
    const key = `${failure.kind}\0${failure.detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    failures.push(failure);
  };
  try {
    await context.route("**/*", (route) => {
      const url = route.request().url();
      return sameOrigin(url, server.url) || externalAllowed(url, server.url, EXTERNAL_HOSTS) ? route.continue() : route.abort();
    });
    const page: Page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") record(classifySmokeEvent({ kind: "console", text: message.text() }, server.url));
    });
    page.on("pageerror", (error) => record(classifySmokeEvent({ kind: "page", message: error.message }, server.url)));
    page.on("request", (request) => record(classifySmokeEvent({ kind: "external", url: request.url() }, server.url)));
    page.on("requestfailed", (request) =>
      record(
        classifySmokeEvent(
          { kind: "request", url: request.url(), errorText: request.failure()?.errorText ?? "failed" },
          server.url,
        ),
      ),
    );
    page.on("response", (response) =>
      record(classifySmokeEvent({ kind: "response", url: response.url(), status: response.status() }, server.url)),
    );
    const response = await page.goto(`${server.url}${item.path}`, { waitUntil: "networkidle" });
    if (response === null) record({ kind: "response", detail: `${item.path}: no response` });
  } catch (error) {
    record({ kind: "page", detail: `${item.name}: ${(error as Error).message}` });
  } finally {
    await context.close();
  }
  return { ...item, status: failures.length === 0 ? "pass" : "fail", failures };
}

async function main(): Promise<void> {
  for (const site of Object.values(SITES)) build(site.source, site.out);
  buildSearchIndex(SITES.fixtures.out);

  const servers: Record<SmokeSite, StaticServer> = {
    docs: await startServer(SITES.docs.out, SITES.docs.mount),
    fixtures: await startServer(SITES.fixtures.out, SITES.fixtures.mount),
    blog: await startServer(SITES.blog.out, SITES.blog.mount),
    versions: await startServer(SITES.versions.out, SITES.versions.mount),
  };
  let browser: Browser | undefined;
  const results: SmokeResult[] = [];
  let chromiumVersion = "unknown";
  try {
    browser = await chromium.launch();
    chromiumVersion = browser.version();
    for (const item of CASES) results.push(await auditRoute(browser, servers, item));
  } finally {
    await browser?.close();
    await servers.docs.close();
    await servers.fixtures.close();
    await servers.blog.close();
    await servers.versions.close();
  }

  const report = buildSmokeReport({
    commit: commitOf(),
    tools: { node: process.version, playwright: versionOf("playwright"), chromium: chromiumVersion },
    results,
  });
  mkdirSync(dirname(REPORT_FILE), { recursive: true });
  writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${REPORT_FILE}`);

  const failed = results.filter((result) => result.status === "fail");
  if (failed.length > 0) {
    for (const result of failed) {
      console.error(`FAIL: ${result.name} (${result.path})`);
      for (const failure of orderFailures(result.failures)) console.error(`  [${failure.kind}] ${failure.detail}`);
    }
    console.error(`FAIL: ${failed.length} of ${results.length} production routes had browser errors`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${results.length} production routes, no console errors, page errors, or broken local assets`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
