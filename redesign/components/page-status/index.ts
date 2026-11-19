import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

export const directive = "page-status";
export const STATUSES = ["experimental", "beta", "deprecated"] as const;
export type BannerStatus = (typeof STATUSES)[number];

export type PageStatusProps = {
  status?: string;
  since?: string;
  replaced_by?: string;
};

const LABELS: Readonly<Record<BannerStatus, string>> = {
  experimental: "Experimental",
  beta: "Beta",
  deprecated: "Deprecated",
};

const HINTS: Readonly<Record<BannerStatus, string>> = {
  experimental: "This page describes an experimental feature.",
  beta: "This page describes a beta feature.",
  deprecated: "This page describes a deprecated feature.",
};

const SAFE_URL = /^(?:\/(?![/\\])|https:\/\/)[^\s"<>]*$/;

export function statusOf(value: unknown): BannerStatus | undefined {
  if (typeof value !== "string") return undefined;
  const status = value.trim().toLowerCase();
  return (STATUSES as readonly string[]).includes(status) ? status as BannerStatus : undefined;
}

const pageStatus: Component<PageStatusProps> = ({ props }) => {
  const status = statusOf(props.status);
  if (status === undefined) return null;
  const since = typeof props.since === "string" ? props.since.trim() : "";
  const replaced = typeof props.replaced_by === "string" ? props.replaced_by.trim() : "";
  const href = SAFE_URL.test(replaced) ? replaced : undefined;

  return h(
    "div",
    { class: `page-status page-status-${status}`, role: "note" },
    h("strong", { class: "page-status-label pill ink" }, LABELS[status]),
    h("span", { class: "page-status-message" }, HINTS[status]),
    since ? h("span", { class: "page-status-since" }, `Since ${since}`) : null,
    status === "deprecated" && href
      ? h("a", { class: "page-status-replacement", href }, "See replacement")
      : null,
  );
};

export default pageStatus;
