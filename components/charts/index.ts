import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import chartData from "../chart-data/index.ts";
import { idBaseOf } from "../chart-data/input.ts";

export const directive = "charts";

export type ChartRow = { readonly label: string; readonly value: number };
export type ChartsProps = {
  title?: string;
  rows?: string;
  type?: string;
};

export function parseRows(raw: unknown): ChartRow[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return [];
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const record = entry as Readonly<Record<string, unknown>>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const number = typeof record.value === "number"
      ? record.value
      : typeof record.value === "string"
        ? Number(record.value)
        : Number.NaN;
    return label && Number.isFinite(number) ? [{ label, value: number }] : [];
  });
}

const DEFAULT_ROWS: readonly ChartRow[] = [
  { label: "Install", value: 12 },
  { label: "Layouts", value: 28 },
  { label: "Components", value: 46 },
  { label: "Tokens", value: 22 },
];

export default function charts({ props, page }: ComponentProps<ChartsProps>) {
  const rows = parseRows(props.rows);
  const data = rows.length > 0 ? rows : DEFAULT_ROWS;
  const title = (typeof props.title === "string" ? props.title.trim() : "") || "Chart";
  const type = props.type === "line" ? "line" : "bar";
  const max = Math.max(...data.map((row) => row.value), 1);
  const base = idBaseOf(undefined, title, "charts");

  return h(
    "figure",
    {
      class: "charts card",
      "data-charts": true,
      "data-chart-type": type,
    },
    h("figcaption", { class: "charts-title" }, title),
    h(
      "div",
      { class: "charts-fallback bars", "aria-hidden": "true" },
      data.map((row) =>
        h("i", {
          style: `height:${Math.round((row.value / max) * 100)}%`,
          title: `${row.label}: ${row.value}`,
        }),
      ),
    ),
    h("div", { class: "chart-canvas" }, h("canvas", {
      hidden: true,
      role: "img",
      "aria-label": `${title}: ${data.map((row) => `${row.label} ${row.value}`).join(", ")}`,
    })),
    h("script", {
      type: "application/json",
      "data-chart-data": true,
      dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") },
    }),
    chartData({
      title,
      description: `Values by label for ${data.length} ${data.length === 1 ? "category" : "categories"}.`,
      labelHeading: "Label",
      columns: ["Value"],
      rows: data.map((row, index) => ({ id: `${base}-${index + 1}`, label: row.label, values: [row.value] })),
      lang: page.lang,
      id: base,
    }),
  );
}
