import { h, type ComponentChildren } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import status from "../status/index.ts";
import { labelOf, valuesOf } from "../status/values.ts";

/** The Markdown directive this component handles: `::status-legend` or `::status-legend{values="done,late"}`. */
export const directive = "status-legend";

/** The options the directive reads, documented on `site/components/status.md`. */
export const OPTIONS = ["values"] as const;

/** Props from the directive. The map itself is never repeated here: it comes from `theme.options.status.values`. */
export type StatusLegendProps = {
  /** A comma-separated subset of the mapped values, listed in this order. */
  values?: string | readonly string[];
  /** Source position, kept as `data-src`. */
  src?: string;
};

/** The values to list: the `values` prop (trimmed, deduplicated, mapped ones only) or every mapped value. */
export function legendValues(requested: StatusLegendProps["values"], mapped: readonly string[]): string[] {
  if (requested === undefined) return [...mapped];
  const wanted = (typeof requested === "string" ? requested.split(",") : requested).map((v) => String(v).trim());
  return [...new Set(wanted)].filter((v) => v !== "" && mapped.includes(v));
}

/**
 * A list of the status values a site maps, each as the same badge `:status{value=…}` renders, followed by
 * the optional `description` from the site's options (a string, or a table from language to text).
 * Renders nothing when the site maps no value.
 */
const statusLegend: Component<StatusLegendProps> = ({ props, page, site }) => {
  const map = valuesOf(site?.config);
  if (map === undefined) return null;
  const lang = page?.lang ?? "en";
  const values = legendValues(props.values, Object.keys(map).filter((k) => typeof map[k] === "object" && map[k] !== null));
  if (values.length === 0) return null;
  const src = typeof props.src === "string" && props.src !== "" ? props.src : undefined;
  return h(
    "ul",
    { class: "status-legend", ...(src === undefined ? {} : { "data-src": src }) },
    values.map((value) => {
      const entry = map[value] as { description?: unknown };
      const description = labelOf(entry.description, lang);
      return h(
        "li",
        { class: "status-legend-item", key: value },
        status({ props: { value }, html: "", page, site } as never) as ComponentChildren,
        description === undefined ? null : h("span", { class: "status-legend-description" }, description),
      );
    }),
  );
};

export default statusLegend;
