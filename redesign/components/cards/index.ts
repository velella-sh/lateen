import { h } from "preact";
import type { ComponentChildren } from "preact";
import { hrefOf } from "../link-card/index.ts";

export const directive = "cards";
export const GRID_CLASS = "cards mini-cards";
export const CARD_CLASS = "card mini-card";

export { hrefOf };

function textOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text === "" ? undefined : text;
}

export type CardsProps = { children?: ComponentChildren };

export default function cards({ children }: CardsProps) {
  return h("div", { class: GRID_CLASS }, children);
}

export type CardProps = {
  href: string;
  title: string;
  description?: string;
  class?: string;
};

export function card({ href, title, description, class: extra }: CardProps) {
  const safeHref = hrefOf(href);
  const heading = textOf(title);
  const body = textOf(description);
  const className = extra?.trim() ? `${CARD_CLASS} ${extra.trim()}` : CARD_CLASS;
  const parts: ComponentChildren[] = [
    heading === undefined ? null : h("span", { class: "card-title" }, heading),
    body === undefined ? null : h("span", { class: "card-description" }, body),
  ];
  if (safeHref === undefined || heading === undefined) {
    return h("div", { class: className }, ...parts);
  }
  return h("a", { class: className, href: safeHref }, ...parts);
}
