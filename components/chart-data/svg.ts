/**
 * The SVG marks the build-time charts share: axis and grid lines, bars, tick and value text, category
 * labels with their whole-label title, and the labelled `<svg>` frame. Each chart keeps its own
 * semantics — what it plots and where — while the marks that must stay consistent are built once.
 * Attribute order here is the order the charts have always rendered, so the bytes stay stable.
 */
import { h } from "preact";
import type { ComponentChildren } from "preact";
import { zoomable } from "../../src/zoom.ts";

/** A straight mark: an axis line or one grid line per tick. */
export function lineMark(className: string, x1: number, x2: number, y1: number, y2: number) {
  return h("line", { class: className, x1, x2, y1, y2 });
}

/** A bar or a segment: its top-left corner and its size. */
export function barMark(className: string, x: number, y: number, width: number, height: number) {
  return h("rect", { class: className, x, y, width, height });
}

/** A text mark at a point, anchored to start, middle, or end; an unset anchor or dir is left off. */
export function textMark(
  className: string,
  x: number,
  y: number,
  anchor: string | undefined,
  content: string,
  dir?: "ltr",
) {
  return h("text", { class: className, x, y, "text-anchor": anchor, dir }, content);
}

/** A label cut for the plot, with the whole label in a `<title>` when the cut removed anything. */
export function labelMark(
  className: string,
  x: number,
  y: number,
  anchor: string | undefined,
  label: string,
  short: string,
  dir?: "ltr",
) {
  return h(
    "text",
    { class: className, x, y, "text-anchor": anchor, dir },
    short === label ? null : h("title", null, label),
    short,
  );
}

/** The chart's `<svg>`: its size, its accessible name, and the marks in the order they draw. */
export function svgFrame(
  className: string,
  width: number,
  height: number,
  titleId: string,
  name: string,
  marks: readonly ComponentChildren[],
) {
  return h(
    "svg",
    {
      class: className,
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-labelledby": titleId,
      preserveAspectRatio: "xMidYMid meet",
    },
    h("title", { id: titleId }, name),
    ...marks,
  );
}
/**
 * The chart's `<svg>`, or, when `zoom` carries a panel id, the same chart in a button that opens it larger
 * in a native popover. The panel holds a second drawing of the same marks whose title id has a `-zoom`
 * suffix, so no id repeats on the page.
 */
export function zoomableFrame(
  zoom: { readonly id: string; readonly lang: string } | undefined,
  className: string,
  width: number,
  height: number,
  titleId: string,
  name: string,
  marks: readonly ComponentChildren[],
) {
  const inline = svgFrame(className, width, height, titleId, name, marks);
  if (zoom === undefined) return inline;
  return zoomable({
    id: zoom.id,
    lang: zoom.lang,
    alt: name,
    trigger: inline,
    content: svgFrame(`${className} figure-zoom-svg`, width, height, `${titleId}-zoom`, name, marks),
  });
}
