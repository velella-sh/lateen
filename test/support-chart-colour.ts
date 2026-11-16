// Colour-vision simulation for the chart token tests: Machado et al. (2009) matrices at full
// severity, applied in linear light, and the distance between two colours in OKLab.
import { parseHex } from "../src/color.ts";

type Matrix = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];

export const VISION: Record<string, Matrix> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

const toLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** OKLab [L, a, b] of a hex colour after the given colour-vision simulation (none when omitted). */
export function oklab(hex: string, vision?: Matrix): [number, number, number] {
  const rgb = parseHex(hex);
  if (rgb === undefined) throw new Error(`not a hex colour: ${hex}`);
  let c: number[] = [rgb.r, rgb.g, rgb.b].map((v) => toLinear(v / 255));
  if (vision) c = vision.map((row) => Math.min(1, Math.max(0, row[0] * (c[0] ?? 0) + row[1] * (c[1] ?? 0) + row[2] * (c[2] ?? 0))));
  const [r = 0, g = 0, b = 0] = c;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** OKLab distance times 100, so a just-noticeable difference is about 2. */
export function distance(a: string, b: string, vision?: Matrix): number {
  const [l1, a1, b1] = oklab(a, vision);
  const [l2, a2, b2] = oklab(b, vision);
  return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
