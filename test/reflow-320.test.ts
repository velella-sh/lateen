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

test("an article stays inside 320px and scrolls code and tables in place", { skip }, async () => {
  const site = build("integration");
  const server = await serve(site.out);
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
