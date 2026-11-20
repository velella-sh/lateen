// Date-sensitive formatting must not read the host clock or time zone (#869): the formatters pin
// UTC and explicit locales, and this test proves it by running them under two host timezones on
// either side of the date line and comparing the results byte for byte, then pinning the UTC day
// boundary itself: an instant before and after UTC midnight stays on its own UTC day.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { root } from "./integration-helpers.ts";

interface ProbeOutput {
  readonly zone: string;
  readonly gregorian: string | undefined;
  readonly persian: string | undefined;
  readonly hijri: string | undefined;
  readonly month: string | undefined;
  readonly parts: { readonly year: number; readonly month: number; readonly day: number } | undefined;
  readonly yearOnly: string | undefined;
  readonly beforeUtcMidnight: string | undefined;
  readonly afterUtcMidnight: string | undefined;
  readonly instant: string | undefined;
  readonly relativeYesterday: string | undefined;
  readonly relativeToday: string | undefined;
  readonly relativeTomorrow: string | undefined;
  readonly impossible: string | undefined;
}

const DATE_KEYS = [
  "gregorian",
  "persian",
  "hijri",
  "month",
  "parts",
  "yearOnly",
  "beforeUtcMidnight",
  "afterUtcMidnight",
  "instant",
  "relativeYesterday",
  "relativeToday",
  "relativeTomorrow",
  "impossible",
] as const;

const PROBE = `${root}/test/dates-timezone-probe.ts`;

/** Runs the probe process with `TZ` pinned to `zone` and reads its JSON output. */
function probe(zone: string): ProbeOutput {
  const env: Record<string, string | undefined> = { ...process.env, NODE_V8_COVERAGE: "", TZ: zone };
  delete env["NODE_TEST_CONTEXT"]; // a nested test-runner context would make the child skip the file
  const run = spawnSync(process.execPath, [PROBE], { encoding: "utf8", env });
  assert.equal(run.status, 0, `the probe under TZ=${zone} runs: ${run.stderr}`);
  return JSON.parse(run.stdout) as ProbeOutput;
}

test("calendar and relative dates are identical under host timezones on both sides of the date line", () => {
  const utc = probe("UTC");
  assert.equal(utc.zone, "UTC");
  assert.equal(utc.gregorian, "March 4, 2026", "the locale is explicit, not the host's");
  assert.ok(utc.persian !== undefined && utc.hijri !== undefined);

  for (const zone of ["Pacific/Kiritimati", "Pacific/Niue"]) {
    const other = probe(zone);
    assert.equal(other.zone, zone, "the pinned host timezone took effect");
    for (const key of DATE_KEYS) {
      assert.deepEqual(other[key], utc[key], `${key} reads the same under TZ=${zone}`);
    }
  }
});

test("a Date on either side of a UTC midnight keeps its own UTC day", () => {
  const utc = probe("UTC");
  // 23:30Z is still March 4 in UTC, though it is already March 5 in Kiritimati (UTC+14);
  // 00:30Z is March 5 in UTC, though it is still March 4 in Niue (UTC-11).
  assert.equal(utc.beforeUtcMidnight, "2026-03-04");
  assert.equal(utc.afterUtcMidnight, "2026-03-05");
  const late = probe("Pacific/Kiritimati");
  assert.equal(late.beforeUtcMidnight, "2026-03-04", "the local wall clock is already on the next day");
  const early = probe("Pacific/Niue");
  assert.equal(early.afterUtcMidnight, "2026-03-05", "the local wall clock is still on the previous day");
});

test("relative day names around the as-of day do not move with the host zone", () => {
  const utc = probe("UTC");
  assert.equal(utc.relativeYesterday, "yesterday");
  assert.equal(utc.relativeToday, "today");
  assert.equal(utc.relativeTomorrow, "tomorrow");
  for (const zone of ["Pacific/Kiritimati", "Pacific/Niue"]) {
    const other = probe(zone);
    assert.equal(other.relativeYesterday, "yesterday", zone);
    assert.equal(other.relativeToday, "today", zone);
    assert.equal(other.relativeTomorrow, "tomorrow", zone);
  }
});

test("an impossible date stays unread under every host timezone", () => {
  for (const zone of ["UTC", "Pacific/Kiritimati", "Pacific/Niue"]) {
    assert.equal(probe(zone).impossible, undefined, zone);
  }
});
