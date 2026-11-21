import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { build, serve } from "./integration-helpers.ts";

test("opening Trust keeps the article still and the details within the page", async (t) => {
  const browser = await chromium.launch().catch(() => undefined);
  if (browser === undefined) {
    t.skip("Chromium is not installed (npx playwright install chromium)");
    return;
  }
  try {
    const server = await serve(build("integration").out);
    const page = await browser.newPage();
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/guide/install/", "/fa/guide/install/"]) {
        await page.goto(server.url + path);
        await page.evaluate(() => document.fonts.ready);
        const chip = page.locator(".doc-meta .trust-panel-chip");
        const panel = page.locator(".doc-meta .trust-panel-body");
        const article = page.locator(".doc-body");
        const before = await article.boundingBox();
        assert.equal(await panel.isVisible(), false);

        await chip.press("Enter");
        const bounds = await panel.boundingBox();
        const anchor = await chip.boundingBox();
        assert.ok(bounds && anchor, `Trust opens at ${width}px on ${path}`);
        assert.deepEqual(await article.boundingBox(), before);
        assert.ok(bounds.y >= anchor.y + anchor.height);
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);

        await chip.press("Escape");
        assert.equal(await panel.isVisible(), false);
      }
    }
  } finally {
    await browser.close();
  }
});
