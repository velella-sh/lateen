// The screenshot runner of the visual gates: builds the visual fixture site, serves it on a local
// port, and takes one full-page screenshot of every fixture page in Chromium into test/visual/out/.
// The settings are those of docs/design/visual-gates.md: a fixed viewport, the bundled fonts, no
// network, reduced motion, no animation, no caret, a fixed time zone and a fixed locale.
//
// Setup: npm ci && npx playwright install chromium
// Usage: node scripts/test-visual.ts [--only <page name substring>] [--out <folder>] [--update]
// Each shot is compared with test/visual/baselines/<case>.png; a failure writes before, after and diff
// images into <out>/review/. --update writes the baselines and is the only thing that does.
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { buildFixture } from "../test/visual/fixtures/build.ts";
import { PAGES, type FixturePage } from "../test/visual/fixtures/pages.ts";
import { startServer } from "./test-a11y.ts";
import { checkPage, formatFinding, type PageFinding } from "./visual-checks.ts";
import { formatReview, reviewShots } from "./visual-review.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Where the screenshots go; `.gitignore` keeps it out of the repository. */
export const OUT_DIR = join(ROOT, "test/visual/out");

/** The committed baselines. */
export const BASELINE_DIR = join(ROOT, "test/visual/baselines");

export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;

/** Tallest shot, in CSS pixels: a taller page is cropped to this. */
export const MAX_HEIGHT = 4000;

/** The context settings every shot uses. */
export const CONTEXT_OPTIONS = {
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  reducedMotion: "reduce",
  colorScheme: "light",
} as const;

/** Turns off animation, transitions, the caret and scrollbars, so nothing moves or blinks mid-shot. */
export const STABILIZE_CSS = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}
html { scrollbar-width: none !important; }
::-webkit-scrollbar { display: none !important; }
`;

/** True for a request the run may make: the local server and inline data, never the network. */
export function isLocalRequest(url: string, origin: string): boolean {
  return url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:") || url === "about:blank";
}

/** A context with the fixed settings, and every request outside `origin` aborted. */
export async function newVisualContext(browser: Browser, origin: string, viewport: ViewportName = "desktop"): Promise<BrowserContext> {
  const context = await browser.newContext({ ...CONTEXT_OPTIONS, viewport: VIEWPORTS[viewport] });
  await context.route("**/*", (route) => (isLocalRequest(route.request().url(), origin) ? route.continue() : route.abort()));
  return context;
}

/** Opens `url`, waits until the page is settled, and writes the full-page screenshot to `file`. */
export async function capture(page: Page, url: string, file: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(url, { waitUntil: "load" });
  await page.addStyleTag({ content: STABILIZE_CSS });
  await page.evaluate(() => (globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }).document.fonts.ready);
  const height = await page.evaluate(() => (globalThis as unknown as { document: { documentElement: { scrollHeight: number } } }).document.documentElement.scrollHeight);
  const width = page.viewportSize()?.width ?? VIEWPORTS.desktop.width;
  await page.screenshot({
    path: file,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    ...(height > MAX_HEIGHT ? { clip: { x: 0, y: 0, width, height: MAX_HEIGHT } } : {}),
  });
}

/** File name of a case: the page name with the viewport, as a safe slug. */
export function shotName(page: FixturePage, viewport: ViewportName): string {
  return `${page.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${viewport}.png`;
}

export interface RunOptions {
  readonly out?: string;
  readonly only?: string;
  readonly viewports?: readonly ViewportName[];
  /** Receives the layout findings of the in-page checks (scripts/visual-checks.ts). */
  readonly findings?: PageFinding[];
}

/** Builds the fixture, serves it and shoots every page. Returns the files written. */
export async function runVisual(options: RunOptions = {}): Promise<string[]> {
  const out = resolve(options.out ?? OUT_DIR);
  const site = join(ROOT, ".mizzen/visual/fixture-site");
  rmSync(site, { recursive: true, force: true });
  buildFixture(site);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const server = await startServer(site, "");
  let browser: Browser | undefined;
  const written: string[] = [];
  try {
    browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text", "--disable-gpu", "--force-color-profile=srgb", "--num-raster-threads=1", "--disable-threaded-animation", "--disable-partial-raster"] });
    for (const viewport of options.viewports ?? (["desktop"] as const)) {
      const context = await newVisualContext(browser, server.url, viewport);
      try {
        const page = await context.newPage();
        for (const fixturePage of PAGES) {
          if (options.only !== undefined && !fixturePage.name.includes(options.only)) continue;
          const file = join(out, shotName(fixturePage, viewport));
          await capture(page, `${server.url}${fixturePage.path}`, file);
          written.push(file);
          options.findings?.push(...(await checkPage(page, fixturePage.name, viewport)));
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
