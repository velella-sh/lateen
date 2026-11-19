import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "timeline";

export type TimelineItem = { readonly label: string; readonly detail: string };

export type TimelineProps = { items?: string };

export function parseItems(raw: unknown): TimelineItem[] {
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
    const label = typeof record.label === "string"
      ? record.label.trim()
      : typeof record.version === "string"
        ? record.version.trim()
        : "";
    const detail = typeof record.detail === "string"
      ? record.detail.trim()
      : typeof record.status === "string"
        ? record.status.trim()
        : typeof record.title === "string"
          ? record.title.trim()
          : "";
    return label ? [{ label, detail }] : [];
  });
}

export function parseBody(html: string): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const inner = match[1] ?? "";
    const strong = /<strong\b[^>]*>([\s\S]*?)<\/strong>/i.exec(inner);
    const label = (strong?.[1] ?? "").replace(/<[^>]*>/g, "").trim()
      || inner.replace(/<[^>]*>/g, "").trim().split(/\s+/)[0]
      || "";
    const detail = inner
      .replace(strong?.[0] ?? "", "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (label) items.push({ label, detail });
  }
  return items;
}

export default function timeline({ props, html }: ComponentProps<TimelineProps>) {
  const fromProps = parseItems(props.items);
  const items = fromProps.length > 0 ? fromProps : parseBody(html);
  if (items.length === 0) return null;
  return h(
    "div",
    { class: "timeline", "data-timeline": "" },
    items.map((item) =>
      h("div", null, h("strong", null, item.label), item.detail ? h("span", null, item.detail) : null),
    ),
  );
}
