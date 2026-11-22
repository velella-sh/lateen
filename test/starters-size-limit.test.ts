import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkStarters } from "../scripts/check-starters.ts";
import { scratch, writeStarter } from "./starters-fixture.ts";

test("a file over the size limit fails", () => {
  const dir = scratch();
  try {
    writeStarter(dir, "heavy", "Text.");
    writeFileSync(join(dir, "heavy", "big.txt"), "x".repeat(300 * 1024));
    assert.match(checkStarters(dir).map((p) => p.message).join("\n"), /big\.txt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
