import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { build, root, serve } from "../integration-helpers.ts";

test("the real index filters and sorts records using the form's URL", async (context) => {
  const browser = await chromium.launch().catch(() => undefined);
  if (browser === undefined) {
    context.skip("Chromium is unavailable");
    return;
  }
  try {
    const config = readFileSync(join(root, "fixtures/data-site/mizzen.yml"), "utf8");
    const site = build("data-site", process.env, {
      "search.md": readFileSync(join(root, "fixtures/integration/search.md"), "utf8"),
      "mizzen.yml": config.replace(
        "    markdown: [summary]",
        "    markdown: [summary]\n    dates: [released]\n    search:\n      filters: [region]\n      sort: [released]",
      ),
    });
    const server = await serve(site.out);
    const page = await browser.newPage();
    const query = "?filter.collection=components&filter.region=north&sort=released&order=desc";
    const response = await page.goto(`${server.url}/search/${query}`, { waitUntil: "domcontentloaded" });
    assert.ok(response?.ok(), "the fixture publishes a search page");
    const links = page.locator("[data-search-results] a");
    await links.nth(2).waitFor({ timeout: 10_000 });
    const hrefs = () => links.evaluateAll((results) => results.map((link) => link.getAttribute("href")));
    assert.deepEqual(await hrefs(), ["/components/code-block/", "/components/dialog/", "/components/button/"]);

    const search = page.locator("[data-search-page]");
    await search.locator('select[name="filter.region"]').waitFor();
    const order = search.getByLabel("Sort order");
    await order.selectOption("asc");
    await search.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("order") === "asc");
    assert.equal(new URL(page.url()).searchParams.get("filter.region"), "north");
    await links.nth(2).waitFor({ timeout: 10_000 });
    assert.deepEqual(await hrefs(), ["/components/button/", "/components/dialog/", "/components/code-block/"]);
  } finally {
    await browser.close();
  }
});
