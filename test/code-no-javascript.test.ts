// Code blocks, language tabs, diffs and long examples with JavaScript turned off, in a real browser
// (#1213). The page must read and operate without script: no control that does nothing, the tab list
// out of the way, every language block visible under its title, and the long example opening natively.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { build, serve } from "./integration-helpers.ts";

const LONG = Array.from({ length: 30 }, (_, index) => `const line${index + 1} = ${index + 1};`).join("\n");

const PAGE = `---
title: Code without script
layout: doc
permalink: /no-js/
---

## Blocks

\`\`\`ts title="a.ts" {2} showLineNumbers
const a = 1;
const b = 2;
\`\`\`

\`\`\`ts
${LONG}
\`\`\`

\`\`\`ts diff
-old line
+new line
 same line
\`\`\`

:::code-tabs{labels='["npm","pnpm"]'}
\`\`\`bash
npm install widget
\`\`\`

\`\`\`bash
pnpm add widget
\`\`\`
:::
`;

test("code blocks, tabs, diffs and long examples work with JavaScript off (#1213)", async (t) => {
  const browser = await chromium.launch().catch(() => undefined);
  if (browser === undefined) {
    t.skip("Chromium is not installed (npx playwright install chromium)");
    return;
  }
  try {
    const site = build("integration", process.env, { "no-js.md": PAGE });
    const server = await serve(site.out);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(new URL("/no-js/", server.url).href);

    // Every block still reads: its text is in the page and visible.
    const blocks = page.locator("main pre.code");
    assert.ok((await blocks.count()) >= 5, "every fence is a code block");
    for (const block of await blocks.all()) {
      const name = (await block.getAttribute("aria-label")) ?? (await block.getAttribute("aria-labelledby"));
      assert.ok(name, "every block is named");
    }

    // No dead control: the copy and wrap buttons are built by the island, so none is in the page.
    assert.equal(await page.locator("main .code-copy, main .code-wrap, main [data-code-copy-button]").count(), 0);

    // The language tabs: the tab list stays hidden and every block shows stacked under its heading.
    const tablist = page.locator(".code-tabs [role=tablist]");
    assert.equal(await tablist.isVisible(), false, "the tab list is not shown without script");
    const titles = page.locator(".code-tabs h3");
    assert.deepEqual(await titles.allInnerTexts(), ["npm", "pnpm"]);
    for (const panel of await page.locator(".code-tabs-panel").all()) assert.equal(await panel.isVisible(), true);

    // The long example is a native disclosure that opens with the keyboard and keeps all its lines.
    const disclosure = page.locator("main details", { has: page.locator("pre.code") }).first();
    assert.equal(await disclosure.evaluate((element: HTMLDetailsElement) => element.open), false);
    await disclosure.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await disclosure.evaluate((element: HTMLDetailsElement) => element.open), true);
    assert.equal(await disclosure.locator(".line").count(), 30, "the full code is in the page");

    // The diff reads as text: removed and added lines are marked by class, not by script.
    assert.equal(await page.locator("main .line.del").count(), 1);
    assert.equal(await page.locator("main .line.ins").count(), 1);
  } finally {
    await browser.close();
  }
});
