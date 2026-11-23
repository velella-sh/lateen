import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

/** Class on the list. `styles/src/content.css` styles it. */
export const STAT_STRIP_CLASS = "stat-strip";

/** The fewest and most figures a strip shows. Fewer than the minimum renders nothing; extras are dropped. */
export const MIN_STATS = 3;
export const MAX_STATS = 6;

/** Props: `stats` overrides the page's `stats` front matter, `src` is kept as `data-src`. */
export type StatStripProps = {
  stats?: unknown;
  src?: string;
};

/** One figure: the value and label exactly as authored, and an optional safe link. */
export interface Stat {
  readonly value: string;
  readonly label: string;
  readonly url?: string;
}

/** Root-relative (not protocol-relative) or http(s); any other URL leaves the label as plain text. */
const SAFE_URL = /^(?:\/(?![/\\])|https?:\/\/)[^\s"'<>\\]*$/i;

/** One figure from a front-matter entry; an entry without a value or a label is dropped. Numbers keep their written form. */
export function statOf(entry: unknown): Stat | undefined {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return undefined;
  const record = entry as Readonly<Record<string, unknown>>;
  const raw = record.value;
  const value = typeof raw === "string" ? raw.trim() : typeof raw === "number" && Number.isFinite(raw) ? String(raw) : "";
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (value === "" || label === "") return undefined;
  const url = typeof record.url === "string" ? record.url.trim() : "";
  return SAFE_URL.test(url) ? { value, label, url } : { value, label };
}

/** The figures to show: valid entries in order, at most six; none when fewer than three are valid. */
export function statsOf(value: unknown): Stat[] {
  if (!Array.isArray(value)) return [];
  const stats = value.map(statOf).filter((s): s is Stat => s !== undefined);
  return stats.length < MIN_STATS ? [] : stats.slice(0, MAX_STATS);
}

/**
 * A strip of three to six figures, each a number shown as text with a label and an optional link.
 * Every value comes from front matter, is never computed or animated, and Persian or Arabic digits
 * stay as written. Renders nothing when fewer than three valid figures exist.
 */
export default function statStrip({ props, page }: ComponentProps<StatStripProps>) {
  const stats = statsOf(props.stats ?? page?.frontMatter?.stats);
  if (stats.length === 0) return null;
  const src = typeof props.src === "string" && props.src !== "" ? props.src : undefined;

  return h(
    "ul",
    { class: STAT_STRIP_CLASS, ...(src === undefined ? {} : { "data-src": src }) },
    stats.map((stat, index) =>
      h(
        "li",
        { key: index, class: "stat" },
        h("span", { class: "stat-value" }, stat.value),
        stat.url === undefined
          ? h("span", { class: "stat-label" }, stat.label)
          : h("a", { class: "stat-label", href: stat.url }, stat.label),
      ),
    ),
  );
}
