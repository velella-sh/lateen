import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromium, type Browser } from "playwright";
import { startServer } from "../../scripts/test-a11y.ts";
import {
  CONTEXT_OPTIONS,
  DEFAULT_VIEWPORT,
  MAX_HEIGHT,
  STABILIZE_CSS,
  capture,
  isLocalRequest,
  newVisualContext,
  settle,
} from "../../scripts/test-visual.ts";

test("the fixed settings are the ones of the design note", () => {
  assert.deepEqual(DEFAULT_VIEWPORT, { width: 1280, height: 900 });
  assert.equal(CONTEXT_OPTIONS.deviceScaleFactor, 1);
  assert.equal(CONTEXT_OPTIONS.timezoneId, "UTC");
  assert.equal(CONTEXT_OPTIONS.locale, "en-US");
  assert.equal(CONTEXT_OPTIONS.reducedMotion, "reduce");
  assert.equal(MAX_HEIGHT, 4000);
  for (const rule of ["animation: none", "transition: none", "caret-color: transparent", "scrollbar"]) assert.ok(STABILIZE_CSS.includes(rule), rule);
});

test("only the local server and inline data are reachable", () => {
  const origin = "http://127.0.0.1:4000";
  assert.ok(isLocalRequest(`${origin}/a/`, origin));
  assert.ok(isLocalRequest("data:font/woff2;base64,AA", origin));
  assert.ok(!isLocalRequest("https://fonts.googleapis.com/css", origin));
  assert.ok(!isLocalRequest("http://127.0.0.1:4001/", origin));
});

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch {
  browser = undefined;
}
const skip = browser === undefined ? "Chromium is not installed (npx playwright install chromium)" : false;

const PAGE = `<!doctype html><meta charset="utf-8"><title>t</title>
<style>
@font-face { font-family: Slow; src: url(/slow.woff2) format("woff2"); }
body { margin: 0; font: 20px Slow, sans-serif; }
#blink { animation: move 1s infinite; width: 40px; height: 40px; background: #36c; }
@keyframes move { from { margin-left: 0 } to { margin-left: 300px } }
#tall { height: 5000px; background: linear-gradient(#fff, #888); }
</style>
<input id="in" value="caret" autofocus>
<div id="blink"></div><p id="info"></p>
<img src="https://example.invalid/x.png" id="remote" alt="">
<div id="tall"></div>
<script>
document.getElementById("info").textContent = new Date(0).toString() + " " + navigator.language + " " +
  matchMedia("(prefers-reduced-motion: reduce)").matches;
</script>`;

test("every page settles through the same helper: fonts ready, animation and motion off", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-settle-"));
  writeFileSync(join(dir, "index.html"), PAGE);
  writeFileSync(join(dir, "slow.woff2"), "not a font");
  const server = await startServer(dir, "");
  try {
    const context = await newVisualContext(browser as Browser, server.url);
    const page = await context.newPage();
    await settle(page, `${server.url}/`);
    const state = await page.evaluate(() => {
      const g = globalThis as unknown as {
        document: { fonts: { status: string }; getElementById(id: string): unknown; documentElement: { getAttribute(name: string): string | null } };
        getComputedStyle(e: unknown): Record<string, string>;
        matchMedia(query: string): { matches: boolean };
      };
      const blink = g.getComputedStyle(g.document.getElementById("blink"));
      return {
        fonts: g.document.fonts.status,
        animation: blink.animationName,
        transition: blink.transitionDuration,
        motion: g.matchMedia("(prefers-reduced-motion: reduce)").matches,
        theme: g.document.documentElement.getAttribute("data-theme"),
      };
    });
    assert.deepEqual(state, { fonts: "loaded", animation: "none", transition: "0s", motion: true, theme: "light" });
    await context.close();
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a shot waits for fonts, fixes the settings, blocks the network and is byte-identical across runs", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-runner-"));
  writeFileSync(join(dir, "index.html"), PAGE);
  writeFileSync(join(dir, "slow.woff2"), "not a font");
  const server = await startServer(dir, "");
  try {
    const context = await newVisualContext(browser as Browser, server.url);
    const page = await context.newPage();
    const requested: string[] = [];
    page.on("requestfailed", (r) => requested.push(r.url()));
    await capture(page, `${server.url}/`, join(dir, "a.png"));
    await capture(page, `${server.url}/`, join(dir, "b.png"));

    assert.deepEqual(readFileSync(join(dir, "a.png")), readFileSync(join(dir, "b.png")));
    assert.ok(requested.some((u) => u.startsWith("https://example.invalid/")), "the remote image was blocked");
    const info = await page.evaluate(() => (globalThis as unknown as { document: { getElementById(id: string): { textContent: string } } }).document.getElementById("info").textContent);
    assert.match(info, /1970/);
    assert.match(info, /GMT\+0000/);
    assert.match(info, /en-US true$/);
    const state = await page.evaluate(() => {
      const g = globalThis as unknown as { document: { fonts: { status: string }; getElementById(id: string): unknown }; getComputedStyle(e: unknown): Record<string, string> };
      const style = g.getComputedStyle(g.document.getElementById("blink"));
      return { fonts: g.document.fonts.status, animation: style.animationName, caret: g.getComputedStyle(g.document.getElementById("in")).caretColor };
    });
    assert.equal(state.fonts, "loaded");
    assert.equal(state.animation, "none");
    assert.equal(state.caret, "rgba(0, 0, 0, 0)");
    const png = readFileSync(join(dir, "a.png"));
    assert.equal(png.readUInt32BE(16), DEFAULT_VIEWPORT.width);
    assert.equal(png.readUInt32BE(20), MAX_HEIGHT, "a taller page is cropped to the cap");
    await context.close();
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a shot takes the theme, print and forced-colors emulation of its matrix entry", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-runner-"));
  writeFileSync(join(dir, "index.html"), PAGE);
  writeFileSync(join(dir, "slow.woff2"), "not a font");
  const server = await startServer(dir, "");
  try {
    const context = await newVisualContext(browser as Browser, server.url, { width: 375, height: 844 });
    const page = await context.newPage();
    await capture(page, `${server.url}/`, join(dir, "dark-print-forced.png"), { theme: "dark", media: "print", forcedColors: true });
    const state = await page.evaluate(() => {
      const g = globalThis as unknown as {
        document: { documentElement: { getAttribute(name: string): string | null } };
        matchMedia(query: string): { matches: boolean };
      };
      return {
        theme: g.document.documentElement.getAttribute("data-theme"),
        print: g.matchMedia("print").matches,
        forced: g.matchMedia("(forced-colors: active)").matches,
      };
    });
    assert.deepEqual(state, { theme: "dark", print: true, forced: true });
    const png = readFileSync(join(dir, "dark-print-forced.png"));
    assert.equal(png.readUInt32BE(16), 375);
    await context.close();
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test.after(async () => {
  await browser?.close();
});
