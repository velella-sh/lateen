import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { chromium, type Browser } from "playwright";
import { startServer } from "../visual/index.ts";
import { build } from "./integration-helpers.ts";

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch {
  browser = undefined;
}
const skip = browser === undefined ? "Chromium is not installed (npx playwright install chromium)" : false;

test("an article stays inside 320px and scrolls code and tables in place", { skip }, async () => {
  const site = build("integration");
  const server = await startServer(site.out, "");
  try {
    const context = await (browser as Browser).newContext({ viewport: { width: 320, height: 800 } });
    try {
      const page = await context.newPage();
      await page.goto(`${server.url}/reflow/`, { waitUntil: "networkidle" });
      const widths = await page.evaluate(() => ({
        html: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(widths.html <= 320, `documentElement.scrollWidth is ${widths.html}`);
      assert.ok(widths.body <= 320, `body.scrollWidth is ${widths.body}`);
      const overflow = await page.evaluate(() => {
        const code = document.querySelector(".code");
        const table = document.querySelector(".doc-body > table") ?? document.querySelector("table");
        return {
          code: code === null ? null : getComputedStyle(code).overflowX,
          table: table === null ? null : getComputedStyle(table).overflowX,
        };
      });
      assert.equal(overflow.code, "auto", "the code block scrolls inside itself");
      assert.equal(overflow.table, "auto", "the table scrolls inside itself");
    } finally {
      await context.close();
    }
  } finally {
    await server.close();
    rmSync(site.out, { recursive: true, force: true });
    await browser?.close();
  }
});
