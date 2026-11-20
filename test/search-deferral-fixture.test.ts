import assert from "node:assert/strict";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "./integration-helpers.ts";

/** The Pagefind module the results page imports; it is the index's startup script. */
const INDEX = "pagefind/pagefind.js";

test("only the search results page references the Pagefind index", () => {
  const site = build("integration");
  try {
    const pages = new Map<string, string>();
    for (const file of readdirSync(site.out, { recursive: true, encoding: "utf8" })) {
      if (!file.endsWith(".html")) continue;
      pages.set("/" + file.split(/[\\/]/).join("/"), readFileSync(join(site.out, file), "utf8"));
    }
    assert.ok(pages.has("/search/index.html"), `the fixture builds no search page: ${[...pages.keys()].join(", ")}`);

    const referencing = [...pages].filter(([, html]) => html.includes(INDEX)).map(([path]) => path);
    assert.deepEqual(referencing, ["/search/index.html"], "no page but the results page statically references the index");

    for (const [path, html] of pages) {
      if (path !== "/search/index.html") {
        assert.doesNotMatch(html, /<link\b[^>]*pagefind/i, `${path} links the index`);
      }
    }

    const search = pages.get("/search/index.html")!;
    const inline = [...search.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1] ?? "")
      .filter((script) => script.includes(INDEX));
    assert.equal(inline.length, 1, "the results page starts the index from one inline script");
    assert.match(inline[0] ?? "", /new URLSearchParams\(location\.search\)/, "the results page reads its query from the address");
  } finally {
    rmSync(site.out, { recursive: true, force: true });
  }
});
