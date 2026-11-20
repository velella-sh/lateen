import assert from "node:assert/strict";
import { test } from "node:test";
import { waitFor } from "./helpers/wait.ts";

test("waitFor returns the value a slowed condition reaches", async () => {
  let ready = false;
  setTimeout(() => {
    ready = true;
  }, 25);

  assert.equal(await waitFor(() => ready, { timeout: 500 }), true, "a condition slower than one poll still passes");
});

test("waitFor fails within its timeout when the condition never holds", async () => {
  const started = Date.now();
  await assert.rejects(waitFor(() => false, { timeout: 60, interval: 5, message: "the row never rendered" }), /the row never rendered/);
  assert.ok(Date.now() - started < 500, "the wait stops at its own bound");
});

test("waitFor reads an async condition again until it answers", async () => {
  let reads = 0;
  const value = await waitFor(async () => {
    reads += 1;
    return reads === 3 ? "done" : "";
  }, { interval: 1 });

  assert.equal(value, "done");
  assert.equal(reads, 3);
});
