import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { chromium, type Browser } from "playwright";
import { findUnstyled, RULES } from "../visual/unstyled.ts";
import { DEFAULT_LOOK_BASE, buildFixture } from "./visual/fixtures/build.ts";
import { serve, tempDir } from "./integration-helpers.ts";

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch {
  browser = undefined;
}
const skip = browser === undefined ? "Chromium is not installed (npx playwright install chromium)" : false;
after(async () => browser?.close());

/** A page with every element the check looks at, written the way the theme writes them. */
const CLEAN = `<!doctype html><meta charset="utf-8"><title>clean</title>
<style>
  body { margin: 0; font: 16px/1.5 sans-serif; }
  header { height: 60px; display: flex; align-items: center; padding: 0 16px; }
  caption { text-align: start; }
  table { border-collapse: collapse; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; }
  .api-page { display: grid; grid-template-columns: 1fr 20rem; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
<header><a href="/">Site</a> <span class="sr">Read it in English</span></header>
<main class="api-page"><article>
  <table><caption>Fields</caption><tr><th>Name</th><td>id</td></tr></table>
  <dl><dt>Key</dt><dd>Value</dd></dl>
</article><aside>Examples</aside></main>`;

test("the check names its rules", () => {
  assert.ok(RULES.includes("caption-centered") && RULES.includes("container-without-layout") && RULES.includes("sr-text-visible"));
});

test("the check finds nothing on a page with the theme's rules", { skip }, async () => {
  const page = await (browser as Browser).newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.setContent(CLEAN);
    assert.deepEqual(await findUnstyled(page), []);
  } finally {
    await page.close();
  }
});

test("the check reports a selector, a rule and a box for each broken element", { skip }, async () => {
  const page = await (browser as Browser).newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.setContent(
      CLEAN.replace("text-align: start", "text-align: center")
        .replace("border-collapse: collapse", "border-collapse: separate")
        .replace("display: grid; grid-template-columns: max-content", "display: block; grid-template-columns: max-content")
        .replace("display: grid; grid-template-columns: 1fr 20rem", "display: block")
        .replace("clip: rect(0 0 0 0)", "clip: auto; overflow: visible; width: auto; height: auto")
        .replace("</main>", '<div style="position: absolute; left: 1400px">Far</div></main>'),
    );
    const found = await findUnstyled(page);
    const rules = new Set(found.map((finding) => finding.rule));
    for (const rule of ["caption-centered", "table-border-model", "dl-without-grid", "container-without-layout", "sr-text-visible", "viewport-overflow"]) {
      assert.ok(rules.has(rule as never), `reports ${rule}`);
    }
    for (const finding of found) {
      assert.ok(finding.selector.length > 0);
      assert.ok(finding.box.width >= 0 && finding.box.height >= 0);
    }
    assert.ok(found.some((finding) => finding.rule === "caption-centered" && finding.selector.endsWith("caption")));
  } finally {
    await page.close();
  }
});

test("an element that leaves the header is reported once, at its outermost box", { skip }, async () => {
  const page = await (browser as Browser).newPage({ viewport: { width: 320, height: 600 } });
  try {
    await page.setContent(CLEAN.replace("<header>", '<header><div class="wide" style="width: 600px; flex-shrink: 0"><span>inner</span></div>'));
    const found = (await findUnstyled(page)).filter((finding) => finding.rule === "header-overflow");
    assert.equal(found.filter((finding) => /\.wide/.test(finding.selector)).length, 1, "the wide box once");
    assert.ok(!found.some((finding) => /\.wide.*span/.test(finding.selector)), "not its children");
  } finally {
    await page.close();
  }
});

test("the default-look fixture shows its three known defects", { skip }, async () => {
  const dir = tempDir("design-audit-unstyled-");
  buildFixture(join(dir, DEFAULT_LOOK_BASE), undefined, "default");
  const server = await serve(dir);
  const page = await (browser as Browser).newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${server.url}${DEFAULT_LOOK_BASE}/gallery/`);
    const gallery = await findUnstyled(page);
    assert.ok(gallery.some((finding) => finding.rule === "caption-centered"), "a centred caption");

    await page.goto(`${server.url}${DEFAULT_LOOK_BASE}/api/`);
    const api = await findUnstyled(page);
    assert.ok(api.some((finding) => finding.rule === "sr-text-visible" && finding.selector.includes("language-switcher-sr")), "language text drawn in the header");
    assert.ok(api.some((finding) => finding.rule === "container-without-layout" && /\.api-page(:nth-of-type\(\d+\))?$/.test(finding.selector)), ".api-page without a grid");
  } finally {
    await page.close();
  }
});
