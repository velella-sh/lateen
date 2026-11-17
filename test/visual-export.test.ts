import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MISSING_PLAYWRIGHT, launchChromium, visualCheck } from "../visual/index.ts";

const hasChromium = await (async (): Promise<boolean> => {
  try {
    await (await launchChromium()).close();
    return true;
  } catch {
    return false;
  }
})();
const skip = hasChromium ? false : "Chromium is not installed or Playwright is missing (npm i -D playwright && npx playwright install chromium)";

const page = (color: string): string => `<!doctype html><meta charset="utf-8"><title>page</title>
<style>
  body { margin: 0; background: #fff; font: 16px serif; }
  main { width: 600px; padding: 24px; }
  .block { height: 120px; background: ${color}; }
</style>
<main><h1>A small site</h1><div class="block"></div><p>The visual check shoots this page.</p></main>`;

test("the optional peer gets a clear message when it is missing", async () => {
  assert.match(MISSING_PLAYWRIGHT, /optional peer/);
  assert.match(MISSING_PLAYWRIGHT, /npm i -D playwright/);
  await assert.rejects(
    () => launchChromium(async () => {
      throw Object.assign(new Error("Cannot find package 'playwright'"), { code: "ERR_MODULE_NOT_FOUND" });
    }),
    (error: Error) => error.message === MISSING_PLAYWRIGHT,
  );
});

test("bad input fails before a browser starts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-export-input-"));
  const baselines = join(dir, "baselines");
  try {
    await assert.rejects(() => visualCheck({ site: join(dir, "missing"), pages: [{ name: "home", path: "/" }], baselines }), /no site folder/);
    await assert.rejects(() => visualCheck({ site: dir, pages: [], baselines }), /page list is empty/);
    await assert.rejects(() => visualCheck({ site: dir, pages: [{ name: "home", path: "home" }], baselines }), /needs a path that starts with/);
    await assert.rejects(
      () => visualCheck({ site: dir, pages: [{ name: "same", path: "/" }, { name: "same", path: "/guide/" }], baselines }),
      /share the case/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a site records, compares and fails its own pages", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-export-"));
  const site = join(dir, "site");
  const home = join(site, "index.html");
  mkdirSync(join(site, "guide"), { recursive: true });
  writeFileSync(home, page("#36c"));
  writeFileSync(join(site, "guide/index.html"), page("#093"));
  const pages = [
    { name: "home", path: "/" },
    { name: "guide", path: "/guide/", viewport: "mobile" },
  ] as const;
  const baselines = join(dir, "baselines");
  const out = join(dir, "run");
  try {
    const first = await visualCheck({ site, pages, baselines, out });
    assert.equal(first.ok, false);
    assert.deepEqual(first.reports.map((r) => r.status), ["missing", "missing"]);
    assert.equal(existsSync(baselines), false, "no baseline is written without the update flag");

    const updated = await visualCheck({ site, pages, baselines, update: true, out });
    assert.equal(updated.ok, true);
    assert.deepEqual(updated.reports.map((r) => r.status), ["updated", "updated"]);
    assert.ok(existsSync(join(baselines, "home-desktop.png")));
    assert.ok(existsSync(join(baselines, "guide-mobile.png")));

    const passed = await visualCheck({ site, pages, baselines, out });
    assert.equal(passed.ok, true);
    assert.deepEqual(passed.reports.map((r) => r.status), ["pass", "pass"]);
    assert.ok(existsSync(join(passed.shots, "home-desktop.png")));

    writeFileSync(home, page("#c33"));
    const failed = await visualCheck({ site, pages, baselines, out });
    assert.equal(failed.ok, false);
    const failing = failed.reports.find((r) => r.name === "home-desktop");
    assert.equal(failing?.status, "fail");
    assert.ok(failing?.files.some((f) => f.endsWith("side-by-side.png")));
    assert.ok(failing?.files.every((f) => existsSync(f)));
    assert.ok(failed.lines.some((line) => line.includes("changed")));

    await assert.rejects(
      () => visualCheck({ site, pages: [{ name: "gone", path: "/gone/" }], baselines, out: join(dir, "missing-page") }),
      /did not load \(HTTP 404\)/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
