import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { decodePng, encodePng, type Raster } from "../../scripts/visual-compare.ts";
import { formatReview, reviewShots } from "../../scripts/visual-review.ts";
import { loadMatrix, writeReport } from "../../scripts/test-visual.ts";

const solid = (w: number, h: number, rgb: readonly [number, number, number]): Raster => {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set([...rgb, 255], i);
  return { width: w, height: h, data };
};

function setup(): { dir: string; shots: string; baselines: string; review: string } {
  const dir = mkdtempSync(join(tmpdir(), "visual-review-"));
  const shots = join(dir, "out"), baselines = join(dir, "baselines");
  mkdirSync(shots);
  mkdirSync(baselines);
  return { dir, shots, baselines, review: join(dir, "out/review") };
}

test("a matching shot passes and writes nothing", () => {
  const t = setup();
  try {
    writeFileSync(join(t.shots, "a.png"), encodePng(solid(20, 10, [255, 255, 255])));
    writeFileSync(join(t.baselines, "a.png"), encodePng(solid(20, 10, [255, 255, 255])));
    const reports = reviewShots(t);
    assert.deepEqual(reports.map((r) => r.status), ["pass"]);
    assert.equal(existsSync(t.review), false);
    assert.equal(formatReview(reports).ok, true);
  } finally {
    rmSync(t.dir, { recursive: true, force: true });
  }
});

test("a failure writes the before, after, diff and side-by-side images and prints their paths", () => {
  const t = setup();
  try {
    writeFileSync(join(t.shots, "a.png"), encodePng(solid(20, 10, [0, 0, 0])));
    writeFileSync(join(t.baselines, "a.png"), encodePng(solid(20, 10, [255, 255, 255])));
    const [report] = reviewShots(t);
    assert.equal(report?.status, "fail");
    assert.deepEqual(report?.files.map((f) => f.slice(t.review.length + 1)), ["a.before.png", "a.after.png", "a.diff.png", "a.side-by-side.png"]);
    for (const f of report?.files ?? []) assert.ok(existsSync(f), f);
    assert.equal(decodePng(readFileSync(join(t.review, "a.side-by-side.png"))).width, 20 * 3 + 24);
    const { lines, ok } = formatReview(reviewShots(t));
    assert.equal(ok, false);
    assert.ok(lines.some((l) => l.includes("a.diff.png")));
    assert.equal(decodePng(readFileSync(join(t.baselines, "a.png"))).data[0], 255, "the baseline is untouched");
  } finally {
    rmSync(t.dir, { recursive: true, force: true });
  }
});

test("a different size fails with before and after only", () => {
  const t = setup();
  try {
    writeFileSync(join(t.shots, "a.png"), encodePng(solid(20, 12, [255, 255, 255])));
    writeFileSync(join(t.baselines, "a.png"), encodePng(solid(20, 10, [255, 255, 255])));
    const [report] = reviewShots(t);
    assert.equal(report?.status, "fail");
    assert.deepEqual(report?.files.map((f) => f.slice(t.review.length + 1)), ["a.before.png", "a.after.png", "a.side-by-side.png"]);
  } finally {
    rmSync(t.dir, { recursive: true, force: true });
  }
});

test("a shot with no baseline fails, says how to create one and writes no baseline", () => {
  const t = setup();
  try {
    writeFileSync(join(t.shots, "new.png"), encodePng(solid(5, 5, [1, 2, 3])));
    const reports = reviewShots(t);
    assert.equal(reports[0]?.status, "missing");
    const { lines, ok } = formatReview(reports);
    assert.equal(ok, false);
    assert.match(lines[0] ?? "", /no baseline for "new".*--update/);
    assert.equal(existsSync(join(t.baselines, "new.png")), false);
  } finally {
    rmSync(t.dir, { recursive: true, force: true });
  }
});

test("--update writes the baselines, replaces a stale one, and passes", () => {
  const t = setup();
  try {
    writeFileSync(join(t.shots, "a.png"), encodePng(solid(8, 8, [0, 0, 0])));
    writeFileSync(join(t.shots, "b.png"), encodePng(solid(8, 8, [9, 9, 9])));
    writeFileSync(join(t.baselines, "a.png"), encodePng(solid(8, 8, [255, 255, 255])));
    const reports = reviewShots({ ...t, update: true });
    assert.deepEqual(reports.map((r) => r.status), ["updated", "updated"]);
    assert.equal(decodePng(readFileSync(join(t.baselines, "a.png"))).data[0], 0);
    assert.ok(existsSync(join(t.baselines, "b.png")));
    assert.equal(formatReview(reports).ok, true);
    assert.equal(reviewShots(t).every((r) => r.status === "pass"), true);
    assert.equal(existsSync(t.review), false);
  } finally {
    rmSync(t.dir, { recursive: true, force: true });
  }
});

test("a case that passed on the second take is written as flaky by name", () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-report-"));
  try {
    const file = join(dir, "report.json");
    const rows = writeReport(
      [{ name: "gallery-light-desktop", status: "pass", share: 0.0001, files: [] }],
      loadMatrix(),
      file,
      ["gallery-light-desktop"],
    );
    assert.equal(rows[0]?.flaky, true);
    assert.equal(rows[0]?.status, "pass");
    const written = JSON.parse(readFileSync(file, "utf8")) as { flaky: boolean }[];
    assert.equal(written[0]?.flaky, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
