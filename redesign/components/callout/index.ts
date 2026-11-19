import { h } from "preact";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import { Info, Lightbulb, MessageSquare, OctagonAlert, TriangleAlert } from "lucide";
import type { IconNode } from "lucide";
import { icon } from "../../src/icon.ts";

export const directive = "callout";
export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";
type CalloutProps = { type?: string; title?: string };

const kinds: Record<CalloutKind, { title: string; icon: IconNode }> = {
  note: { title: "Note", icon: Info },
  tip: { title: "Tip", icon: Lightbulb },
  important: { title: "Important", icon: MessageSquare },
  warning: { title: "Warning", icon: TriangleAlert },
  caution: { title: "Caution", icon: OctagonAlert },
};

export function calloutKind(type: unknown): CalloutKind {
  if (type === "danger") return "caution";
  return typeof type === "string" && Object.hasOwn(kinds, type) ? type as CalloutKind : "note";
}

const usedIds = new WeakMap<Page, Set<string>>();
function titleId(page: Page, kind: CalloutKind): string {
  let ids = usedIds.get(page);
  if (!ids) {
    ids = new Set<string>();
    usedIds.set(page, ids);
  }
  const base = `callout-${kind}-title`;
  let id = base;
  for (let count = 2; ids.has(id); count += 1) id = `${base}-${count}`;
  ids.add(id);
  return id;
}

export default function callout({ props, html, page }: ComponentProps<CalloutProps>) {
  const kind = calloutKind(props.type);
  const id = titleId(page, kind);
  return h(
    "aside",
    { class: `callout callout-${kind}`, role: "note", "aria-labelledby": id },
    h(icon, { node: kinds[kind].icon, class: "callout-icon" }),
    h(
      "div",
      null,
      h("p", { class: "callout-title", id }, props.title?.trim() || kinds[kind].title),
      h("div", { class: "callout-body", dangerouslySetInnerHTML: { __html: html } }),
    ),
  );
}
