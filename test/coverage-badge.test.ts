import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("the coverage badge counts each source line once across repeated LCOV records", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "lateen-coverage-badge-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = join(dir, "lcov.info");
  const output = join(dir, "coverage.json");
  const script = fileURLToPath(new URL("../scripts/coverage-badge.ts", import.meta.url));
  writeFileSync(input, [
    "SF:src/first.ts",
    "DA:1,1",
    "DA:2,1",
    "DA:3,0",
    "DA:4,0",
    "LF:4",
    "LH:2",
    "end_of_record",
    "SF:src/first.ts",
    "DA:1,1",
    "DA:2,0",
    "DA:3,1",
    "DA:4,0",
    "LF:4",
    "LH:2",
    "end_of_record",
    "SF:src/second.ts",
    "DA:1,1",
    "LF:1",
    "LH:1",
    "end_of_record",
    "",
  ].join("\r\n"));

  const run = spawnSync(process.execPath, [script, input, output], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /80\.00%/);
  assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), {
    schemaVersion: 1,
    label: "coverage",
    message: "80%",
    color: "DFB317",
  });
});
