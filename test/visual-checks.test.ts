import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { checkPage, formatFinding, isExcepted, type CheckName } from "../scripts/visual-checks.ts";

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch {
  browser = undefined;
}
const skip = browser === undefined ? "Chromium is not installed (npx playwright install chromium)" : false;

const WORDS = "lorem ipsum dolor sit amet consectetur ".repeat(40);
const HEAD = `<style>:root{--measure-min:65ch;--measure-max:80ch}body{margin:0;font:16px/1.5 monospace}</style>`;

async function findings(body: string, width = 800): Promise<Awaited<ReturnType<typeof checkPage>>> {
  const context = await (browser as Browser).newContext({ viewport: { width, height: 600 } });
  try {
    const page: Page = await context.newPage();
    await page.setContent(`<!doctype html><html><head>${HEAD}</head><body>${body}</body></html>`);
    return await checkPage(page, "case", "desktop", []);
  } finally {
    await context.close();
  }
}
const only = (all: Awaited<ReturnType<typeof findings>>, check: CheckName) => all.filter((f) => f.check === check);

test("overflow: a fitting page passes, a page wider than the viewport fails and names the element", { skip }, async () => {
  assert.deepEqual(only(await findings("<p>short</p>"), "overflow"), []);
  const bad = only(await findings(`<div id="wide" style="width:1200px">x</div>`), "overflow");
  assert.ok(bad.some((f) => f.selector === "html"));
  assert.ok(bad.some((f) => f.selector === "div#wide"));
  assert.equal(only(await findings(`<div style="overflow-x:auto"><div style="width:1200px">x</div></div>`), "overflow").length, 0);
});

test("clipped text: a box that fits passes, a box that hides its text fails", { skip }, async () => {
  assert.deepEqual(only(await findings(`<div style="overflow:hidden;width:300px">hello</div>`), "clipped-text"), []);
  const bad = only(await findings(`<div class="card" style="overflow:hidden;width:50px;white-space:nowrap">a long label that cannot fit</div>`), "clipped-text");
  assert.equal(bad.length, 1);
  assert.equal(bad[0]?.selector, "body > div.card");
});

test("small target: 24 by 24 passes, smaller fails, inline links in text are not targets", { skip }, async () => {
  assert.deepEqual(only(await findings(`<button style="width:24px;height:24px;padding:0">x</button>`), "small-target"), []);
  const bad = only(await findings(`<button id="tiny" style="width:16px;height:16px;padding:0">x</button>`), "small-target");
  assert.equal(bad.length, 1);
  assert.equal(bad[0]?.selector, "button#tiny");
  assert.deepEqual(only(await findings(`<p>see <a href="#a">this link</a> for more</p>`), "small-target"), []);
  assert.equal(only(await findings(`<nav><a href="#a" style="display:inline-block;height:10px">x</a></nav>`), "small-target").length, 1);
});

test("measure: a line within the tokens passes, too long fails, a needlessly narrow paragraph fails", { skip }, async () => {
  assert.deepEqual(only(await findings(`<p style="max-width:72ch">${WORDS}</p>`), "measure"), []);
  const long = only(await findings(`<p id="long">${WORDS}</p>`, 1600), "measure");
  assert.equal(long.length, 1);
  assert.match(long[0]?.detail ?? "", /over the measure-max/);
  const narrow = only(await findings(`<div><p id="narrow" style="width:40ch">${WORDS}</p></div>`), "measure");
  assert.equal(narrow.length, 1);
  assert.match(narrow[0]?.detail ?? "", /under the measure-min/);
});

test("a finding prints the page, the matrix entry and the selector", () => {
  assert.equal(
    formatFinding({ check: "overflow", selector: "div#wide", detail: "d", page: "home", entry: "mobile" }),
    "home [mobile] overflow div#wide: d",
  );
});

test("an exception needs a reason and matches check, selector and page", () => {
  const f = { check: "small-target", selector: "a.x", detail: "" } as const;
  const e = { check: "small-target", selector: "a.x", reason: "icon link inside a 24px row" } as const;
  assert.equal(isExcepted(f, "home", [e]), true);
  assert.equal(isExcepted(f, "home", [{ ...e, reason: " " }]), false);
  assert.equal(isExcepted(f, "home", [{ ...e, page: "other" }]), false);
  assert.equal(isExcepted(f, "home", [{ ...e, check: "overflow" }]), false);
});

test.after(async () => {
  await browser?.close();
});
