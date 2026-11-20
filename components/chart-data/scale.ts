/**
 * The scale and tick arithmetic the charts share: value domains, round ticks, and the mappings from
 * a value or a percentage to a position. Pure and dependency-free, so the bar, stacked-bar, line, and
 * timeline scales compute identical numbers from identical inputs. Pixel mappings keep each axis's
 * own expression, so a chart's rendered bytes do not drift when another chart reuses the helper.
 */

/** The ends of a value domain. */
export interface Domain {
  readonly low: number;
  readonly high: number;
}

/** The smallest and largest of the values, or undefined when there are none. */
export function extentOf(values: readonly number[]): Domain | undefined {
  if (values.length === 0) return undefined;
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return { low, high };
}

/** A domain widened to include zero; a value that is not finite reads as zero. */
export function domainOf(min: number, max: number): Domain {
  return {
    low: Math.min(0, Number.isFinite(min) ? min : 0),
    high: Math.max(0, Number.isFinite(max) ? max : 0),
  };
}

/** A domain with room around a single value, so one point still reads on a scale. */
export function paddedDomain(low: number, high: number): Domain {
  return low === high ? { low: low - 1, high: high + 1 } : { low, high };
}

/** A round step near `span / count`: 1, 2, 5, or 10 times a power of ten. */
function niceStep(span: number, count: number): number {
  const rough = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(rough));
  const error = rough / power;
  const factor = error < 1.5 ? 1 : error < 3 ? 2 : error < 7 ? 5 : 10;
  return factor * power;
}

/**
 * The tick values for a data range: round steps that include zero, the range's ends, and no tick
 * nobody asked for. A range with one value still gets a second end, so a single bar reads on a scale.
 */
export function ticksOf(min: number, max: number, count = 5): number[] {
  const { low, high } = domainOf(min, max);
  const span = high - low === 0 ? 1 : high - low;
  const step = niceStep(span, count);
  const start = Math.floor(low / step) * step;
  const end = Math.ceil((low + span) / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

/** Evenly spaced ticks across a domain, rounded so two runs render the same bytes. */
export function evenTicksOf(low: number, high: number, count = 5): number[] {
  return Array.from({ length: count }, (_, index) =>
    Number((low + ((high - low) * index) / (count - 1)).toPrecision(12)),
  );
}

/** Where a value sits in its domain, from 0 to 1; a domain with no span reads as zero. */
export function ratioOf(value: number, low: number, high: number): number {
  return (value - low) / (high - low || 1);
}

/** Where a value sits between two ends, as a percentage of the span between them. */
export function percentOf(value: number, from: number, to: number): number {
  return ((value - from) / (to - from)) * 100;
}

/**
 * A value axis along the inline direction: `start` is the axis origin and `span` its length. A
 * mirrored axis (a right-to-left page) grows toward the start instead of away from it.
 */
export function xScaleOf(low: number, high: number, start: number, span: number, mirror = false): (value: number) => number {
  return (value) => {
    const ratio = ratioOf(value, low, high);
    return mirror ? start + span * (1 - ratio) : start + span * ratio;
  };
}

/** A value axis along the block direction: values grow upward from the domain's low end. */
export function yScaleOf(low: number, high: number, top: number, span: number): (value: number) => number {
  return (value) => top + ((high - value) / (high - low || 1)) * span;
}

/** A percentage axis: positions are already percentages of the span, optionally mirrored. */
export function percentScaleOf(start: number, span: number, mirror = false): (position: number) => number {
  return (position) => (mirror ? start - (position / 100) * span : start + (position / 100) * span);
}

/** The positive and negative totals of a bar's segments; a missing value adds nothing. */
export function stackedTotalsOf(segments: readonly { readonly value: number | undefined }[]): {
  readonly positive: number;
  readonly negative: number;
} {
  let positive = 0;
  let negative = 0;
  for (const segment of segments) {
    if (segment.value === undefined) continue;
    if (segment.value > 0) positive += segment.value;
    else negative += segment.value;
  }
  return { positive, negative };
}