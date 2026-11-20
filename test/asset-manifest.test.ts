// The asset manifest must name what each route really downloads, once per response. It records the
// stylesheets, island modules, inline scripts, and font files with their gzip size, so a component
// island on a simple article or a repeated download fails the gate instead of passing as a byte total.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { manifestOf } from "../scripts/asset-manifest.ts";
import { ASSET_CLASSES, builtPages, routeAssets } from "../scripts/performance-budget.ts";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const schema = JSON.parse(readFileSync(new URL("../schema/asset-manifest.schema.json", import.meta.url), "utf8")) as JsonSchema;

const article = (scripts: string[]): string =>
  [
    '<link rel="stylesheet" href="/assets/theme/base-aaaa.css">',
    '<script type="module" src="/assets/theme/islands/chrome/toc/client.js"></script>',
    ...scripts,
    '<script>console.log("theme")</script>',
  ].join("");

/** A built output folder with a simple article, a component guide, and a shared font and module. */
function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "asset-manifest-"));
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  write(
    "assets/theme/base-aaaa.css",
    '@font-face { font-family: "Manrope"; font-style: normal; font-weight: 400; font-display: optional; src: url("/assets/theme/fonts/manrope-400-normal.woff2") format("woff2"); }\nbody{color:red}',
  );
  write("assets/theme/fonts/manrope-400-normal.woff2", "font-bytes");
  // The component island imports the chrome island's module, which the route already loaded.
  write("assets/theme/islands/chrome/toc/client.js", 'import{key}from"./key.js";console.log(key)');
  write("assets/theme/islands/chrome/toc/key.js", "export const key = 1;");
  write("assets/theme/islands/components/tabs/client.js", 'import{key}from"../../chrome/toc/key.js";console.log(key)');
  write("index.html", `<!doctype html><html><head>${article([])}</head><body></body></html>`);
  write(
    "guide/index.html",
    `<!doctype html><html><head>${article(['<script type="module" src="/assets/theme/islands/components/tabs/client.js"></script>'])}</head><body></body></html>`,
  );
  write(
    ".mizzen/manifest.json",
    JSON.stringify({
      pages: [
        { url: "/", outputs: ["index.html"] },
        { url: "/guide/", outputs: ["guide/index.html"] },
      ],
    }),
  );
  return dir;
}

const homePaths = [
  "assets/theme/base-aaaa.css",
  "assets/theme/fonts/manrope-400-normal.woff2",
  "assets/theme/islands/chrome/toc/client.js",
  "assets/theme/islands/chrome/toc/key.js",
  "inline:1",
];

const guidePaths = [
  "assets/theme/base-aaaa.css",
  "assets/theme/fonts/manrope-400-normal.woff2",
  "assets/theme/islands/chrome/toc/client.js",
  "assets/theme/islands/chrome/toc/key.js",
  "assets/theme/islands/components/tabs/client.js",
  "inline:1",
];

test("the manifest names each route's responses once, sorted, and passes its schema", () => {
  const dir = fixture();
  try {
    const pages = builtPages(dir);
    assert.deepEqual(
      pages.map((page) => page.url),
      ["/", "/guide/"],
    );

    const manifest = manifestOf(dir);
    assert.equal(manifest.tool, "lateen/asset-manifest");
    assert.equal(manifest.version, 1);
    assert.match(manifest.commit, /^[0-9a-f]{7,40}$/);
    assert.deepEqual(validate(schema, manifest), []);

    assert.deepEqual(
      manifest.routes.map((route) => route.route),
      ["/", "/guide/"],
    );
    for (const route of manifest.routes) {
      const paths = route.assets.map((asset) => asset.path);
      assert.deepEqual(paths, [...paths].sort(), `${route.route}: assets are in path order`);
      assert.equal(new Set(paths).size, paths.length, `${route.route}: no path is downloaded twice`);
      for (const asset of route.assets) {
        assert.ok(ASSET_CLASSES.includes(asset.class), `${asset.path}: ${asset.class} is an asset class`);
        assert.ok(asset.raw > 0 && asset.gzip > 0, `${asset.path}: has bytes`);
      }
    }

    const home = manifest.routes[0];
    const guide = manifest.routes[1];
    assert.ok(home);
    assert.ok(guide);
    assert.deepEqual(
      home.assets.map((asset) => asset.path),
      homePaths,
      "a simple article has one entry per stylesheet, module, font file, and inline script",
    );
    assert.equal(
      home.assets.some((asset) => asset.class === "js/components"),
      false,
      "a simple article loads no component island",
    );
    assert.equal(
      guide.assets.find((asset) => asset.class === "js/components")?.path,
      "assets/theme/islands/components/tabs/client.js",
      "the component route names its island",
    );

    // The same module is one response per route, shared across routes but never repeated inside one.
    const shared = guide.assets.filter((asset) => asset.path === "assets/theme/islands/chrome/toc/key.js");
    assert.equal(shared.length, 1);
    assert.equal(shared[0]?.class, "js/chrome");

    const page = pages[1];
    assert.ok(page);
    assert.deepEqual(
      routeAssets(dir, page).map((asset) => asset.path),
      guidePaths,
      "routeAssets is the same pure view manifestOf publishes",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
