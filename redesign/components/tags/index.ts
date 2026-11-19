import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "tags";

export type Tag = { readonly label: string; readonly url?: string };
export type TagsProps = { items?: string };

const SAFE_URL = /^(?:\/(?![/\\])|https?:\/\/)[^\s"'<>\\]*$/i;

export function tagOf(value: unknown): Tag | undefined {
  if (typeof value === "string") {
    const label = value.trim();
    return label ? { label } : undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Readonly<Record<string, unknown>>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!label) return undefined;
  const url = typeof record.url === "string" ? record.url.trim() : "";
  return SAFE_URL.test(url) ? { label, url } : { label };
}

export function parseItems(raw: unknown): Tag[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.map(tagOf).filter((tag): tag is Tag => tag !== undefined);
  } catch {
    return [];
  }
}

export default function tags({ props, page }: ComponentProps<TagsProps>) {
  const fromProps = parseItems(props.items);
  const fromPage = Array.isArray(page.frontMatter.tags)
    ? page.frontMatter.tags.map(tagOf).filter((tag): tag is Tag => tag !== undefined)
    : [];
  const items = fromProps.length > 0 ? fromProps : fromPage;
  if (items.length === 0) return null;
  return h(
    "ul",
    { class: "tags pills", "aria-label": "Tags" },
    items.map((tag) =>
      h(
        "li",
        null,
        tag.url
          ? h("a", { class: "tag pill", href: tag.url }, tag.label)
          : h("span", { class: "tag pill" }, tag.label),
      ),
    ),
  );
}
