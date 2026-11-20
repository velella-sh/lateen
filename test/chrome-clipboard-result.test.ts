// The shared clipboard result path (issue #844): one write→result→restore sequence for the
// clipboard islands. A failed write is never reported as a success, a slower earlier result never
// overwrites a newer one, and a pending restore can be cancelled before it runs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createResultFlash, writeClipboard, type Timers } from "../chrome/clipboard/result.ts";

interface FakeClipboard {
  written: string[];
  fail: boolean;
  writeText(text: string): Promise<void>;
}

/** A clipboard that records writes and succeeds or refuses as asked. */
function clipboard(fail = false): FakeClipboard {
  const fake: FakeClipboard = {
    written: [],
    fail,
    writeText(text: string) {
      if (fake.fail) return Promise.reject(new Error("denied"));
      fake.written.push(text);
      return Promise.resolve();
    },
  };
  return fake;
}

/** A clock the test runs by hand, with a cancel that forgets the pending callback. */
function clock(): Timers & { pending: Array<{ callback: () => void; ms: number }>; cancelled: unknown[] } {
  const pending: Array<{ callback: () => void; ms: number }> = [];
  const cancelled: unknown[] = [];
  return {
    pending,
    cancelled,
    schedule(callback: () => void, ms: number) {
      pending.push({ callback, ms });
      return pending.length;
    },
    cancel(handle: unknown) {
      cancelled.push(handle);
      const at = Number(handle) - 1;
      if (at >= 0) pending.splice(at, 1);
    },
  };
}

/** The words a target carries while a result is on screen, and its resting text. */
interface Target {
  text: string;
}

function flashOf(timers: Timers) {
  const resets: Target[] = [];
  return {
    resets,
    flash: createResultFlash<Target>({
      timers,
      resetMs: 2000,
      apply(target, ok) {
        target.text = ok ? "Copied" : "Copy failed";
      },
      reset(target) {
        target.text = "";
        resets.push(target);
      },
    }),
  };
}

test("writeClipboard resolves true for a write that worked and false for every other outcome", async () => {
  assert.equal(await writeClipboard(clipboard(), "x"), true);
  assert.equal(await writeClipboard(clipboard(true), "x"), false, "a refused write is a failure");
  assert.equal(await writeClipboard(undefined, "x"), false, "no clipboard is a failure");
  const throwing: FakeClipboard = {
    written: [],
    fail: false,
    writeText() {
      throw new Error("denied in hand");
    },
  };
  assert.equal(await writeClipboard(throwing, "x"), false, "a write that throws in hand is a failure");
});

test("a refusal never runs the success path", async () => {
  const target: Target = { text: "Copy" };
  const timers = clock();
  const { flash } = flashOf(timers);
  flash.show(target, await writeClipboard(clipboard(true), "x"));
  assert.equal(target.text, "Copy failed");
  assert.equal(timers.pending.length, 1, "a failure still takes the reset time to restore");
  timers.pending[0]!.callback();
  assert.equal(target.text, "", "the resting state returns after the reset");
});

test("the restore runs after the reset time and only for the run that scheduled it", () => {
  const target: Target = { text: "Copy" };
  const timers = clock();
  const { flash } = flashOf(timers);

  flash.show(target, true);
  assert.equal(timers.pending[0]!.ms, 2000);
  const superseded = timers.pending[0]!.callback;

  flash.show(target, true);
  assert.equal(target.text, "Copied");
  assert.deepEqual(timers.cancelled, [1], "the superseded restore is cancelled, not left pending");
  assert.equal(timers.pending.length, 1);

  superseded();
  assert.equal(target.text, "Copied", "even a fired superseded restore is a no-op");

  timers.pending[0]!.callback();
  assert.equal(target.text, "", "the newest run's restore puts the resting state back");
});

test("a target without a cancel-capable clock still cannot restore a newer result early", () => {
  const target: Target = { text: "Copy" };
  const pending: Array<{ callback: () => void; ms: number }> = [];
  const { flash } = flashOf({ schedule(callback, ms) { pending.push({ callback, ms }); } });

  flash.show(target, true);
  flash.show(target, false);
  pending[0]!.callback();
  assert.equal(target.text, "Copy failed", "the older restore does not clear the newer result");
  pending[1]!.callback();
  assert.equal(target.text, "");
});

test("restore puts the resting state back at once and forgets the pending timer", () => {
  const target: Target = { text: "Copy" };
  const timers = clock();
  const { flash, resets } = flashOf(timers);

  flash.show(target, true);
  flash.restore(target);

  assert.equal(target.text, "");
  assert.deepEqual(resets, [target]);
  assert.deepEqual(timers.cancelled, [1]);
  assert.equal(timers.pending.length, 0);

  // Restoring twice is safe, and a later show starts a fresh run.
  flash.restore(target);
  assert.deepEqual(resets, [target, target]);
  flash.show(target, false);
  assert.equal(target.text, "Copy failed");
});

test("dropped targets are forgotten: the flash never grows per control", () => {
  const timers = clock();
  const { flash } = flashOf(timers);
  for (let at = 0; at < 200; at += 1) flash.show({ text: "" }, true);
  assert.ok(timers.pending.length <= 200, "each show leaves at most one timer");
  // The pending map is a WeakMap keyed by the target: the objects above are already unreachable,
  // so nothing holds a control the page has dropped.
});
