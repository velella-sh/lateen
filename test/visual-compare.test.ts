import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MAX_SHARE, THRESHOLD, compareFiles, compareImages, decodePng, encodePng, type Raster } from "../scripts/visual-compare.ts";

/** A solid white raster with the given rectangles painted in a colour. */
function image(width: number, height: number, paint: ReadonlyArray<[number, number, number, number, [number, number, number]]> = []): Raster {
  const data = new Uint8Array(width * height * 4).fill(255);
  for (const [x0, y0, w, h, [r, g, b]] of paint) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * width + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b;
      }
    }
  }
  return { width, height, data };
}

const BLACK: [number, number, number] = [0, 0, 0];

test("the numbers are the ones the note fixes", () => {
  assert.equal(THRESHOLD, 0.1);
  assert.equal(MAX_SHARE, 0.001);
});

test("identical images have no changed pixel and pass", () => {
  const a = image(40, 30, [[5, 5, 10, 10, BLACK]]);
  const result = compareImages(a, image(40, 30, [[5, 5, 10, 10, BLACK]]));
  assert.equal(result.ok, true);
  assert.equal(result.changed, 0);
  assert.equal(result.share, 0);
  assert.deepEqual(result.boxes, []);
});

test("a one-pixel change is found, boxed and drawn red in the diff; a small image fails", () => {
  const result = compareImages(image(20, 20), image(20, 20, [[7, 3, 1, 1, BLACK]]));
  assert.equal(result.changed, 1);
  assert.equal(result.share, 1 / 400);
  assert.equal(result.ok, false);
  assert.deepEqual(result.boxes, [{ x: 7, y: 3, width: 1, height: 1 }]);
  const at = (3 * 20 + 7) * 4;
  assert.deepEqual([...(result.diff as Raster).data.subarray(at, at + 3)], [255, 0, 0]);
});

test("one changed pixel in a large image stays under the share limit", () => {
  const result = compareImages(image(100, 100), image(100, 100, [[50, 50, 1, 1, BLACK]]));
  assert.equal(result.changed, 1);
  assert.equal(result.ok, true);
});

test("a colour change below the threshold is not a change", () => {
  const result = compareImages(image(10, 10), image(10, 10, [[0, 0, 10, 10, [250, 250, 250]]]));
  assert.equal(result.changed, 0);
});

test("a shifted element is reported as two boxes and fails", () => {
  const before = image(60, 40, [[10, 10, 12, 12, BLACK]]);
  const after = image(60, 40, [[30, 10, 12, 12, BLACK]]);
  const result = compareImages(before, after);
  assert.equal(result.ok, false);
  assert.equal(result.changed, 24 * 12);
  assert.deepEqual(result.boxes, [
    { x: 10, y: 10, width: 12, height: 12 },
    { x: 30, y: 10, width: 12, height: 12 },
  ]);
});

test("a change inside a masked region is ignored and washed blue in the diff", () => {
  const before = image(30, 30);
  const after = image(30, 30, [[10, 10, 5, 5, BLACK]]);
  assert.equal(compareImages(before, after).ok, false);
  const masked = compareImages(before, after, { masks: [{ x: 8, y: 8, width: 10, height: 10 }] });
  assert.equal(masked.ok, true);
  assert.equal(masked.changed, 0);
  const at = (12 * 30 + 12) * 4;
  assert.deepEqual([...(masked.diff as Raster).data.subarray(at, at + 3)], [200, 215, 255]);
  // A change just outside the mask still counts.
  const outside = compareImages(before, image(30, 30, [[20, 20, 5, 5, BLACK]]), { masks: [{ x: 8, y: 8, width: 10, height: 10 }] });
  assert.equal(outside.changed, 25);
});

test("different sizes fail and name both sizes without comparing pixels", () => {
  const result = compareImages(image(40, 30), image(40, 31));
  assert.equal(result.ok, false);
  assert.equal(result.diff, undefined);
  assert.match(result.message as string, /40×30/);
  assert.match(result.message as string, /40×31/);
});

test("PNG files round-trip and compareFiles writes the diff image", () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-compare-"));
  const a = image(16, 8, [[2, 2, 4, 4, BLACK]]);
  const b = image(16, 8, [[3, 2, 4, 4, BLACK]]);
  const decoded = decodePng(encodePng(a));
  assert.deepEqual([decoded.width, decoded.height], [16, 8]);
  assert.deepEqual(decoded.data, a.data);
  writeFileSync(join(dir, "a.png"), encodePng(a));
  writeFileSync(join(dir, "b.png"), encodePng(b));
  const result = compareFiles(join(dir, "a.png"), join(dir, "b.png"), join(dir, "diff.png"));
  assert.equal(result.ok, false);
  const diff = decodePng(readFileSync(join(dir, "diff.png")));
  assert.deepEqual([diff.width, diff.height], [16, 8]);
  assert.throws(() => decodePng(new Uint8Array([1, 2, 3])), /Not a PNG/);
});
