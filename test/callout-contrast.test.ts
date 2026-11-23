import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import callout, { type CalloutKind } from "../components/callout/index.ts";

const KINDS: readonly CalloutKind[] = ["note", "tip", "important", "warning", "caution"];

/** One callout of a kind on its own page object, so title ids are counted per call. */
function markup(kind: CalloutKind, collapsible: boolean): string {
  const page = { lang: "en", html: "" } as unknown as Page;
  const props = { props: { type: kind, title: `A ${kind}`, collapsible, open: collapsible }, html: "<p>Body</p>", page, site: {} };
  return renderToString(callout(props as unknown as ComponentProps) as never);
}

type Sample = { readonly text: string; readonly body: string; readonly icon: string; readonly background: string };
type Rgb = readonly [number, number, number];

/** WCAG 2.2 contrast of two opaque colors. */
function contrast(a: Rgb, b: Rgb): number {
  const luminance = ([r, g, bl]: Rgb) => {
    const [x = 0, y = 0, z = 0] = [r, g, bl].map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * x + 0.7152 * y + 0.0722 * z;
  };
  const [high = 0, low = 0] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (high + 0.05) / (low + 0.05);
}

const rgb = (value: string): Rgb => {
  const parts = value.split(",").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

test("every callout kind keeps its title, body and icon readable in both modes (#1210)", async (t) => {
  const browser = await chromium.launch().catch(() => undefined);
  if (browser === undefined) {
    t.skip("Chromium is not installed (npx playwright install chromium)");
    return;
  }
  try {
    const page = await browser.newPage();
    for (const mode of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: mode });
      for (const collapsible of [false, true]) {
        const html = KINDS.map((kind) => markup(kind, collapsible)).join("");
        await page.setContent(`<!doctype html><html data-theme="${mode}"><body>${html}</body></html>`);
        for (const sheet of ["tokens.css", "generated.css"]) await page.addStyleTag({ path: fileURLToPath(new URL(`../styles/${sheet}`, import.meta.url)) });
        const samples: Sample[] = await page.evaluate(() => {
          // Reduce any computed CSS color to opaque sRGB by painting it on a canvas pixel.
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d", { willReadFrequently: true })!;
          const toRgb = (color: string): string => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = "#000";
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
            return `${r},${g},${b}`;
          };
          return [...document.querySelectorAll<HTMLElement>(".callout")].map((box) => {
            const title = box.querySelector<HTMLElement>(".callout-title")!;
            const body = box.querySelector<HTMLElement>(".callout-body p")!;
            const icon = box.querySelector<HTMLElement>(".callout-icon")!;
            return {
              text: toRgb(getComputedStyle(title).color),
              body: toRgb(getComputedStyle(body).color),
              icon: toRgb(getComputedStyle(icon).color),
              background: toRgb(getComputedStyle(box).backgroundColor),
            };
          });
        });
        assert.equal(samples.length, KINDS.length);
        samples.forEach((sample, index) => {
          const where = `${KINDS[index]} callout${collapsible ? " (collapsible)" : ""} in ${mode} mode`;
          const background = rgb(sample.background);
          const title = contrast(rgb(sample.text), background);
          const body = contrast(rgb(sample.body), background);
          const icon = contrast(rgb(sample.icon), background);
          assert.ok(title >= 4.5, `the title of the ${where} is ${title.toFixed(2)}:1; it needs 4.5:1`);
          assert.ok(body >= 4.5, `the body of the ${where} is ${body.toFixed(2)}:1; it needs 4.5:1`);
          assert.ok(icon >= 3, `the icon of the ${where} is ${icon.toFixed(2)}:1; it needs 3:1`);
        });
      }
    }
  } finally {
    await browser.close();
  }
});
