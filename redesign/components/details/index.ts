import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "details";
export const DEFAULT_SUMMARY = "Details";

export type DetailsProps = {
  summary?: string;
  open?: string;
};

export default function details({ props, html }: ComponentProps<DetailsProps>) {
  const summary = props.summary?.trim() ? props.summary : DEFAULT_SUMMARY;
  return h(
    "details",
    { class: "details soft", open: "open" in props },
    h("summary", { class: "details-summary" }, summary),
    h("div", { class: "details-body", dangerouslySetInnerHTML: { __html: html } }),
  );
}
