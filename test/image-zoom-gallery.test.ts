// A multi-image figure zooms one panel per image, with previous and next buttons that use
// `popovertarget`, so they work without script (#1467).
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import figure, { type FigureProps } from "../components/figure/index.ts";
import { build, serve } from "./integration-helpers.ts";

const IMAGES = JSON.stringify([
  { src: "/a.png", alt: "First" },
  { src: "/b.png", alt: "Second" },
  { src: "/c.png", alt: "Third" },
]);

function render(props: FigureProps, lang = "en") {
  return renderToString(
    figure({ props, html: "", page: { lang } as ComponentProps["page"], site: {} as ComponentProps["site"] } as ComponentProps<FigureProps>) as never,
  );
}

test("a three-image figure has three panels linked in a ring with the position announced", () => {
  const html = render({ images: IMAGES, zoom: "true", id: "set" });
  const panels = html.match(/<div id="set-zoom-\d" popover="auto"[^>]*>/g) ?? [];
  assert.equal(panels.length, 3);
  assert.match(html, /id="set-zoom-2" popover="auto" class="figure-zoom-panel" role="dialog" aria-label="Second, 2 of 3"/);
  const second = html.slice(html.indexOf('id="set-zoom-2"'), html.indexOf('id="set-zoom-3"'));
  assert.match(second, /class="figure-zoom-prev" popovertarget="set-zoom-1"/);
  assert.match(second, /class="figure-zoom-next" popovertarget="set-zoom-3"/);
  assert.match(second, /<span class="figure-zoom-position">2 of 3<\/span>/);
  // The ring wraps: the first panel's previous is the last, the last panel's next is the first.
  const first = html.slice(html.indexOf('id="set-zoom-1"'), html.indexOf('id="set-zoom-2"'));
  assert.match(first, /class="figure-zoom-prev" popovertarget="set-zoom-3"/);
  assert.doesNotMatch(html, /<script/);
});

test("the buttons are named, and a figure without zoom or with one image has no panels", () => {
  assert.match(render({ images: IMAGES, zoom: "true" }), /aria-label="Previous image"/);
  assert.doesNotMatch(render({ images: IMAGES }), /popover/);
  assert.doesNotMatch(render({ src: "/a.png", alt: "A", zoom: "true" }), /figure-zoom-nav/);
});

test("the position and button names follow the page language", () => {
  assert.match(render({ images: IMAGES, zoom: "true" }, "ar"), /<span class="figure-zoom-position">1 من 3<\/span>/);
});

const PIXEL =
  "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22360%22%3E%3Crect width=%22640%22 height=%22360%22 fill=%22%23e7dfd2%22/%3E%3C/svg%3E";
const REAL = JSON.stringify(["First", "Second", "Third"].map((alt) => ({ src: PIXEL, alt })));

const PAGE = (dir: "ltr" | "rtl") => `---
title: Gallery
layout: doc
permalink: /gallery/
lang: ${dir === "rtl" ? "ar" : "en"}
---

::figure{images='${REAL}' caption="Three images." zoom="true" width="640" height="360"}
`;

const MODES = [
  { dir: "ltr", script: true },
  { dir: "rtl", script: true },
  { dir: "ltr", script: false },
] as const;

for (const { dir, script } of MODES) {
  const how = script ? "with the island, one panel open at a time" : "with script off, forward";
  test(`the keyboard moves through three images ${how}, ${dir}`, async (t) => {
    const browser = await chromium.launch().catch(() => undefined);
    if (browser === undefined) {
      t.skip("Chromium is not installed (npx playwright install chromium)");
      return;
    }
    try {
      const site = build("integration", process.env, { "gallery.md": PAGE(dir) });
      const server = await serve(site.out);
      const context = await browser.newContext({ javaScriptEnabled: script });
      const page = await context.newPage();
      await page.goto(new URL("/gallery/", server.url).href);
      // Without the island a button inside an open panel keeps it open while it opens the next (the platform
      // nests them), so the panel on top is the one under the middle of the viewport.
      const topPanel = "document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.figure-zoom-panel')";
      const open = async () => (await page.evaluate(`${topPanel}?.getAttribute("aria-label") ?? ""`)) as string;
      const count = async () => page.locator(".figure-zoom-panel:popover-open").count();
      const press = async (which: "prev" | "next") => {
        await page.evaluate(`${topPanel}?.querySelector(".figure-zoom-${which}")?.focus()`);
        await page.keyboard.press("Enter");
      };

      await page.locator(".figure-zoom").first().focus();
      await page.keyboard.press("Enter");
      assert.match(await open(), /^First, 1 /);
      await press("next");
      assert.match(await open(), /^Second, 2/);
      await press("next");
      assert.match(await open(), /^Third, 3/);
      if (script) {
        assert.equal(await count(), 1, "one panel is open");
        await press("next");
        assert.match(await open(), /^First, 1/, "next wraps to the first image");
        await press("prev");
        assert.match(await open(), /^Third, 3/);
        await press("prev");
        assert.match(await open(), /^Second, 2/);
        await press("prev");
        assert.match(await open(), /^First, 1/);
        assert.equal(await count(), 1, "one panel is open");
      }

      const x = async (selector: string) =>
        page.evaluate(`${topPanel}?.querySelector("${selector}")?.getBoundingClientRect().left`) as Promise<number>;
      const prev = await x(".figure-zoom-prev");
      const next = await x(".figure-zoom-next");
      assert.equal(dir === "ltr" ? prev < next : prev > next, true, "previous comes first in the reading direction");
      for (let step = 0; step < 6 && (await count()) > 0; step++) await page.keyboard.press("Escape");
      assert.equal(await count(), 0, "Escape closes every opened panel");
    } finally {
      await browser.close();
    }
  });
}
