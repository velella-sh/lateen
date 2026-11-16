/* Colour math for the brand options: hex to OKLCH and back, the WCAG contrast ratio, and a
 * deterministic way to lift a colour until it reads on a background. No dependency, no clock, no
 * floating-point printing: every result is a six-digit hex string, so two machines and two builds
 * write the same CSS. */

/** An opaque sRGB colour, channels 0–255. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** A colour in OKLCH: lightness 0–1, chroma 0 or more, hue 0–360 degrees. */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** Parses `#rgb` or `#rrggbb` (either case). Anything else, including alpha, is `undefined`. */
export function parseHex(value: string): Rgb | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (match === null) return undefined;
  const digits = match[1] ?? "";
  const full = digits.length === 3 ? [...digits].map((digit) => `${digit}${digit}`).join("") : digits;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** The six-digit lowercase hex of an sRGB colour, each channel rounded and clamped. */
export function toHex({ r, g, b }: { readonly r: number; readonly g: number; readonly b: number }): string {
  const channel = (value: number): string =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** sRGB channel (0–1) to linear light. */
const linear = (value: number): number => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

/** Linear light to an sRGB channel (0–1). */
const gamma = (value: number): number => (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);

/** Converts an sRGB colour to OKLCH (Björn Ottosson's transform). */
export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const [lr, lg, lb] = [linear(r / 255), linear(g / 255), linear(b / 255)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, bb);
  const hue = chroma < 1e-6 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: lightness, c: chroma, h: hue };
}

/** Converts OKLCH to an opaque sRGB colour. Out-of-range lightness and chroma are clamped. */
export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const lightness = clamp(l, 0, 1);
  const chroma = Math.max(0, c);
  const radians = (h * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lms = [
    lightness + 0.3963377774 * a + 0.2158037573 * b,
    lightness - 0.1055613458 * a - 0.0638541728 * b,
    lightness - 0.0894841775 * a - 1.291485548 * b,
  ].map((value) => value ** 3);
  const [lr, lg, lb] = lms;
  const r = 4.0767416621 * (lr ?? 0) - 3.3077115913 * (lg ?? 0) + 0.2309699292 * (lb ?? 0);
  const g = -1.2684380046 * (lr ?? 0) + 2.6097574011 * (lg ?? 0) - 0.3413193965 * (lb ?? 0);
  const blue = -0.0041960863 * (lr ?? 0) - 0.7034186147 * (lg ?? 0) + 1.707614701 * (lb ?? 0);
  return { r: clamp(gamma(r), 0, 1) * 255, g: clamp(gamma(g), 0, 1) * 255, b: clamp(gamma(blue), 0, 1) * 255 };
}

/** The OKLCH of a hex colour, or `undefined` when the hex does not parse. */
export function toOklch(value: string): Oklch | undefined {
  const rgb = parseHex(value);
  return rgb === undefined ? undefined : rgbToOklch(rgb);
}

/** A hex colour for an OKLCH value, rounded once so the output never prints floating-point noise. */
export function fromOklch(value: Oklch): string {
  return toHex(oklchToRgb(value));
}

/** WCAG 2.2 relative luminance of an sRGB colour. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * linear(r / 255) + 0.7152 * linear(g / 255) + 0.0722 * linear(b / 255);
}

/** WCAG 2.2 contrast ratio between two colours, from 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** A fixed lightness step. A smaller step would move more slowly; a larger one could overshoot. */
export const CONTRAST_STEP = 0.01;

/** The most steps {@link ensureContrast} takes before it gives up at the end of the range. */
export const CONTRAST_STEPS = 100;

/**
 * Moves `colour` away from `against` in fixed OKLCH lightness steps until the pair reaches `ratio`,
 * and returns the hex of the result. It moves toward black when the background is light and toward
 * white when it is dark, so the hue survives. The same input gives the same output on every machine;
 * when the ratio is unreachable the end of the range (black or white) is returned, still a valid hex.
 */
export function ensureContrast(colour: string, against: string, ratio: number): string {
  const rgb = parseHex(colour);
  const background = parseHex(against);
  if (rgb === undefined || background === undefined) return colour.trim().toLowerCase();
  if (contrast(rgb, background) >= ratio) return toHex(rgb);
  const oklch = rgbToOklch(rgb);
  const darken = luminance(background) >= 0.18;
  const end = darken ? 0 : 1;
  const direction = darken ? -1 : 1;
  let current = oklch;
  for (let step = 0; step < CONTRAST_STEPS; step += 1) {
    const next = clamp(current.l + direction * CONTRAST_STEP, 0, 1);
    current = { l: next, c: oklch.c, h: oklch.h };
    // Test the rounded hex, not the float: the value that is written is the value that must pass.
    const candidate = toHex(oklchToRgb(current));
    if (contrast(parseHex(candidate) ?? background, background) >= ratio) return candidate;
    if (next === end) break;
  }
  return toHex(oklchToRgb({ l: end, c: oklch.c, h: oklch.h }));
}

/** The colour of `pair` with the higher contrast against `background`. */
export function bestOn(background: string, pair: readonly [string, string] = ["#000000", "#ffffff"]): string {
  const bg = parseHex(background);
  if (bg === undefined) return pair[0];
  const [first, second] = pair;
  const firstRgb = parseHex(first);
  const secondRgb = parseHex(second);
  if (firstRgb === undefined || secondRgb === undefined) return first;
  return contrast(firstRgb, bg) >= contrast(secondRgb, bg) ? first : second;
}

/** Mixes two hex colours in OKLCH by `weight` (0 is `a`, 1 is `b`), keeping the shorter hue arc. */
export function mix(a: string, b: string, weight: number): string {
  const first = toOklch(a);
  const second = toOklch(b);
  if (first === undefined || second === undefined) return a;
  const amount = clamp(weight, 0, 1);
  const hueDelta = ((second.h - first.h + 540) % 360) - 180;
  return fromOklch({
    l: first.l + (second.l - first.l) * amount,
    c: first.c + (second.c - first.c) * amount,
    h: (first.h + hueDelta * amount + 360) % 360,
  });
}
