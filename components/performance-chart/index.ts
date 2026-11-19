import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "performance-chart";
export const rows = [
  { label: "Core UI", value: 12 },
  { label: "Docs UI", value: 18 },
  { label: "Lazy chart", value: 75 },
] as const;

export default function performanceChart(_input: ComponentProps) {
  return h(
    "figure",
    { class: "card performance-chart", "data-performance-chart": true },
    h("div", { class: "chart-heading" },
      h("div", null,
        h("p", { class: "eyebrow" }, "Performance by design"),
        h("h2", null, "A small core. Rich only when needed."),
        h("p", null, "CSS and JavaScript transfer budgets in gzip kilobytes."),
      ),
      h("span", { class: "badge", "data-variant": "outline" }, "On demand"),
    ),
    h("div", { class: "chart-canvas" }, h("canvas", {
      hidden: true,
      role: "img",
      "aria-label": "Transfer budgets: Core UI 12 KB, Docs UI 18 KB, Lazy chart 75 KB",
    })),
    h("script", { type: "application/json", "data-chart-data": true, dangerouslySetInnerHTML: { __html: JSON.stringify(rows).replace(/</g, "\\u003c") } }),
    h("details", { class: "chart-data" },
      h("summary", null, "View the data"),
      h("table", null,
        h("thead", null, h("tr", null, h("th", { scope: "col" }, "Asset"), h("th", { scope: "col" }, "Budget"))),
        h("tbody", null, rows.map((row) => h("tr", null, h("th", { scope: "row" }, row.label), h("td", null, `${row.value} KB`)))),
      ),
    ),
    h("figcaption", null, "Budgets, not measurements. Chart.js loads only when this section approaches the viewport."),
  );
}
