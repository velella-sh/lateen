// Component islands must load only on their consuming pages. The packaged performance fixture proves
// it on real pages: a prose article requests no island entry, and the compare page asks for its own
// once, while another route never downloads that island.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { manifestOf, type ManifestRoute } from "../scripts/asset-manifest.ts";
import { build } from "./integration-helpers.ts";

// An island's entry is the `<name>/client.js` module the page requests. Modules it imports share the
// `js/components` class but are helper responses, not a second island.
const islandEntries = (route: ManifestRoute): string[] =>
  route.assets
    .filter((asset) => asset.class === "js/components" && asset.path.endsWith("/client.js"))
    .map((asset) => asset.path);

test("the packaged performance fixture loads component islands only where used", () => {
  const site = build("performance");
  try {
    const manifest = manifestOf(site.out);

    for (const route of manifest.routes) {
      const paths = route.assets.map((asset) => asset.path);
      assert.equal(new Set(paths).size, paths.length, `${route.route}: no asset is downloaded twice`);
    }

    const simple = manifest.routes.find((route) => route.route === "/alpha/");
    assert.ok(simple);
    assert.deepEqual(islandEntries(simple), [], "a simple article loads no component island");

    const consuming = manifest.routes.find((route) => route.route === "/alpha/compare/");
    assert.ok(consuming);
    assert.deepEqual(
      islandEntries(consuming),
      ["assets/theme/islands/components/compare/client.js"],
      "the consuming page asks for its island exactly once",
    );

    const other = manifest.routes.find((route) => route.route === "/alpha/reports/");
    assert.ok(other);
    assert.equal(
      islandEntries(other).includes("assets/theme/islands/components/compare/client.js"),
      false,
      "another route does not load the compare island",
    );
  } finally {
    rmSync(site.out, { recursive: true, force: true });
  }
});
