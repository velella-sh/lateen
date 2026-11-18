import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const BASELINES = fileURLToPath(new URL("./baselines/", import.meta.url));
// The densest gallery page is about 323 KB after the 24px targets; the cap still catches real bloat.
const MAX_ONE = 350 * 1024;
// The CI browser writes larger PNGs than the previous local set; 12 MiB still bounds the suite.
const MAX_ALL = 12 * 1024 * 1024;

test("every baseline is under the per-image and total caps, and the browser is recorded", () => {
  const files = readdirSync(BASELINES).filter((file) => file.endsWith(".png")).sort();
  assert.ok(files.length > 0, "the baselines are committed");
  const sizes = files.map((file) => statSync(join(BASELINES, file)).size);
  for (const [i, size] of sizes.entries()) assert.ok(size <= MAX_ONE, `${files[i]} is ${size} bytes`);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  assert.ok(total <= MAX_ALL, `the baselines are ${total} bytes`);
  const versions = JSON.parse(readFileSync(join(BASELINES, "browsers.json"), "utf8")) as Record<string, unknown>;
  assert.match(String(versions["chromium"]), /^\d+\.\d+\.\d+\.\d+$/);
  assert.match(String(versions["playwright"]), /^\d+\.\d+\.\d+$/);
  assert.equal(existsSync(join(BASELINES, "browsers.json")), true);
});
