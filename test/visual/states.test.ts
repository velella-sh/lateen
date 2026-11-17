import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromium, type Browser } from "playwright";
import { startServer } from "../../visual/index.ts";
import {
  captureStates,
  disableControl,
  focusByKeyboard,
  hoverByPointer,
  islandComponents,
  loadStates,
  missingStateEntries,
  pressByPointer,
  STATES_FILE,
  type InteractionState,
  type StatesFile,
} from "../../scripts/test-visual.ts";

const STATES: readonly InteractionState[] = ["hover", "focus", "pressed", "disabled"];

test("the state list has one entry for every component with a client script", () => {
  const states = loadStates();
  const islands = islandComponents();
  assert.ok(islands.length > 10);
  assert.deepEqual(missingStateEntries(islands, states), []);
  assert.deepEqual([...states.components.map((entry) => entry.name)].sort(), islands);
  for (const entry of states.components) {
    assert.match(entry.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(entry.selector.length > 0, entry.name);
    assert.ok(entry.states.length > 0, entry.name);
    for (const state of entry.states) assert.ok(STATES.includes(state), `${entry.name}: ${state}`);
  }
});

test("a component with no entry is reported by name", () => {
  const states = loadStates();
  const missing = missingStateEntries([...islandComponents(), "not-a-component"], states);
  assert.deepEqual(missing, ["not-a-component"]);
  assert.equal(existsSync(STATES_FILE), true);
});

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch {
  browser = undefined;
}
const skip = browser === undefined ? "Chromium is not installed (npx playwright install chromium)" : false;

const PAGE = `<!doctype html><meta charset="utf-8"><title>states</title>
<style>
button { width: 120px; height: 40px; font: 16px sans-serif; }
button:hover { background: #ddd; }
button:focus-visible { outline: 3px solid #36c; }
button:active { transform: translateY(1px); }
button:disabled { opacity: 0.5; }
</style>
<button id="b">Press</button>`;

test("each state is put on the page with real pointer, keyboard or element state", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-states-"));
  writeFileSync(join(dir, "index.html"), PAGE);
  const server = await startServer(dir, "");
  try {
    const context = await browser!.newContext({ viewport: { width: 640, height: 480 } });
    const page = await context.newPage();
    await page.goto(`${server.url}/`, { waitUntil: "load" });

    await hoverByPointer(page, "#b");
    assert.equal(await page.evaluate(() => (globalThis as unknown as { document: { querySelector(s: string): { matches(s: string): boolean } } }).document.querySelector("#b").matches(":hover")), true);

    await focusByKeyboard(page, "#b");
    const focused = await page.evaluate(() => {
      const g = globalThis as unknown as { document: { activeElement: { id: string; matches(s: string): boolean } } };
      return { id: g.document.activeElement.id, visible: g.document.activeElement.matches(":focus-visible") };
    });
    assert.deepEqual(focused, { id: "b", visible: true });

    await pressByPointer(page, "#b");
    assert.equal(await page.evaluate(() => (globalThis as unknown as { document: { querySelector(s: string): { matches(s: string): boolean } } }).document.querySelector("#b").matches(":active")), true);
    await page.mouse.up();

    await disableControl(page, "#b");
    assert.equal(await page.evaluate(() => (globalThis as unknown as { document: { querySelector(s: string): { disabled: boolean } } }).document.querySelector("#b").disabled), true);
    await context.close();
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a state file produces one shot per state, and a missing component fails", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-states-"));
  writeFileSync(join(dir, "index.html"), PAGE);
  const server = await startServer(dir, "");
  const states: StatesFile = { version: 1, components: [{ name: "button", selector: "#b", states: STATES }] };
  try {
    const context = await browser!.newContext({ viewport: { width: 640, height: 480 } });
    const page = await context.newPage();
    const out = join(dir, "out");
    const files = await captureStates(page, `${server.url}/`, states, out, []);
    assert.deepEqual(files.map((file) => file.slice(out.length + 1)), STATES.map((state) => `button-${state}.png`));
    for (const file of files) assert.ok(statSync(file).size > 0, file);
    assert.match(readFileSync(files[0] as string).subarray(1, 4).toString(), /PNG/);

    await assert.rejects(() => captureStates(page, `${server.url}/`, states, out, ["ghost"]), /no entry for ghost/);
    await context.close();
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test.after(async () => {
  await browser?.close();
});
