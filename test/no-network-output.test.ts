import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { before, test } from "node:test";
import { build, type BuiltSite } from "./integration-helpers.ts";

let first: BuiltSite;
let second: BuiltSite;

before(() => {
  first = build("integration");
  second = build("integration");
});

/** Every HTML and CSS file under a build, keyed by its path inside the output folder. */
function assets(site: BuiltSite): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:html|css)$/.test(entry.name)) out.set(relative(site.out, full), readFileSync(full));
    }
  };
  walk(site.out);
  return out;
}

test("a site without Site.network renders no network chrome", () => {
  for (const path of ["/showpiece/", "/404.html"]) {
    const document = first.document(path);
    assert.equal(document.querySelector(".project-switcher, .network-footer, [data-project-switcher]"), null, path);
    assert.doesNotMatch(first.html(path), /projects/i);
  }
});

test("the HTML and CSS a site without a network builds match the previous build, byte for byte", () => {
  const before = assets(first);
  const after = assets(second);
  assert.ok(before.size > 0);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
  for (const [path, bytes] of before) {
    const other = after.get(path);
    assert.notEqual(other, undefined, path);
    assert.ok(other!.equals(bytes), `${path} changed`);
  }
});
