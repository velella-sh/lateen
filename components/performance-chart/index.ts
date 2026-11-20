import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import chartData from "../chart-data/index.ts";

export const directive = "performance-chart";
export const rows = [
  { label: "Core UI", value: 12 },
  { label: "Docs UI", value: 18 },
  { label: "Lazy chart", value: 75 },
] as const;

export default function performanceChart({ page }: ComponentProps) {
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
    chartData({
      title: "Transfer budgets",
      description: "Gzip transfer budgets in kilobytes for each asset.",
      labelHeading: "Asset",
      columns: ["Budget (KB)"],
      rows: rows.map((row, index) => ({ id: `performance-chart-${index + 1}`, label: row.label, values: [row.value] })),
      lang: page.lang,
      id: "performance-chart",
    }),
    h("figcaption", null, "Budgets, not measurements. Chart.js loads only when this section approaches the viewport."),
  );
}
