// Colour math is the base of every brand option, so its conversions, contrast pairs, and the
// contrast guarantee are checked against known values instead of round trips alone. Every output is
// a six-digit hex string: the same input must give the same CSS on every machine.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bestOn,
  contrast,
  ensureContrast,
  fromOklch,
  luminance,
  mix,
  parseHex,
  rgbToOklch,
  toHex,
  toOklch,
} from "../src/color.ts";

const close = (actual: number, expected: number, tolerance = 0.003): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

test("hex parsing accepts three and six digits and rejects alpha and other text", () => {
  assert.deepEqual(parseHex("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex("#0aF"), { r: 0, g: 170, b: 255 });
  assert.deepEqual(parseHex(" #5e81ac "), { r: 94, g: 129, b: 172 });
  for (const value of ["#ffff", "#ffffffff", "#ggg", "red", "5e81ac", "#12345", ""]) {
    assert.equal(parseHex(value), undefined, value);
  }
  assert.equal(toHex({ r: 300, g: -4, b: 127.6 }), "#ff0080");
});

test("OKLCH matches the known values of the primary colours", () => {
  close(rgbToOklch({ r: 255, g: 255, b: 255 }).l, 1);
  close(rgbToOklch({ r: 0, g: 0, b: 0 }).l, 0);
  const red = rgbToOklch({ r: 255, g: 0, b: 0 });
  close(red.l, 0.628, 0.002);
  close(red.c, 0.258, 0.002);
  close(red.h, 29.23, 0.2);
  const green = rgbToOklch({ r: 0, g: 255, b: 0 });
  close(green.l, 0.866, 0.002);
  close(green.h, 142.5, 0.2);
  const blue = rgbToOklch({ r: 0, g: 0, b: 255 });
  close(blue.l, 0.452, 0.002);
  close(blue.h, 264.05, 0.2);
  close(rgbToOklch({ r: 128, g: 128, b: 128 }).c, 0, 0.0001);
});

test("a colour survives the round trip through OKLCH as the same hex", () => {
  for (const hex of ["#000000", "#ffffff", "#5e81ac", "#eceff4", "#1f1f28", "#cf222e", "#7ee787"]) {
    assert.equal(fromOklch(toOklch(hex) ?? { l: 0, c: 0, h: 0 }), hex, hex);
  }
});

test("contrast matches WCAG's known pairs", () => {
  close(contrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }), 21, 0.001);
  close(contrast({ r: 118, g: 118, b: 118 }, { r: 255, g: 255, b: 255 }), 4.54, 0.01);
  close(contrast({ r: 119, g: 119, b: 119 }, { r: 255, g: 255, b: 255 }), 4.48, 0.01);
  assert.equal(contrast({ r: 1, g: 2, b: 3 }, { r: 1, g: 2, b: 3 }), 1);
  close(luminance({ r: 255, g: 255, b: 255 }), 1);
  close(luminance({ r: 0, g: 0, b: 0 }), 0);
});

test("ensureContrast lifts a colour until the ratio is met, and is deterministic", () => {
  for (const ratio of [3, 4.5, 7]) {
    for (const [colour, background] of [
      ["#8a8a8a", "#ffffff"],
      ["#9a9a9a", "#eceff4"],
      ["#5e81ac", "#ffffff"],
      ["#5e81ac", "#1f1f28"],
      ["#7ee787", "#1f1f28"],
    ] as const) {
      const once = ensureContrast(colour, background, ratio);
      assert.match(once, /^#[0-9a-f]{6}$/);
      assert.equal(ensureContrast(colour, background, ratio), once, "the same input gives the same output");
      const reached = contrast(parseHex(once) ?? { r: 0, g: 0, b: 0 }, parseHex(background) ?? { r: 0, g: 0, b: 0 });
      assert.ok(reached >= ratio, `${colour} on ${background} reached ${reached.toFixed(2)}, wanted ${ratio}`);
    }
  }
  // A colour that already passes does not move.
  assert.equal(ensureContrast("#0057b8", "#ffffff", 4.5), "#0057b8");
});

test("ensureContrast ends at black or white when the ratio is unreachable", () => {
  assert.equal(ensureContrast("#8a8a8a", "#ffffff", 22), "#000000");
  assert.equal(ensureContrast("#8a8a8a", "#1f1f28", 22), "#ffffff");
  assert.equal(ensureContrast("not a colour", "#ffffff", 4.5), "not a colour");
});

test("bestOn picks the readable side of a background", () => {
  assert.equal(bestOn("#5e81ac"), "#000000");
  assert.equal(bestOn("#1f1f28"), "#ffffff");
  assert.equal(bestOn("#ffffff"), "#000000");
});

test("mix keeps the hue arc and rounds to hex", () => {
  assert.equal(mix("#000000", "#ffffff", 0), "#000000");
  assert.equal(mix("#000000", "#ffffff", 1), "#ffffff");
  const middle = mix("#000000", "#ffffff", 0.5);
  assert.match(middle, /^#[0-9a-f]{6}$/);
  // OKLCH's 0.5 lightness is a mid grey in sRGB, not half the contrast: both channels stay near 99.
  const grey = parseHex(middle) ?? { r: 0, g: 0, b: 0 };
  assert.ok(grey.r > 90 && grey.r < 110, middle);
  assert.equal(grey.r, grey.g);
});
