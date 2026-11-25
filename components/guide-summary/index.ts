import { h } from "preact";
import { isRecord } from "../../src/guards.ts";
import type { ComponentChildren } from "preact";
import type { Component, Page } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { componentProps } from "../../src/component-props.ts";
import status from "../status/index.ts";

/** The front-matter facts a guide can set, in the order the bar shows them. */
export const FACTS = ["from", "to", "time", "risk"] as const;

export type GuideFact = (typeof FACTS)[number];

/** The i18n key with each fact's label. */
const LABEL_KEYS: Readonly<Record<GuideFact, string>> = {
  from: "guide_from",
  to: "guide_to",
  time: "guide_time",
  risk: "guide_risk",
};

/** The `guide` front-matter table: `guide: { from, to, time, risk }`. A fact that is not set is left out. */
export function factsOf(page: Pick<Page, "frontMatter">): Partial<Record<GuideFact, string>> {
  const guide = page.frontMatter.guide;
  const facts: Partial<Record<GuideFact, string>> = {};
  if (!isRecord(guide)) return facts;
  for (const key of FACTS) {
    const value = guide[key];
    const text = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
    if (text !== "") facts[key] = text;
  }
  return facts;
}

/**
 * The summary bar of a guide: from, to, time, and risk as a list of facts. The risk is a status: the
 * site's `theme.options.status.values` maps its own values to a tone and a label, so the theme fixes no
 * list. A guide with no facts renders nothing.
 */
const guideSummary: Component = (input) => {
  const { page } = input;
  const facts = factsOf(page);
  const keys = FACTS.filter((key) => facts[key] !== undefined);
  if (keys.length === 0) return null;

  return h(
    "dl",
    { class: "guide-summary", "aria-label": t(page.lang, "guide_summary") },
    ...keys.map((key) => {
      const value = facts[key] as string;
      const content =
        key === "risk"
          ? (status(componentProps(input, { value })) as ComponentChildren)
          : h("span", { class: "guide-summary-text" }, value);
      return h(
        "div",
        { class: `guide-summary-fact guide-summary-${key}`, "data-fact": key },
        h("dt", { class: "guide-summary-label" }, t(page.lang, LABEL_KEYS[key])),
        h("dd", { class: "guide-summary-value" }, content),
      );
    }),
  );
};

export default guideSummary;
