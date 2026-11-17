// The screenshot runner of the visual gates: builds the visual fixture site, serves it on a local
// port, and takes one full-page screenshot in Chromium for every entry of test/visual/matrix.json
// into test/visual/out/. The settings are those of docs/design/visual-gates.md: a fixed viewport,
// the bundled fonts, no network, reduced motion, no animation, no caret, a fixed time zone and a
// fixed locale. The matrix adds the theme, the text direction, the width and the print and forced-colors
// emulations; it is data so a site can keep its own file in the same shape.
//
// Setup: npm ci && npx playwright install chromium
// Usage: node scripts/test-visual.ts [--only <case name substring>] [--out <folder>] [--update]
// Each shot is compared with test/visual/baselines/<case>.png; a failure writes before, after and diff
// images into <out>/review/. --update writes the baselines and is the only thing that does.
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { buildFixture } from "../test/visual/fixtures/build.ts";
import { startServer } from "./test-a11y.ts";
import { checkPage, formatFinding, type PageFinding } from "./visual-checks.ts";
import { formatReview, reviewShots } from "./visual-review.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Where the screenshots go; `.gitignore` keeps it out of the repository. */
export const OUT_DIR = join(ROOT, "test/visual/out");

/** The committed baselines. */
export const BASELINE_DIR = join(ROOT, "test/visual/baselines");

/** The screenshot matrix: the layouts and the gallery, as data. */
export const MATRIX_FILE = join(ROOT, "test/visual/matrix.json");

/** Tallest shot, in CSS pixels: a taller page is cropped to this. */
export const MAX_HEIGHT = 4000;

/** The viewport when a caller does not name one; the matrix carries the widths every case uses. */
export const DEFAULT_VIEWPORT = { width: 1280, height: 900 } as const;

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

export type Theme = "light" | "dark";
export type Section = "layout" | "gallery" | "print" | "forced-colors";
export type FixtureLang = "en" | "fa" | "ar";

/** One page of the matrix. A site reuses this shape with its own paths and languages. */
export interface MatrixTarget {
  readonly name: string;
  /** URL path relative to the site root. */
  readonly path: string;
  readonly lang: FixtureLang;
  readonly dir: "ltr" | "rtl";
}

export interface MatrixSize {
  readonly width: number;
  readonly height: number;
}

export interface VisualMatrix {
  readonly version: number;
  readonly widths: Readonly<Record<string, MatrixSize>>;
  readonly themes: readonly Theme[];
  readonly layouts: readonly MatrixTarget[];
  readonly gallery: {
    readonly widths: readonly string[];
    readonly pages: readonly MatrixTarget[];
    readonly print: { readonly width: string; readonly pages: readonly string[] };
    readonly forcedColors: { readonly width: string; readonly pages: readonly string[] };
  };
}

/** One image: a page at one width, theme and emulation. */
export interface MatrixEntry extends MatrixTarget {
  /** File name without the extension. */
  readonly case: string;
  readonly section: Section;
  readonly theme: Theme;
  readonly widthName: string;
  readonly width: number;
  readonly height: number;
}

/** Reads the matrix file. The format is plain JSON so a site can generate or edit its own. */
export function loadMatrix(file: string = MATRIX_FILE): VisualMatrix {
  return JSON.parse(readFileSync(file, "utf8")) as VisualMatrix;
}

function sizeOf(matrix: VisualMatrix, name: string): MatrixSize {
  const size = matrix.widths[name];
  if (size === undefined) throw new Error(`the matrix names no width "${name}"`);
  return size;
}

function entryOf(target: MatrixTarget, section: Section, theme: Theme, widthName: string, size: MatrixSize, suffix = ""): MatrixEntry {
  return {
    ...target,
    case: `${target.name}-${theme}-${widthName}${suffix}`,
    section,
    theme,
    widthName,
    width: size.width,
    height: size.height,
  };
}

/**
 * Turns the matrix into one entry per image: every layout in every theme at every width, the
 * gallery at its two widths, then the print and forced-colors pages. The order is stable, so a
 * report lists the same cases in the same order on every run.
 */
