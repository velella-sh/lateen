// Two clean builds of the generated assets must produce identical bytes, and a checkout whose copies
// are stale, empty or absent must be named so prepack or CI fails instead of shipping them.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { ASSETS, buildAssets, root, staleAssets } from "../scripts/check-ui-build.ts";

test("two clean builds are byte-identical and match the checkout", () => {
  const first = mkdtempSync(join(tmpdir(), "ui-build-test-a-"));
  const second = mkdtempSync(join(tmpdir(), "ui-build-test-b-"));
  try {
    const fresh = buildAssets(first);
    buildAssets(second);
    assert.deepEqual(staleAssets(fresh, second), [], "a second clean build matches the first byte for byte");
    assert.deepEqual(staleAssets(fresh, root), [], "the checkout's generated assets are fresh: run npm run ui:build");
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
});

test("stale, empty and absent generated assets are reported", () => {
  const dir = mkdtempSync(join(tmpdir(), "ui-build-test-"));
  try {
    const expected = Object.fromEntries(ASSETS.map((path) => [path, Buffer.from("fresh")]));
    assert.deepEqual(staleAssets(expected, dir), [...ASSETS], "absent assets are reported");
    for (const path of ASSETS) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), "stale");
    }
    assert.deepEqual(staleAssets(expected, dir), [...ASSETS], "stale assets are reported");
    for (const path of ASSETS) writeFileSync(join(dir, path), "fresh");
    assert.deepEqual(staleAssets(expected, dir), []);
    writeFileSync(join(dir, ASSETS[0]), "");
    assert.deepEqual(staleAssets(expected, dir), [ASSETS[0]], "an empty asset is reported");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
