import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { chromium, type Browser } from "playwright";
import { t } from "../i18n/index.ts";
import { build, serve } from "./integration-helpers.ts";

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch {
  browser = undefined;
}
const skip = browser === undefined ? "Chromium is not installed (npx playwright install chromium)" : false;
after(async () => browser?.close());

test("the site footer reaches the viewport edge on short pages and follows long content", { skip }, async () => {
  const site = build("integration", process.env, {
    "short.md": "---\ntitle: Short page\nlayout: home\n---\nA short page.",
  });
  const server = await serve(site.out);
  const page = await (browser as Browser).newPage({ viewport: { width: 1440, height: 1200 } });
  try {
    await page.goto(`${server.url}/short/`);
    await page.evaluate(() => document.fonts.ready);
    const footer = page.locator("body > footer");
    assert.equal(await footer.evaluate((element) => element.getBoundingClientRect().bottom), 1200);

    await page.setViewportSize({ width: 375, height: 600 });
    await page.goto(`${server.url}/guide/install/`);
    assert.ok(await footer.evaluate((element) => element.getBoundingClientRect().top > window.innerHeight));
    await footer.scrollIntoViewIfNeeded();
    // The scroll position rounds to a whole pixel even when the content has a fractional height.
    assert.ok(await footer.evaluate((element) => Math.round(element.getBoundingClientRect().bottom) <= window.innerHeight));
  } finally {
    await page.close();
  }
});

test("the mobile search trigger shows an icon and opens with the keyboard in both directions", { skip }, async () => {
  const site = build("integration");
  const server = await serve(site.out);
  const page = await (browser as Browser).newPage({ viewport: { width: 320, height: 800 } });
  try {
    const routes = [
      ["/guide/install/", t("en", "search")],
      ["/fa/guide/install/", t("fa", "search")],
    ] as const;
    for (const [path, name] of routes) {
      await page.goto(server.url + path);
      const trigger = page.getByRole("button", { name, exact: true });
      const glyph = trigger.locator("svg[aria-hidden=true]");
      assert.ok(await glyph.isVisible(), `the search icon is visible on ${path}`);
      await trigger.press("Enter");
      const input = page.getByRole("combobox");
      assert.ok(await input.evaluate((element) => element === document.activeElement));
      await input.press("Escape");
      assert.ok(await trigger.evaluate((element) => element.matches(":focus-visible")));
    }
  } finally {
    await page.close();
  }
});

test("guide facts share space and long values wrap at 320px in Persian", { skip }, async () => {
  const source = readFileSync(new URL("accessibility/fixtures/site/fa/guide/install.md", import.meta.url), "utf8");
  const longValue = "نسخه‌پیش‌نمایش".repeat(10);
  const site = build("integration", process.env, { "fa/guide/install.md": source.replace("from: 0.1", `from: ${longValue}`) });
  const server = await serve(site.out);
  const page = await (browser as Browser).newPage({ viewport: { width: 320, height: 800 } });
  try {
    await page.goto(`${server.url}/fa/guide/install/`);
    const summary = page.getByRole("main").locator(".guide-summary");
    const dimensions = await summary.evaluate((element) => {
      const [from, to] = Array.from(element.children, (fact) => fact.getBoundingClientRect());
      return {
        firstRowSharesSpace: from!.top === to!.top && from!.left >= to!.right,
        summaryFits: element.scrollWidth <= element.clientWidth,
        pageFits: document.documentElement.scrollWidth === 320,
      };
    });
    assert.deepEqual(dimensions, { firstRowSharesSpace: true, summaryFits: true, pageFits: true });
  } finally {
    await page.close();
  }
});

