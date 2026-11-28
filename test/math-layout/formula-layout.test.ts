// Formula styles and markup: the same MathML has to read in light and dark, at a narrow width,
// and inside right-to-left prose. Read the built MathML and also check scroll behavior in Chromium.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { all, attrs, build, serve, textOf } from "../integration-helpers.ts";

const css = readFileSync(new URL("../../styles/src/prose.css", import.meta.url), "utf8");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

const wide = `$$\n${Array.from({ length: 40 }, (_, i) => `a_${i}`).join(" + ")} = c\n$$`;
const fixture = build("math", process.env, {
  "wide.md": `---\ntitle: Wide equation\n---\n\n${wide}\n`,
  "fa/wide.md": `---\ntitle: معادلهٔ عریض\n---\n\n${wide}\n`,
});
const page = fixture.document("/");
const rtlPage = fixture.document("/fa/");

test("nothing in the styles hides a formula or its annotation from assistive technology", () => {
  assert.doesNotMatch(withoutComments, /(?:^|\})\s*(?:math|annotation|semantics|mrow)\b[^{]*\{[^}]*(?:display:\s*none|visibility:\s*hidden)/);
});

test("inline and block formulas carry their display, direction, and TeX text", () => {
  assert.equal(all(page, "math[display=\"inline\"]").length, 2);
  assert.equal(all(page, "math[display=\"block\"]").length, 1);
  assert.deepEqual(attrs(page, "math", "dir"), ["ltr", "ltr", "ltr"]);
  assert.deepEqual(attrs(page, 'math[display="inline"]', "alttext"), ["a^2", "\\frac{a}{b}"]);

  const block = page.querySelector('math[display="block"]');
  assert.equal(block?.getAttribute("alttext"), "\\frac{a}{b} = c");
  assert.equal(textOf(block?.querySelector('annotation[encoding="application/x-tex"]')), "\\frac{a}{b} = c");
  assert.ok(block?.querySelector("semantics > mrow"), "the MathML tree is the semantics body");
  assert.equal(block?.getAttribute("aria-hidden"), null);
});

test("right-to-left prose keeps formulas left to right", () => {
  assert.equal(rtlPage.documentElement.getAttribute("dir"), "rtl");
  assert.equal(all(rtlPage, "math").length, 3);
  assert.deepEqual(attrs(rtlPage, "math", "dir"), ["ltr", "ltr", "ltr"]);
});

test("block formulas have a localized focusable region and inline formulas stay in prose", () => {
  for (const [document, label] of [[page, "Equation"], [rtlPage, "معادله"]] as const) {
    const wrapper = document.querySelector(".math-scroll");
    assert.equal(wrapper?.getAttribute("role"), "region");
    assert.equal(wrapper?.getAttribute("aria-label"), label);
    assert.equal(wrapper?.getAttribute("tabindex"), "0");
    assert.equal(wrapper?.getAttribute("dir"), "ltr");
    assert.ok(wrapper?.querySelector(':scope > math[display="block"]'));
    assert.equal(wrapper?.querySelector('math[display="inline"]'), null);
  }
});

test("wide math scrolls by keyboard at 320px without widening either page direction", async (t) => {
  const browser = await chromium.launch().catch(() => undefined);
  if (browser === undefined) {
    t.skip("Chromium is not installed (npx playwright install chromium)");
    return;
  }
  try {
    const server = await serve(fixture.out);
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 320, height: 600 } });
    for (const [path, label] of [["/wide/", "Equation"], ["/fa/wide/", "معادله"]] as const) {
      await page.goto(server.url + path);
      const scroll = page.getByRole("region", { name: label, exact: true });
      const layout = await scroll.evaluate((element) => ({
        isScrollable: element.scrollWidth > element.clientWidth,
        overflowX: getComputedStyle(element).overflowX,
        direction: getComputedStyle(element).direction,
        startsAtLeft: element.scrollLeft === 0,
        pageFits: document.documentElement.scrollWidth === innerWidth,
      }));
      assert.deepEqual(layout, {
        isScrollable: true,
        overflowX: "auto",
        direction: "ltr",
        startsAtLeft: true,
        pageFits: true,
      });
      await scroll.focus();
      assert.ok(await scroll.evaluate((element) => element === document.activeElement));
      await page.keyboard.press("ArrowRight");
      // Poll from Node so the test leaves script execution disabled on the page.
      let offset = 0;
      for (let attempt = 0; attempt < 40 && offset === 0; attempt += 1) {
        await delay(25);
        offset = await scroll.evaluate((element) => element.scrollLeft);
      }
      assert.ok(offset > 0, `ArrowRight scrolled the math region on ${path}`);
    }
  } finally {
    await browser.close();
  }
});
