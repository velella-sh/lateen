import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { tempDir } from "../integration-helpers.ts";
import { buildFixture } from "./fixtures/build.ts";
import { GALLERY_PAGES, PAGES, componentNames } from "./fixtures/pages.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const A11Y_SITE = join(ROOT, "test/accessibility/fixtures/site");
const GALLERY_SITE = join(ROOT, "test/visual/fixtures/site");
const OUT = tempDir("visual-fixture-");

function allFiles(dir: string, base = dir): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) for (const [k, v] of allFiles(path, base)) files.set(k, v);
    else files.set(path.slice(base.length), readFileSync(path).toString("base64"));
  }
  return files;
}

test("the page list names real, unique pages, and the gallery exists in every language", () => {
  assert.equal(new Set(PAGES.map((p) => p.name)).size, PAGES.length);
  assert.equal(new Set(PAGES.map((p) => p.path)).size, PAGES.length);
  for (const page of PAGES) {
    const root = page.from === "gallery" ? GALLERY_SITE : A11Y_SITE;
    assert.ok(existsSync(join(root, page.file)), `${page.file} exists in ${page.from}`);
  }
  assert.deepEqual(GALLERY_PAGES.map((p) => p.lang), ["en", "fa", "ar"]);
});

test("the fixture reuses the accessibility pages instead of copying them", () => {
  const own = readdirSync(GALLERY_SITE, { recursive: true, encoding: "utf8" }).filter(
    (f) => f.endsWith(".md") && !f.startsWith("_templates"),
  );
  assert.deepEqual(own.sort(), ["ar/gallery.md", "collection-api.md", "fa/gallery.md", "gallery.md", "inventory.md"]);
  assert.ok(statSync(join(ROOT, "test/visual/fixtures/mizzen.yml")).isFile());
});

/** Import directive aliases share the callout specimen and have separate inventory coverage. */
function galleryComponentNames(): string[] {
  return componentNames().filter((name) =>
    !readFileSync(join(ROOT, "components", name, "index.ts"), "utf8").includes('export default importedCallout('));
}

test("the gallery shows each distinct component in every language", () => {
  const names = galleryComponentNames();
  assert.ok(names.length > 50);
  for (const page of GALLERY_PAGES) {
    const source = readFileSync(join(GALLERY_SITE, page.file), "utf8");
    const headings = new Set([...source.matchAll(/^## (.+)$/gm)].map((m) => m[1]));
    assert.deepEqual(
      names.filter((n) => !headings.has(n)),
      [],
      `${page.file} lacks a section for these components`,
    );
    assert.deepEqual([...headings].filter((h) => !names.includes(h ?? "")), [], `${page.file} has a section that is no component`);
  }
});

test("the fixture builds twice to identical files, and the gallery has a section per component", () => {
  buildFixture(join(OUT, "one"));
  buildFixture(join(OUT, "two"));
  const one = allFiles(join(OUT, "one"));
  const two = allFiles(join(OUT, "two"));
  assert.deepEqual([...two.keys()], [...one.keys()]);
  for (const [file, content] of one) assert.equal(two.get(file), content, `${file} differs between builds`);

  for (const page of PAGES) {
    const file = page.path.endsWith(".html") ? page.path : `${page.path}index.html`;
    assert.ok(one.has(file), `${file} is built`);
  }
  for (const page of GALLERY_PAGES) {
    const html = readFileSync(join(OUT, "one", page.path, "index.html"), "utf8");
    assert.match(html, new RegExp(`<html[^>]*lang="${page.lang}"`));
    for (const name of galleryComponentNames()) assert.match(html, new RegExp(`<h2[^>]*id="${name}"`), `${page.path} shows ${name}`);
    assert.doesNotMatch(html, /Invalid Date|undefined|\[object Object\]/);
  }
});

test("the default-look fixture builds with no preset and no font override, in the bundled fonts", () => {
  const out = tempDir("visual-fixture-default-");
  buildFixture(out, undefined, "default");
  const home = readFileSync(join(out, "index.html"), "utf8");
  assert.match(home, /Default-look|default-look/i);
  const css = readdirSync(out, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(out, f), "utf8"))
    .join("\n");
  assert.match(css, /Manrope/);
  assert.match(css, /Vazirmatn/);
  assert.doesNotMatch(css, /Example Sans|Example Mono/);
  assert.equal(existsSync(join(out, "fonts/example-sans.woff2")), false);
});
