/*
 * Project switcher island entry: mizzen loads a chrome part's `client.ts`, so this thin module finds
 * the disclosure and hands it to `island.ts`. It hides or changes no markup: a page without a script
 * keeps the native disclosure and its links.
 */

import { activate, type SwitcherDisclosure, type SwitcherDocument, type SwitcherFocusable } from "./island.ts";

export { activate } from "./island.ts";
export type {
  SwitcherClickEvent,
  SwitcherDisclosure,
  SwitcherDocument,
  SwitcherEnv,
  SwitcherFocusEvent,
  SwitcherFocusable,
  SwitcherKeyEvent,
  SwitcherParts,
} from "./island.ts";

/** The browser globals the island needs, without pulling DOM types into the theme's typecheck. */
declare const document: SwitcherDocument & {
  querySelector(selector: string): unknown;
  readonly activeElement: unknown;
};

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (typeof document !== "undefined") {
  type Disclosure = SwitcherDisclosure & { querySelector(selector: string): unknown; querySelectorAll(selector: string): ArrayLike<unknown> };
  const all = (document as unknown as { querySelectorAll(selector: string): ArrayLike<unknown> }).querySelectorAll("[data-project-switcher]");
  for (const node of Array.from(all)) {
    const disclosure = node as Disclosure;
    const summary = disclosure.querySelector("summary") as SwitcherFocusable | null | undefined;
    if (summary === null || summary === undefined) continue;
    activate(
      {
        disclosure,
        summary,
        links: Array.from(disclosure.querySelectorAll("a[href]")) as SwitcherFocusable[],
      },
      { document, hasFocus: () => disclosure.contains(document.activeElement) },
    );
  }
}
