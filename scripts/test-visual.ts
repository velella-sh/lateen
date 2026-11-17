// The screenshot runner of the visual gates: builds the visual fixture site, serves it on a local
// port, and takes one full-page screenshot in Chromium for every entry of test/visual/matrix.json
// into test/visual/out/. The runner, the matrix and the capture settings live in visual/index.ts,
// next to the export a site calls on its own pages (#505).
//
// Setup: npm ci && npx playwright install chromium
// Usage: node scripts/test-visual.ts [--only <case name substring>] [--out <folder>] [--update]
// Each shot is compared with test/visual/baselines/<case>.png; a failure writes before, after and diff
// images into <out>/review/. --update writes the baselines and is the only thing that does.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "playwright";
import { buildFixture } from "../test/visual/fixtures/build.ts";
import {
  DEFAULT_VIEWPORT,
  STABILIZE_CSS,
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

/** The interactive states captured for the gallery, and the controls they use. */
export const STATES_FILE = join(ROOT, "test/visual/states.json");

export type InteractionState = "hover" | "focus" | "pressed" | "disabled";

export interface StateEntry {
  readonly name: string;
  /** Selector of the control inside the component's gallery section. */
  readonly selector: string;
  /** The states this control really has; a summary or a link cannot be disabled. */
  readonly states: readonly InteractionState[];
  /** The keyboard target when it is not the control the shot is framed on, such as a hidden radio. */
  readonly focusSelector?: string;
  /** The element whose own `disabled` state is set, when it is not the framed control. */
  readonly disabledSelector?: string;
}

export interface StatesFile {
  readonly version: number;
  readonly components: readonly StateEntry[];
}

/** Reads the state list; the file is plain JSON so a component can be added without a code change. */
export function loadStates(file: string = STATES_FILE): StatesFile {
  const states = JSON.parse(readFileSync(file, "utf8")) as StatesFile;
  if (states.version !== 1) throw new Error(`unsupported states version ${states.version}`);
  return states;
}

/** The component folders that ship a client script: the interactive ones. */
export function islandComponents(dir: string = join(ROOT, "components")): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "client.ts")))
    .map((entry) => entry.name)
    .sort();
}

/** The interactive components with no entry in the state list. */
export function missingStateEntries(components: readonly string[], states: StatesFile): string[] {
  const listed = new Set(states.components.map((entry) => entry.name));
  return components.filter((name) => !listed.has(name));
}

/** Loads a page in the settings every shot uses. */
async function prepare(page: Page, url: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light", media: "screen", forcedColors: "none" });
  const response = await page.goto(url, { waitUntil: "load" });
  if (response === null || !response.ok()) throw new Error(`${url} did not load (HTTP ${response?.status() ?? "none"})`);
  await page.addStyleTag({ content: STABILIZE_CSS });
  await page.evaluate(() => (globalThis as unknown as { document: { documentElement: { setAttribute(name: string, value: string): void } } }).document.documentElement.setAttribute("data-theme", "light"));
  await page.evaluate(() => (globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }).document.fonts.ready);
}

/** The first match of `selector`, scrolled into view. */
async function control(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible" });
  await locator.evaluate((element) => (element as unknown as { scrollIntoView(options: unknown): void }).scrollIntoView({ block: "center", inline: "center" }));
  return locator;
}

/** Tabs until the keyboard focus reaches the control: a real `:focus-visible`, never a forced class. */
export async function focusByKeyboard(page: Page, selector: string): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const reached = await page.evaluate((value) => {
      const active = (globalThis as unknown as { document: { activeElement: unknown } }).document.activeElement as unknown as {
        matches(selector: string): boolean;
      } | null;
      return active !== null && active.matches(value);
    }, selector);
    if (reached) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`keyboard focus did not reach ${selector}`);
}

/** Hovers the control with the pointer. */
export async function hoverByPointer(page: Page, selector: string): Promise<void> {
  await (await control(page, selector)).hover();
}

/** Presses the primary pointer button on the control and leaves it down; the caller releases it. */
export async function pressByPointer(page: Page, selector: string): Promise<void> {
  await hoverByPointer(page, selector);
  await page.mouse.down();
}

/** Sets the control's own disabled state, the state a class could only imitate. */
export async function disableControl(page: Page, selector: string): Promise<void> {
  await (await control(page, selector)).evaluate((element) => {
    (element as unknown as { disabled: boolean }).disabled = true;
  });
}

/** Puts the page in one interaction state, using the real input for that state. */
export async function applyState(page: Page, selector: string, state: InteractionState): Promise<void> {
  if (state === "hover") await hoverByPointer(page, selector);
  else if (state === "focus") await focusByKeyboard(page, selector);
  else if (state === "pressed") await pressByPointer(page, selector);
  else await disableControl(page, selector);
}

/** A shot around the control, so a 1×1 radio's focus ring on its label is still visible. */
async function shotAround(page: Page, selector: string, file: string): Promise<void> {
  const box = await page.evaluate((value) => {
    const element = (globalThis as unknown as { document: { querySelector(selector: string): unknown } }).document.querySelector(value) as unknown as {
      getBoundingClientRect(): { x: number; y: number; width: number; height: number };
    };
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, selector);
  const viewport = page.viewportSize() ?? DEFAULT_VIEWPORT;
  const width = Math.min(viewport.width, Math.max(240, box.width + 64));
  const height = Math.min(viewport.height, Math.max(160, box.height + 64));
  const x = Math.max(0, Math.min(viewport.width - width, box.x + box.width / 2 - width / 2));
  const y = Math.max(0, Math.min(viewport.height - height, box.y + box.height / 2 - height / 2));
  await page.screenshot({ path: file, clip: { x, y, width, height }, animations: "disabled", caret: "hide", scale: "css" });
}

/**
 * Shoots every listed state of every interactive component on `url` into `dir`. A new load per
 * shot keeps one state from leaking into the next. A client component with no entry fails first.
 */
export async function captureStates(
  page: Page,
  url: string,
  states: StatesFile,
  dir: string,
  components: readonly string[] = islandComponents(),
): Promise<string[]> {
  const missing = missingStateEntries(components, states);
  if (missing.length > 0) throw new Error(`the state list has no entry for ${missing.join(", ")}`);
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const entry of states.components) {
    for (const state of entry.states) {
      await prepare(page, url);
      const action = state === "focus" ? entry.focusSelector ?? entry.selector : state === "disabled" ? entry.disabledSelector ?? entry.selector : entry.selector;
      await applyState(page, action, state);
      const file = join(dir, `${entry.name}-${state}.png`);
      try {
        await shotAround(page, entry.selector, file);
      } finally {
        if (state === "pressed") await page.mouse.up();
      }
      written.push(file);
    }
  }
  return written;
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
    if (options.only === undefined) {
      const context = await newVisualContext(browser, server.url, DEFAULT_VIEWPORT);
      try {
        const page = await context.newPage();
        await captureStates(page, `${server.url}/gallery/`, loadStates(), join(out, "states"));
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
