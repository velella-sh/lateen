import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "badge";
type BadgeProps = { text?: string; variant?: string };

export default function badge({ props, html }: ComponentProps<BadgeProps>) {
  const text = props.text?.trim() || html.replace(/<[^>]+>/g, "").trim() || "Badge";
  const ink = props.variant === "ink";
  return h(
    "span",
    { class: ink ? "badge pill ink" : "badge pill", ...(ink ? { "data-variant": "ink" } : {}) },
    text,
  );
}
