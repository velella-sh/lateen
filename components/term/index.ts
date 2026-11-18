import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { findTerm, glossaryCollectionName, selectTerms, termHref, type Term } from "../../src/terms.ts";

/** The Markdown directive this component handles: `:term[text]{id=…}`. */
export const directive = "term";

/** The attributes the directive reads. The docs page lists exactly these, and a test keeps them in step. */
export const OPTIONS = ["id"] as const;

export type TermProps = {
  /** The term's record id; without it the visible text is the lookup. */
  id?: string;
};

/** Class on the disclosure, or on the static text when the term is unknown. */
export const TERM_CLASS = "term-popover";

/** Class on the chip: the `<summary>` of the disclosure, or the static chip's label. */
export const CHIP_CLASS = "term-popover-chip";

/** Class on the panel that holds the definition and the entry link. */
export const PANEL_CLASS = "term-popover-panel";

/** Class on the definition. */
export const DEFINITION_CLASS = "term-popover-definition";

/** Class on the optional link to the glossary entry or the term's record page. */
export const LINK_CLASS = "term-popover-link";

/** Class on an unknown term, so the reader and a test can tell it apart. */
export const UNKNOWN_CLASS = "term-unknown";

/** Class on the marker an unknown term shows; it is text, never colour alone. */
export const MARKER_CLASS = "term-unknown-marker";

/** The text of an HTML fragment the engine already rendered: tags dropped and common entities read back. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&amp;/g, "&");
}

/** Where the panel links, and what the link says: the record page, else the glossary entry. */
function linkOf(term: Term, site: ComponentProps["site"], lang: string): { href: string; label: string } | undefined {
  const href = termHref(term, site, lang);
  if (href === undefined) return undefined;
  const collection = glossaryCollectionName(site);
  const ownPage =
    collection !== undefined &&
    site.pages.some((page) => page.record?.collection === collection && page.record.id === term.id);
  return { href, label: t(lang, ownPage ? "term_page_link" : "term_glossary_link") };
}

/**
 * A term in running text: a native `<details>` disclosure. The text is its `<summary>`, so a tap,
 * click, Enter, or Space opens the definition and its link without JavaScript. An unknown term
 * stays plain text with a visible marker, and `data-term` names it for a test and for the site's
 * own styling. No tooltip role is used and nothing is shown on hover alone.
 */
export default function term({ props, html, page, site }: ComponentProps<TermProps>) {
  const lang = page?.lang ?? "en";
  const label = textOf(html).trim();
  const id = typeof props.id === "string" ? props.id.trim() : "";
  const wanted = id === "" ? label : id;
  if (wanted === "") return null;

  const found = findTerm(selectTerms(site, lang), wanted);
  if (found === undefined) {
    return h(
      "span",
      { class: `${TERM_CLASS} ${UNKNOWN_CLASS}`, "data-term": label === "" ? wanted : label },
      label === "" ? wanted : h("span", { dangerouslySetInnerHTML: { __html: html } }),
      h("span", { class: MARKER_CLASS, "aria-hidden": "true" }, "?"),
    );
  }

  const link = linkOf(found, site, lang);

  return h(
    "details",
    { class: TERM_CLASS, "data-term": found.term },
    h("summary", { class: CHIP_CLASS, dangerouslySetInnerHTML: { __html: html } }),
    h(
      "div",
      { class: PANEL_CLASS },
      h("p", { class: DEFINITION_CLASS }, found.definition),
      link === undefined ? null : h("a", { class: LINK_CLASS, href: link.href }, link.label),
    ),
  );
}
