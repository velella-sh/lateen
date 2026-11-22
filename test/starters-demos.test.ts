// The deployed site serves every starter as a demo, so each one must build under the demo base and
// stay out of search indexes.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildDemos, demoConfig } from "../scripts/build-starter-demos.ts";

test("the demo config sets the base and marks every page noindex", () => {
  const config = demoConfig('title: Demo\nbase: ""\ntheme:\n  name: "@velella/lateen"\n', "/lateen/starters/data");
  assert.match(config, /^base: \/lateen\/starters\/data$/m);
  assert.match(config, /defaults:\n {2}- path: ""\n {4}values:\n {6}noindex: true/);
  assert.match(config, /title: Demo/);
});

test("every starter builds as a noindex demo under its own base", () => {
  const out = mkdtempSync(join(tmpdir(), "lateen-demos-"));
  try {
    const names = ["changelog", "data", "docs", "mixed", "report"];
    assert.deepEqual(buildDemos(out, "/lateen"), names);
    for (const name of names) {
      const html = readFileSync(join(out, "starters", name, "index.html"), "utf8");
      assert.match(html, /<meta name="robots" content="noindex"\s*\/?>/, `${name} is indexed`);
      assert.ok(html.includes(`/lateen/starters/${name}/assets/`), `${name} assets leave the demo base`);
    }
    const record = readFileSync(join(out, "starters", "data", "kits", "head-torch", "index.html"), "utf8");
    assert.match(record, /href="\/lateen\/starters\/data\/catalogue\/"/, "the record links out of the demo");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
