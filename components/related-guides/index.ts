import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Component, Page } from "@velella/mizzen/contracts";
import pager from "../../chrome/pager/index.ts";
import { compareGuides, groupsOf, isGuide } from "../../layouts/guide-index.ts";
import { t } from "../../i18n/index.ts";
import { tagsOf } from "../tags/index.ts";

/** Most guides the shared-tag list shows. */
export const RELATED_LIMIT = 4;

/** A page's tag labels, trimmed and without markup, for comparing two guides. */
function tags(page: Page): string[] {
  return tagsOf(page.frontMatter.tags).map((tag) => tag.label);
}

/** True when the two guides have at least one tag label in common. */
function sharesTag(a: Page, b: Page): boolean {
  const own = new Set(tags(a));
  return tags(b).some((tag) => own.has(tag));
}

/**
 * The guide footer: the previous and next guides of the page's tag group, then up to four other
 * built guides that share a tag with it. The previous and next guides are not repeated in the list.
 * A page with no neighbours and no shared tag renders nothing. Only `site.pages` is read, so a link
 * never points to a page the build did not write.
 */
const relatedGuides: Component = ({ page, site }) => {
  const group = groupsOf(site.pages).find((candidate) => candidate.guides.some((guide) => guide.url === page.url));
  const index = group?.guides.findIndex((guide) => guide.url === page.url) ?? -1;
  const prev = index > 0 ? group?.guides[index - 1] : undefined;
  const next = index >= 0 ? group?.guides[index + 1] : undefined;

  const beside = new Set([prev?.url, next?.url]);
  const related = site.pages
    .filter((candidate) => isGuide(candidate) && candidate.url !== page.url && !beside.has(candidate.url) && sharesTag(page, candidate))
    .sort(compareGuides)
    .slice(0, RELATED_LIMIT);

  if (prev === undefined && next === undefined && related.length === 0) return null;

  return h(
    "div",
    { class: "related-guides" },
    pager({
      page,
      site,
      trail: [],
      pager: {
        ...(prev === undefined ? {} : { prev }),
        ...(next === undefined ? {} : { next }),
      },
    }) as ComponentChildren,
    related.length === 0
      ? null
      : h(
          "section",
          { class: "related-guides-more" },
          h("h2", { class: "related-guides-heading" }, t(page.lang, "related_guides")),
          h(
            "ul",
            { class: "related-guides-list" },
            ...related.map((guide) =>
              h(
                "li",
                { class: "related-guides-item" },
                h("a", { class: "related-guides-link", href: guide.url }, guide.title),
              ),
            ),
          ),
        ),
  );
};

export default relatedGuides;
