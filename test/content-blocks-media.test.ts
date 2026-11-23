// Callouts, code blocks, figures and states under print and forced-colors media, in a real browser (#1219).
// Print must keep every word readable on paper (no clipped code, no closed body, no overlay); forced
// colors must keep every edge, because a token color is replaced by the reader's palette.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { build, serve } from "./integration-helpers.ts";

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221600%22 height=%22400%22%3E%3Crect width=%221600%22 height=%22400%22 fill=%22%23e7dfd2%22/%3E%3C/svg%3E";
const LONG_LINE = `const value = "${"x".repeat(220)}";`;

const PAGE = `---
title: Blocks in print
layout: doc
permalink: /blocks/
---

## Blocks

:::callout{type=warning title="Back up first" collapsible}
The hidden body of a collapsed callout.
:::

\`\`\`ts title="long.ts"
${LONG_LINE}
\`\`\`

::figure{src="${IMAGE}" alt="A wide beige rectangle." caption="A wide figure." width="1600" height="400" zoom="true"}

::state{kind=error title="It failed" description="Try again in a moment." actions='[{"href":"/","label":"Home"}]'}
`;

test("print keeps callout bodies, long code and figures readable and never prints the zoom overlay (#1219)", async (t) => {
  const browser = await chromium.launch().catch(() => undefined);
  if (browser === undefined) {
    t.skip("Chromium is not installed (npx playwright install chromium)");
    return;
  }
  try {
    const site = build("integration", process.env, { "blocks.md": PAGE });
    const server = await serve(site.out);
    const page = await (await browser.newContext({ viewport: { width: 794, height: 1123 } })).newPage();
    await page.goto(new URL("/blocks/", server.url).href);
    await page.emulateMedia({ media: "print" });

    const body = page.locator(".callout-disclosure .callout-body");
    assert.equal(await body.evaluate((element) => element.getBoundingClientRect().height > 0), true, "a closed callout prints its body");

    const code = page.locator("main pre.code code").first();
    const wraps = await code.evaluate((element) => getComputedStyle(element).whiteSpace);
    assert.match(wraps, /pre-wrap|break-spaces/, "long code wraps on paper instead of being clipped");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      true,
      "nothing makes the printed page wider than the paper",
    );

    const image = page.locator(".figure-zoom img");
    const box = await image.boundingBox();
    assert.ok(box !== null && box.width <= 794, "the figure fits the page width");
    assert.equal(await page.locator(".figure-zoom-panel").isVisible(), false, "the zoom overlay is not printed");
  } finally {
    await browser.close();
  }
});

test("forced colors keep a visible edge on callouts, code, the zoom panel and states (#1219)", async (t) => {
  const browser = await chromium.launch().catch(() => undefined);
  if (browser === undefined) {
    t.skip("Chromium is not installed (npx playwright install chromium)");
    return;
  }
  try {
    const site = build("integration", process.env, { "blocks.md": PAGE });
    const server = await serve(site.out);
    const context = await browser.newContext({ forcedColors: "active", viewport: { width: 1000, height: 900 } });
    const page = await context.newPage();
    await page.goto(new URL("/blocks/", server.url).href);

    const edge = (selector: string) =>
      page.locator(selector).first().evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: parseFloat(style.borderTopWidth) + parseFloat(style.borderInlineStartWidth), style: style.borderTopStyle };
      });
    for (const selector of [".callout", ".code-frame"]) {
      const result = await edge(selector);
      assert.ok(result.width > 0 && result.style !== "none", `${selector} keeps a border in forced colors`);
    }

    await page.locator(".figure-zoom").click();
    const panel = await edge(".figure-zoom-panel");
    assert.ok(panel.width > 0 && panel.style !== "none", "the zoom panel keeps its border");
    await page.keyboard.press("Escape");

    const status = page.locator(".state-error");
    assert.equal(await status.getAttribute("role"), "status");
    assert.equal(await status.locator(".state-primary").isVisible(), true, "the recovery link stays visible");
  } finally {
    await browser.close();
  }
});
