import type { Page } from "@velella/mizzen/contracts";

// Mizzen renders each directive separately, so IDs from a single Preact render can repeat on a page.
const sequence = new WeakMap<Page, number>();

export function inlinePopoverId(page: Page): string {
  const next = (sequence.get(page) ?? 0) + 1;
  sequence.set(page, next);
  return `lateen-inline-popover-${next}`;
}

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** The label as text, for lookup and for the unknown-term fallback: tags drop, entities decode. */
export function labelText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .trim();
}
