import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { checkStarters } from "../scripts/check-starters.ts";
import { scratch, writeStarter } from "./starters-fixture.ts";

test("a starter with a broken link fails and is not skipped", () => {
  const dir = scratch();
  try {
    writeStarter(dir, "good", "Plain text with no links.");
    writeStarter(dir, "bad", "See [the missing page](/no-such-page/).");
    const problems = checkStarters(dir);
    assert.ok(problems.length > 0);
    assert.ok(problems.every((p) => p.starter === "bad"), JSON.stringify(problems));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
