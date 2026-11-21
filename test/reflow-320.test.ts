import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { chromium, type Browser } from "playwright";
import { build, serve } from "./integration-helpers.ts";

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch {
  browser = undefined;
}
const skip = browser === undefined ? "Chromium is not installed (npx playwright install chromium)" : false;
after(async () => browser?.close());

test("wide code and tables scroll inside the article on mobile and desktop", { skip }, async () => {
  const site = build("integration");
  const server = await serve(site.out);
  const context = await (browser as Browser).newContext({ viewport: { width: 320, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(`${server.url}/reflow/`, { waitUntil: "networkidle" });
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const widths = await page.evaluate(() => ({
        article: document.querySelector(".doc-body")!.getBoundingClientRect().width,
        html: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(widths.html <= width, `documentElement.scrollWidth is ${widths.html} at ${width}px`);
      assert.ok(widths.body <= width, `body.scrollWidth is ${widths.body} at ${width}px`);
      for (const selector of [".doc-body > .code-frame > .code", ".doc-body > table"]) {
        const scroll = await page.locator(selector).evaluate((element) => ({
          content: element.scrollWidth,
          viewport: element.clientWidth,
          overflow: getComputedStyle(element).overflowX,
        }));
        assert.equal(scroll.overflow, "auto", selector);
        assert.ok(scroll.content > scroll.viewport, `${selector} scrolls at ${width}px`);
        assert.ok(scroll.viewport <= widths.article, `${selector} fits in the article at ${width}px`);
      }
    }
  } finally {
    await context.close();
  }
});

test("the component directory and both columns fit at 320px without JavaScript", { skip }, async () => {
  const source = readFileSync(new URL("../site/components/index.md", import.meta.url), "utf8");
  const site = build("integration", process.env, { "components/index.md": source });
  const server = await serve(site.out);
  const context = await (browser as Browser).newContext({
    viewport: { width: 320, height: 800 },
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto(`${server.url}/components/`);
    const table = page.locator(".component-directory").getByRole("table");
    await table.getByRole("link", { name: "Add to calendar" }).waitFor();
    const widths = await table.evaluate((element) => ({
      documentWidth: document.documentElement.scrollWidth,
      tableWidth: element.clientWidth,
      tableScrollWidth: element.scrollWidth,
      parentWidth: element.parentElement!.clientWidth,
    }));
    assert.equal(widths.documentWidth, 320);
    assert.equal(widths.tableScrollWidth, widths.tableWidth);
    assert.ok(widths.tableWidth <= widths.parentWidth);
  } finally {
    await context.close();
  }
});
