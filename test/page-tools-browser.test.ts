import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { chromium, type Browser } from "playwright";
import { build, serve } from "./integration-helpers.ts";

const site = build("page-tools");

test("the tool is copied once and only the opted-in page references it", () => {
  assert.ok(existsSync(join(site.out, "tool/tool.js")), "the engine copied the tool to its page URL");
  const withTool = site.html("/");
  const withoutTool = site.html("/plain/");
  assert.match(withTool, /<script type="module" src="\/tool\/tool.js">/);
  assert.match(withTool, /data-page-tool/);
  assert.match(withTool, /data-page-tool-out|page-tool-fallback/);
  assert.doesNotMatch(withoutTool, /tool\/tool\.js/);
  assert.doesNotMatch(withoutTool, /data-page-tool/);
});

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch {
  browser = undefined;
}
const skip = browser === undefined ? "Chromium is not installed (npx playwright install chromium)" : false;

after(async () => {
  await browser?.close();
});

test("the tool fills its slot and local input sends nothing over the network", { skip }, async () => {
  const server = await serve(site.out);
  const context = await (browser as Browser).newContext();
  try {
    const page = await context.newPage();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${server.url}/`);
    await page.locator("#page-tool-value").fill("local only");
    assert.equal(await page.locator("[data-page-tool-out]").textContent(), "local only");
    assert.deepEqual(
      requests.filter((url) => !url.startsWith(server.url) && !url.startsWith("data:")),
      [],
      "no input or tool call leaves the browser",
    );

    const plain = await context.newPage();
    const plainRequests: string[] = [];
    plain.on("request", (request) => plainRequests.push(request.url()));
    await plain.goto(`${server.url}/plain/`);
    assert.equal(await plain.locator("[data-page-tool]").count(), 0);
    assert.deepEqual(plainRequests.filter((url) => url.includes("tool.js")), [], "a page without tool: loads no tool");
  } finally {
    await context.close();
  }
});
