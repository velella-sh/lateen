// The visual checks, in one place (visual-gates #499, #505).
//
// The theme's gate reads test/visual/matrix.json, shoots every entry — the layouts and the gallery in
// both themes at every width, then the print and forced-colors pages — and compares the shots with the
// committed baselines. A site runs the same comparer and review flow on its own built pages by calling
// `visualCheck` from its release step; there is no command line.
//
// Setup: npm i -D playwright && npx playwright install chromium   (Playwright is an optional peer)
// Usage: import { visualCheck } from "@velella/lateen/visual";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, BrowserContext, Page } from "playwright";
import { formatReview, reviewShots, type CaseReport } from "../scripts/visual-review.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

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

/** The theme's screenshot matrix: the layouts and the gallery, as data. A site passes its own file. */
export const MATRIX_FILE = join(ROOT, "test/visual/matrix.json");

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
  /** Tallest shot of this page, in CSS pixels; MAX_HEIGHT when absent. */
  readonly maxHeight?: number;
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

/** The named sizes of `visualCheck`; the theme's matrix carries its own widths. */
export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;

/** Charged when Playwright, an optional peer dependency, is not installed. */
export const MISSING_PLAYWRIGHT =
  'the visual check needs Playwright, an optional peer dependency: run "npm i -D playwright" and "npx playwright install chromium", then run it again';

/** True for a request the run may make: the local server and inline data, never the network. */
export function isLocalRequest(url: string, origin: string): boolean {
  return url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:") || url === "about:blank";
}

/** A context with the fixed settings, and every request outside `origin` aborted. */
export async function newVisualContext(browser: Browser, origin: string, viewport: MatrixSize = DEFAULT_VIEWPORT): Promise<BrowserContext> {
  const context = await browser.newContext({ ...CONTEXT_OPTIONS, viewport: { width: viewport.width, height: viewport.height } });
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!isLocalRequest(request.url(), origin)) return await route.abort();
    if (request.resourceType() !== "stylesheet") return await route.continue();
    const response = await route.fetch({ maxRedirects: 0 });
    const css = await response.text();
    // Optional faces can stay on their fallback for the whole navigation, even after fonts.ready.
    const settledCss = css.replace(/\bfont-display:\s*optional(?=\s*[;}])/g, "font-display: swap");
    await route.fulfill({ response, body: settledCss });
  });
  return context;
}

export interface CaptureOptions {
  /** The colour theme on `<html>`, light when absent. */
  readonly theme?: Theme;
  /** Print emulation for a page that must read on paper; screen when absent. */
  readonly media?: "screen" | "print";
  /** Force the operating system's colours; off when absent. */
  readonly forcedColors?: boolean;
  /** Tallest shot, in CSS pixels; MAX_HEIGHT when absent. */
  readonly maxHeight?: number;
}

/**
 * Opens `url` under the one contract every visual page is captured with: the emulated media,
 * animation and transitions off, the theme set, and the fonts loaded. No test adds its own.
 */
export async function settle(page: Page, url: string, options: CaptureOptions = {}): Promise<void> {
  const theme = options.theme ?? "light";
  await page.emulateMedia({
    reducedMotion: "reduce",
    colorScheme: theme,
    media: options.media ?? "screen",
    forcedColors: options.forcedColors === true ? "active" : "none",
  });
  const response = await page.goto(url, { waitUntil: "load" });
  if (response === null || !response.ok()) throw new Error(`${url} did not load (HTTP ${response?.status() ?? "none"})`);
  await page.addStyleTag({ content: STABILIZE_CSS });
  await page.evaluate(
    (value: string) =>
      (globalThis as unknown as { document: { documentElement: { setAttribute(name: string, value: string): void } } }).document.documentElement.setAttribute("data-theme", value),
    theme,
  );
  await page.evaluate(() => (globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }).document.fonts.ready);
}

/** Opens `url`, waits until the page is settled, and writes the full-page screenshot to `file`. */
export async function capture(page: Page, url: string, file: string, options: CaptureOptions = {}): Promise<void> {
  await settle(page, url, options);
  const height = await page.evaluate(() => (globalThis as unknown as { document: { documentElement: { scrollHeight: number } } }).document.documentElement.scrollHeight);
  const width = page.viewportSize()?.width ?? DEFAULT_VIEWPORT.width;
  const maxHeight = options.maxHeight ?? MAX_HEIGHT;
  await page.screenshot({
    path: file,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    ...(height > maxHeight ? { clip: { x: 0, y: 0, width, height: maxHeight } } : {}),
  });
}

/** File name of a case: its name with the viewport, as a safe slug. */
export function shotName(name: string, viewport: ViewportName): string {
  return `${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${viewport}.png`;
}

/** How Playwright is loaded; a parameter so a test can prove the missing peer message without removing it. */
export type PlaywrightLoader = () => Promise<typeof import("playwright")>;

