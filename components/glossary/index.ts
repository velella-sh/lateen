import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { selectTerms, type Term } from "../../src/terms.ts";

/** The Markdown directive this component handles: `::glossary`. */
export const directive = "glossary";

/** Class on one letter's section. */
export const GROUP_CLASS = "glossary-group";

/** Class on a letter's heading. */
export const LETTER_CLASS = "glossary-letter";

/** Class on a letter's definition list. */
export const LIST_CLASS = "glossary-list";

/** Class on a term. */
export const TERM_CLASS = "glossary-term";

/** Class on a term's definition. */
export const DEFINITION_CLASS = "glossary-definition";

/** Class on a term's other names. */
export const ALIASES_CLASS = "glossary-aliases";

/** The first character of `text`, counted in code points so a surrogate pair stays whole. */
function firstLetter(text: string): string {
  return Array.from(text.trim())[0] ?? "";
}

/**
 * The site's terms as a glossary: one section per first letter, each a definition list with the term
 * as its linkable `<dt>`, the definition, and the other names. Terms and letters sort with the page
 * language's collation, so the Persian and Arabic alphabets keep their own order. A site with no
 * terms renders nothing.
 */
export default function glossary({ page, site }: ComponentProps) {
  const lang = page?.lang ?? "en";
  const terms = selectTerms(site, lang);
  if (terms.length === 0) return null;

  const collator = new Intl.Collator(lang);
  const groups = new Map<string, Term[]>();
  for (const term of [...terms].sort((a, b) => collator.compare(a.term, b.term))) {
    const letter = firstLetter(term.term).toLocaleUpperCase(lang);
    const group = groups.get(letter);
    if (group === undefined) groups.set(letter, [term]);
    else group.push(term);
  }

  return [...groups.keys()].sort((a, b) => collator.compare(a, b)).map((letter) =>
    h(
      "section",
      { class: GROUP_CLASS, key: letter },
      h("h2", { class: LETTER_CLASS }, letter),
      h(
        "dl",
        { class: LIST_CLASS },
        (groups.get(letter) ?? []).flatMap((term) => [
          h("dt", { class: TERM_CLASS, id: term.id }, term.term),
          // shortcut: the definition is escaped text because the engine hands components no rendered Markdown; upgrade when a render contract lands.
          h("dd", { class: DEFINITION_CLASS }, term.definition),
          ...(term.aliases.length === 0
            ? []
            : [h("dd", { class: ALIASES_CLASS }, term.aliases.join(", "))]),
        ]),
      ),
    ),
  );
}