export function expandMatrix(matrix: VisualMatrix): MatrixEntry[] {
  if (matrix.version !== 1) throw new Error(`unsupported matrix version ${matrix.version}`);
  const widths = Object.entries(matrix.widths);
  if (widths.length === 0) throw new Error("the matrix has no widths");
  if (matrix.themes.length === 0) throw new Error("the matrix has no themes");

  const entries: MatrixEntry[] = [];
  for (const target of matrix.layouts) {
    for (const [widthName, size] of widths) {
      for (const theme of matrix.themes) entries.push(entryOf(target, "layout", theme, widthName, size));
    }
  }
  for (const target of matrix.gallery.pages) {
    for (const widthName of matrix.gallery.widths) {
      for (const theme of matrix.themes) entries.push(entryOf(target, "gallery", theme, widthName, sizeOf(matrix, widthName)));
    }
  }
  const byName = new Map(matrix.gallery.pages.map((page) => [page.name, page]));
  const modes: readonly { readonly section: Section; readonly suffix: string; readonly group: { readonly width: string; readonly pages: readonly string[] } }[] = [
    { section: "print", suffix: "-print", group: matrix.gallery.print },
    { section: "forced-colors", suffix: "-forced-colors", group: matrix.gallery.forcedColors },
  ];
  for (const mode of modes) {
    const size = sizeOf(matrix, mode.group.width);
    for (const name of mode.group.pages) {
      const target = byName.get(name);
      if (target === undefined) throw new Error(`the ${mode.section} list names "${name}", which is not a gallery page`);
      entries.push(entryOf(target, mode.section, "light", mode.group.width, size, mode.suffix));
    }
  }
  return entries;
}

/** True for a request the run may make: the local server and inline data, never the network. */
export function isLocalRequest(url: string, origin: string): boolean {
  return url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:") || url === "about:blank";
}

/** A context with the fixed settings, and every request outside `origin` aborted. */
export async function newVisualContext(browser: Browser, origin: string, viewport: MatrixSize = DEFAULT_VIEWPORT): Promise<BrowserContext> {
  const context = await browser.newContext({ ...CONTEXT_OPTIONS, viewport: { width: viewport.width, height: viewport.height } });
  await context.route("**/*", (route) => (isLocalRequest(route.request().url(), origin) ? route.continue() : route.abort()));
  return context;
}

export interface CaptureOptions {
  /** The colour theme on `<html>`, light when absent. */
  readonly theme?: Theme;
  /** Print emulation for a page that must read on paper; screen when absent. */
  readonly media?: "screen" | "print";
  /** Force the operating system's colours; off when absent. */
  readonly forcedColors?: boolean;
}

/** Opens `url`, waits until the page is settled, and writes the full-page screenshot to `file`. */
export async function capture(page: Page, url: string, file: string, options: CaptureOptions = {}): Promise<void> {
  const theme = options.theme ?? "light";
  await page.emulateMedia({
    reducedMotion: "reduce",
    colorScheme: theme,
    media: options.media ?? "screen",
    forcedColors: options.forcedColors === true ? "active" : "none",
  });
  await page.goto(url, { waitUntil: "load" });
  await page.addStyleTag({ content: STABILIZE_CSS });
  await page.evaluate(
    (value: string) =>
      (globalThis as unknown as { document: { documentElement: { setAttribute(name: string, value: string): void } } }).document.documentElement.setAttribute("data-theme", value),
    theme,
  );
  await page.evaluate(() => (globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }).document.fonts.ready);
  const height = await page.evaluate(() => (globalThis as unknown as { document: { documentElement: { scrollHeight: number } } }).document.documentElement.scrollHeight);
  const width = page.viewportSize()?.width ?? DEFAULT_VIEWPORT.width;
  await page.screenshot({
    path: file,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    ...(height > MAX_HEIGHT ? { clip: { x: 0, y: 0, width, height: MAX_HEIGHT } } : {}),
  });
}

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
    browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text", "--disable-gpu", "--force-color-profile=srgb", "--num-raster-threads=1", "--disable-threaded-animation", "--disable-partial-raster"] });
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
