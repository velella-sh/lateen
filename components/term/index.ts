import { h } from "preact";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { textOf as trimmed } from "../../src/guards.ts";
import { glossaryCollectionName, glossaryPage, selectTerms, findTerm, type Term } from "../../src/terms.ts";
import { baseOf, withBase } from "../../src/url.ts";

/** The Markdown directive this component handles: `:term[Network]{id=network}`. */
export const directive = "term";

/** The options the directive reads; the docs page lists exactly these. */
export const TERM_OPTIONS = ["id"] as const;

/** Class on the disclosure, or on the plain text of an unknown term. */
export const TERM_CLASS = "term";

/** Class on the `<summary>`: the label as the author wrote it. */
export const LABEL_CLASS = "term-label";

/** Class on the panel that holds the definition and the link. */
export const PANEL_CLASS = "term-panel";

/** Class on the definition. */
export const DEFINITION_CLASS = "term-definition";

/** Class on the optional link to the glossary page or the term's record page. */
export const LINK_CLASS = "term-link";

/** Class added to the plain text shown when no term answers. */
export const UNKNOWN_CLASS = "term-unknown";

/** Class on the visible marker after an unknown term. */
export const MARKER_CLASS = "term-marker";

/** Class on the sentence a screen reader reads for an unknown term. */
export const SR_CLASS = "term-sr";

/** Props from the directive: `:term[Network]{id=network}`. Every value is a string. */
export type TermProps = {
  /** The term's record id. When it is missing, the label text finds the term by name or alias. */
  id?: string;
};

/** A prop as trimmed text; `undefined` for anything that is not a string. */
function textOf(value: unknown): string {
  return trimmed(value) ?? "";
}

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** The label as text, for lookup and for the unknown-term fallback: tags drop, entities decode. */
export function labelText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .trim();
}

/** The term the directive names: by `id`, else by the label's text, name, or another name. */
export function termOf(terms: readonly Term[], id: string, label: string): Term | undefined {
  return id === "" ? findTerm(terms, label) : findTerm(terms, id);
}

/**
 * Where the term's definition lives: the glossary page from `theme.options.glossary.page` with the
 * record id as its anchor, else the term's own record page, else nowhere. The glossary address is
 * the one the option writes, so a site under a base path gets the base added here; a record URL
 * already carries it.
 */
export function termHref(site: Site, page: Page, term: Term): string | undefined {
  const glossary = glossaryPage(site, page.lang);
  if (glossary !== undefined) return `${withBase(baseOf(site), glossary)}#${term.id}`;

  const collection = glossaryCollectionName(site);
  if (collection === undefined) return undefined;
  return site.pages.find((candidate) => candidate.record?.collection === collection && candidate.record.id === term.id)
    ?.url;
}

/**
 * A term in running text: the label is the `<summary>` of a native `<details>`, so a tap, click,
 * Enter, or Space opens the definition without JavaScript. The panel is ordinary content, never a
 * tooltip, and its link is reachable by keyboard. An unknown term stays the label as plain text with
 * a visible marker, so a missing glossary entry never hides the words the author wrote.
 */
export default function term({ props, html, page, site }: ComponentProps<TermProps>) {
  const id = textOf(props.id);
  const label = labelText(html);
  const found = termOf(selectTerms(site, page.lang), id, label);

  if (found === undefined) {
    const text = label === "" ? id : label;
    return h(
      "span",
      { class: `${TERM_CLASS} ${UNKNOWN_CLASS}`, "data-term": text },
      text,
      h("span", { class: MARKER_CLASS, "aria-hidden": "true" }, "?"),
      h("span", { class: SR_CLASS }, ` (${t(page.lang, "term_unknown")})`),
    );
  }

  const href = termHref(site, page, found);
  return h(
    "details",
    { class: TERM_CLASS, "data-term": found.id },
    // The label is the engine's rendered children HTML; props above are text, never markup.
    h("summary", { class: LABEL_CLASS, dangerouslySetInnerHTML: { __html: html } }),
    h(
      "div",
      { class: PANEL_CLASS },
      // shortcut: the definition is escaped text because the engine hands components no rendered Markdown; upgrade when a render contract lands.
      h("p", { class: DEFINITION_CLASS }, found.definition),
      href === undefined ? null : h("a", { class: LINK_CLASS, href }, t(page.lang, "term_link")),
    ),
  );
}