test("wide code and tables scroll inside the article on mobile and desktop", { skip }, async () => {
  const site = build("integration");
  const server = await serve(site.out);
  const context = await (browser as Browser).newContext({ viewport: { width: 320, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(`${server.url}/reflow/`, { waitUntil: "networkidle" });
    const list = page.locator(".doc-body > ol");
    assert.equal(await list.evaluate((element) => getComputedStyle(element).listStyleType), "decimal");
    const nested = list.getByRole("list");
    assert.equal(await nested.evaluate((element) => getComputedStyle(element).listStyleType), "circle");
    assert.ok(await nested.evaluate((element) => element.scrollWidth <= element.clientWidth));
    assert.equal(await page.getByRole("columnheader", { name: "Type" }).evaluate((element) => getComputedStyle(element).textAlign), "center");

    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const widths = await page.evaluate(() => ({
        article: document.querySelector(".doc-body")!.getBoundingClientRect().width,
        html: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(widths.html <= width, `documentElement.scrollWidth is ${widths.html} at ${width}px`);
      assert.ok(widths.body <= width, `body.scrollWidth is ${widths.body} at ${width}px`);
      for (const selector of [".doc-body > .code-frame > .code", ".doc-body > .markdown-table-scroll"]) {
        const scroll = await page.locator(selector).evaluate((element) => ({
          content: element.scrollWidth,
          viewport: element.clientWidth,
          overflow: getComputedStyle(element).overflowX,
        }));
        assert.equal(scroll.overflow, "auto", selector);
        if (selector.includes("code") || width === 320) {
          assert.ok(scroll.content > scroll.viewport, `${selector} scrolls at ${width}px`);
        } else {
          assert.equal(scroll.content, scroll.viewport, "long cell values wrap on desktop");
        }
        assert.ok(scroll.viewport <= widths.article, `${selector} fits in the article at ${width}px`);
      }
    }
  } finally {
    await context.close();
  }
});

test("the component directory and the Table examples fit at 320px without JavaScript", { skip }, async () => {
  const directory = readFileSync(new URL("../site/components/index.md", import.meta.url), "utf8");
  const examples = readFileSync(new URL("../site/components/table.md", import.meta.url), "utf8");
  const site = build("integration", process.env, { "components/index.md": directory, "components/table.md": examples });
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

    await page.goto(`${server.url}/components/table/`);
    const region = page.getByRole("region", { name: "Deploy targets" });
    const authored = region.getByRole("table", { name: "Deploy targets" });
    assert.equal(await authored.evaluate((element) => getComputedStyle(element).display), "table");
    assert.equal(await authored.getByRole("columnheader", { name: "Target" }).getAttribute("colspan"), "2");
    assert.equal(await authored.getByRole("rowheader", { name: "Staging" }).getAttribute("scope"), "rowgroup");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    assert.equal(await region.getAttribute("tabindex"), "0");
    const { overflow, content, viewport } = await region.evaluate((element) => ({
      overflow: getComputedStyle(element).overflowX,
      content: element.scrollWidth,
      viewport: element.clientWidth,
    }));
    assert.equal(overflow, "auto");
    assert.ok(content > viewport, "the authored table scrolls within its region");
    await region.focus();
    assert.ok(await region.evaluate((element) => element === document.activeElement));
  } finally {
    await context.close();
  }
});

test("API reference examples have room on desktop and parameter tables scroll inside mobile pages", { skip }, async () => {
  const config = readFileSync(new URL("../fixtures/api-reference/mizzen.yml", import.meta.url), "utf8");
  const site = build("api-reference", process.env, {
    "mizzen.yml": config.replace(/^title: .+$/m, "title: Lateen"),
  });
  const server = await serve(site.out);
  const page = await (browser as Browser).newPage({ viewport: { width: 320, height: 800 } });
  try {
    await page.goto(`${server.url}/reference/createWidget/`);
    const table = page.locator(".api-reference-table-wrap");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    assert.ok(await table.evaluate((element) => element.scrollWidth > element.clientWidth));
    assert.equal(await table.evaluate((element) => getComputedStyle(element).overflowX), "auto");

    await page.setViewportSize({ width: 1440, height: 900 });
    const examples = await page.locator(".api-reference-example-code").evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().width),
    );
    assert.ok(examples.length >= 2);
    assert.ok(examples.every((width) => width >= 44 * 16));
  } finally {
    await page.close();
  }
});
