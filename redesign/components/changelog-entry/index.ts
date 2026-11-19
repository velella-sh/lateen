import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "changelog-entry";

export type ChangelogEntryProps = {
  version?: string;
  date?: string;
  categories?: string;
  id?: string;
};

function slugOf(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseCategories(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const value: unknown = JSON.parse(trimmed);
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((part) => part.trim()).filter(Boolean);
}

export default function changelogEntry({ props, html }: ComponentProps<ChangelogEntryProps>) {
  const version = props.version?.trim() || "Unreleased";
  const id = props.id?.trim() || `v${slugOf(version) || "unreleased"}`;
  const date = props.date?.trim();
  const categories = parseCategories(props.categories);
  const meta = [date, categories.length ? categories.join(" · ") : "docs theme"].filter(Boolean).join(" · ");

  return h(
    "section",
    { class: "changelog-entry", id },
    h("h2", { class: "changelog-entry-version" }, version),
    meta ? h("p", { class: "changelog-entry-meta" }, meta) : null,
    html
      ? h("div", { class: "changelog-entry-body", dangerouslySetInnerHTML: { __html: html } })
      : null,
  );
}
