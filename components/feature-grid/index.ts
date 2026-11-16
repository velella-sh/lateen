import { h } from "preact";
import type { ComponentChild } from "preact";
import { iconByName } from "../../icons/index.ts";
import { hrefOf } from "../link-card/index.ts";

/** Class on the grid (`<ul>`). `data-columns` holds the column count it fits at the widest. */
export const GRID_CLASS = "feature-grid";

/** Class on each item. */
export const ITEM_CLASS = "feature-grid-item";

/** Modifier on the one wide item of a bento layout. */
export const WIDE_CLASS = "feature-grid-item-wide";

export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 4;
export const DEFAULT_COLUMNS = 3;

/** One feature, as read from front matter. Only `title` is required. */
export type Feature = {
  title?: unknown;
  description?: unknown;
  /** The name of an icon in the theme's set. It is decoration only: the title carries the meaning. */
  icon?: unknown;
  /** Where the whole card goes. Only a safe destination makes the card a link. */
  url?: unknown;
  /** Makes this item span two columns. Only the first wide item counts. */
  wide?: unknown;
};

export type FeatureGridProps = {
  features?: readonly unknown[];
  /** The most columns the grid uses, from 2 to 4. Fewer fit when the space is narrow. */
  columns?: unknown;
};

function textOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text === "" ? undefined : text;
}

/** The column count to use: a whole number from 2 to 4, else the default. */
export function columnsOf(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) return DEFAULT_COLUMNS;
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, n));
}

/**
 * The feature grid: a list of items, each with an optional icon, a title, an optional text and an
 * optional link. A linked item is one `<a>` around the whole card, so it is one tab stop and the
 * whole card is the target. An entry without a title is dropped, and with nothing left the grid
 * renders nothing. The icon is decoration (`aria-hidden`); a meaning is never carried by it alone.
 */
export default function featureGrid({ features, columns }: FeatureGridProps): ComponentChild {
  const entries = (Array.isArray(features) ? features : []).filter(
    (f): f is Feature => typeof f === "object" && f !== null && textOf((f as Feature).title) !== undefined,
  );
  if (entries.length === 0) return null;

  const wideIndex = entries.findIndex((f) => f.wide === true);
  const items = entries.map((feature, index) => {
    const title = textOf(feature.title)!;
    const description = textOf(feature.description);
    const icon = iconByName(feature.icon);
    const href = hrefOf(feature.url);
    const parts = [
      icon === undefined
        ? null
        : h("span", { class: "feature-grid-icon", "aria-hidden": "true", dangerouslySetInnerHTML: { __html: icon } }),
      h("span", { class: "feature-grid-title" }, title),
      description === undefined ? null : h("span", { class: "feature-grid-text" }, description),
    ];
    const card =
      href === undefined
        ? h("div", { class: "feature-grid-card" }, ...parts)
        : h("a", { class: "feature-grid-card", href }, ...parts);
    return h("li", { class: index === wideIndex ? `${ITEM_CLASS} ${WIDE_CLASS}` : ITEM_CLASS }, card);
  });

  return h("ul", { class: GRID_CLASS, "data-columns": String(columnsOf(columns)) }, items);
}
