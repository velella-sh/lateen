import { h } from "preact";
import type { IconNode } from "lucide";

export function icon({ node, class: className }: { node: IconNode; class?: string }) {
  return h(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      class: className,
      "aria-hidden": "true",
      focusable: "false",
    },
    node.map(([tag, attrs]) => h(tag, attrs)),
  );
}
