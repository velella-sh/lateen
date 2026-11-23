// Figure zoom in a real browser (#1215): it opens and closes with script off, Escape closes it, focus
// returns to the button, motion is off under reduced motion, and the overlay never prints.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { build, serve } from "./integration-helpers.ts";

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22360%22%3E%3Crect width=%22640%22 height=%22360%22 fill=%22%23e7dfd2%22/%3E%3C/svg%3E";
const PAGE = `---
title: Zoom
layout: doc
permalink: /zoom/
---

::figure{src="${IMAGE}" alt="A beige rectangle." caption="A zoomable figure." width="640" height="360" zoom="true"}
`;

test("figure zoom works with JavaScript off, closes on Escape and returns focus (#1215)", async (t) => {
  const browser = await chromium.launch().catch(() => undefined);
  if (browser === undefined) {
    t.skip("Chromium is not installed (npx playwright install chromium)");
    return;
  }
  try {
    const site = build("integration", process.env, { "zoom.md": PAGE });
    const server = await serve(site.out);
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(new URL("/zoom/", server.url).href);

    const panel = page.locator(".figure-zoom-panel");
    const button = page.locator(".figure-zoom");
    assert.equal(await panel.isVisible(), false, "closed at first");
    await button.focus();
    await page.keyboard.press("Enter");
    assert.equal(await panel.isVisible(), true, "the keyboard opens it");
    await page.keyboard.press("Escape");
    assert.equal(await panel.isVisible(), false, "Escape closes it");
    assert.equal(await button.evaluate((element) => element === document.activeElement), true, "focus returns to the button");

    await button.click();
    assert.equal(await panel.isVisible(), true, "a click opens it");
    assert.equal(await panel.evaluate((element) => getComputedStyle(element).animationName), "none", "no motion under reduced motion");
    await page.locator(".figure-zoom-close").click();
    assert.equal(await panel.isVisible(), false, "the close button closes it");

    await button.click();
    await page.emulateMedia({ media: "print" });
    assert.equal(await panel.isVisible(), false, "the overlay is not printed");
  } finally {
    await browser.close();
  }
});