/** Launches Chromium with the rendering flags the baselines were recorded with. */
export async function launchChromium(load: PlaywrightLoader = () => import("playwright")): Promise<Browser> {
  let playwright: typeof import("playwright");
  try {
    playwright = await load();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "ERR_MODULE_NOT_FOUND" || String((error as Error).message).includes("Cannot find package 'playwright'")) {
      throw new Error(MISSING_PLAYWRIGHT);
    }
    throw error;
  }
  return playwright.chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text", "--disable-gpu", "--force-color-profile=srgb", "--num-raster-threads=1", "--disable-threaded-animation", "--disable-partial-raster"] });
}

/** Maps a request path to a file under `root`, or `undefined` when it leaves `root` or does not match `mount`. */
export function fileForRequest(root: string, mount: string, pathname: string): string | undefined {
  if (mount !== "" && pathname !== mount && !pathname.startsWith(`${mount}/`)) return undefined;
  let path: string;
  try {
    path = decodeURIComponent(pathname.slice(mount.length));
  } catch {
    return undefined;
  }
  if (path.includes("\0")) return undefined;
  if (path === "" || path === "/") path = "/index.html";
  else if (path.endsWith("/")) path += "index.html";
  const file = resolve(root, `.${path}`);
  return file === root || file.startsWith(root + sep) ? file : undefined;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

export interface StaticServer {
  readonly url: string;
  close(): Promise<void>;
}

/** Serves one built folder at `mount` (empty for the site root) on a free loopback port. */
export function startServer(root: string, mount: string): Promise<StaticServer> {
  const respond = (response: ServerResponse, status: number, body: string): void => {
    response.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end(body);
  };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const file = fileForRequest(root, mount, pathname);
    if (file === undefined) {
      respond(response, 404, "not found");
      return;
    }
    readFile(file).then(
      (body) => {
        response.writeHead(200, {
          "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
          "cache-control": "no-store",
        });
        response.end(body);
      },
      () => respond(response, 404, "not found"),
    );
  });
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      // A test-only server never holds the process open: the suite's teardown closes it, but a test
      // file that starts one before its first test (top-level await) can outrun that hook.
      server.unref();
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("the static server did not get a port"));
        return;
      }
      resolvePromise({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) => (error === undefined ? resolveClose() : rejectClose(error)));
          }),
      });
    });
  });
}

/** One page of the site: the baseline name it is compared under and where it lives in the build. */
export interface VisualPage {
  readonly name: string;
  /** URL path inside the built site, such as `/` or `/guide/install/`; it must start with `/`. */
  readonly path: string;
  /** Viewport the page is shot at; `desktop` when absent. */
  readonly viewport?: ViewportName;
}

export interface VisualCheckOptions {
  /** The built site folder to serve and shoot. */
  readonly site: string;
  /** The pages to shoot. */
  readonly pages: readonly VisualPage[];
  /** The folder of the committed baselines. A baseline is written only when `update` is set. */
  readonly baselines: string;
  /** Write the shots to the baselines folder instead of comparing them. */
  readonly update?: boolean;
  /** Folder for the shots and the review images; a new temporary folder when absent. */
  readonly out?: string;
}

export interface VisualCheckResult {
  readonly ok: boolean;
  readonly reports: readonly CaseReport[];
  /** The lines to print, from the review flow. */
  readonly lines: readonly string[];
  /** Folder of the shots; the review images of a failure are in its `review` subfolder. */
  readonly shots: string;
}

/** Serves `site`, shoots every page and compares it with its baseline. */
export async function visualCheck(options: VisualCheckOptions): Promise<VisualCheckResult> {
  const site = resolve(options.site);
  if (!existsSync(site)) throw new Error(`visual check: no site folder at ${site}`);
  if (options.pages.length === 0) throw new Error("visual check: the page list is empty");
  const cases = options.pages.map((page) => {
    if (!page.path.startsWith("/")) throw new Error(`visual check: page "${page.name}" needs a path that starts with "/", got "${page.path}"`);
    return { ...page, file: shotName(page.name, page.viewport ?? "desktop") };
  });
  const twice = cases.find((one, i) => cases.findIndex((other) => other.file === one.file) !== i);
  if (twice !== undefined) throw new Error(`visual check: two pages share the case "${twice.file}"`);
  const out = resolve(options.out ?? mkdtempSync(join(tmpdir(), "lateen-visual-")));
  const shots = join(out, "shots");
  const review = join(out, "review");
  rmSync(shots, { recursive: true, force: true });
  rmSync(review, { recursive: true, force: true });
  mkdirSync(shots, { recursive: true });
  const server = await startServer(site, "");
  let browser: Browser | undefined;
  try {
    browser = await launchChromium();
    for (const entry of cases) {
      const context = await newVisualContext(browser, server.url, VIEWPORTS[entry.viewport ?? "desktop"]);
      try {
        await capture(await context.newPage(), `${server.url}${entry.path}`, join(shots, entry.file));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await server.close();
  }
  const reports = reviewShots({ shots, baselines: resolve(options.baselines), review, update: options.update ?? false });
  const { lines, ok } = formatReview(reports);
  return { ok, reports, lines, shots };
}
