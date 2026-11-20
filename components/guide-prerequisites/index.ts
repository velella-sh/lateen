import { h } from "preact";
import { isRecord } from "../../src/guards.ts";
import type { Component } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { withBase } from "../../src/url.ts";

/** The section's class, so the stylesheet and the accessibility gate find it. */
export const SECTION_CLASS = "guide-prerequisites";

/** The heading's id, used to name the section for assistive technology. */
export const TITLE_ID = "guide-prerequisites-title";

/** A URL a prerequisite may link to: root-relative or `http`/`https`. */
const SAFE_HREF = /^(?:\/(?![/\\])|https?:\/\/)[^\s"'<>\\]*$/i;

/** One prerequisite: its label, an optional safe link, and whether the reader may skip it. */
export interface Prerequisite {
  readonly label: string;
  readonly href?: string;
  readonly optional?: true;
}

/** The valid prerequisites from `page.frontMatter.prerequisites`, in order. */
export function prerequisitesOf(value: unknown): Prerequisite[] {
  if (!Array.isArray(value)) return [];
  const items: Prerequisite[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const label = entry.trim();
      if (label !== "") items.push({ label });
      continue;
    }
    if (!isRecord(entry)) continue;
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (label === "") continue;
    const href = typeof entry.href === "string" ? entry.href.trim() : "";
    items.push({
      label,
      ...(SAFE_HREF.test(href) ? { href } : {}),
      ...(entry.optional === true ? { optional: true } : {}),
    });
  }
  return items;
}

/**
 * A guide's prerequisites before its steps: a localized heading and one link per prerequisite, with
 * an optional marker the reader can skip. The data is front matter only, and none means no section.
 */
const guidePrerequisites: Component = ({ page, site }) => {
  const items = prerequisitesOf(page.frontMatter.prerequisites);
  if (items.length === 0) return null;

  return h(
    "section",
    { class: SECTION_CLASS, "aria-labelledby": TITLE_ID },
    h("h2", { id: TITLE_ID, class: "guide-prerequisites-title" }, t(page.lang, "guide_prerequisites")),
    h(
      "ul",
      { class: "guide-prerequisites-list" },
      ...items.map((item) =>
        h(
          "li",
          { class: "guide-prerequisites-item" },
          item.href === undefined
            ? h("span", null, item.label)
            : h("a", { href: withBase(site.config.base, item.href) }, item.label),
          item.optional === true
            ? h("span", { class: "guide-prerequisites-optional" }, t(page.lang, "guide_optional"))
            : null,
        ),
      ),
    ),
  );
};

export default guidePrerequisites;
