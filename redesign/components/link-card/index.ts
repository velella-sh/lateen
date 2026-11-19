import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "link-card";

const SAFE_HREF = /^(?:\/(?![/\\])|https?:\/\/)[^\s"'<>\\]*$/i;

export function hrefOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const href = value.trim();
  return SAFE_HREF.test(href) ? href : undefined;
}

function textOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text === "" ? undefined : text;
}

export type LinkCardProps = {
  href?: string;
  title?: string;
  description?: string;
};

export default function linkCard({ props }: ComponentProps<LinkCardProps>) {
  const href = hrefOf(props.href);
  const title = textOf(props.title);
  const description = textOf(props.description);
  if (!title) return null;
  const body = [
    h("span", { class: "card-title" }, title),
    description ? h("span", { class: "card-description" }, description) : null,
  ];
  if (!href) return h("div", { class: "link-card mini-card" }, ...body);
  return h("a", { class: "link-card mini-card", href }, ...body);
}
