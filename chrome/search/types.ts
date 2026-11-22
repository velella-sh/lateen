/*
 * The search dialog's shared vocabulary: the constants and the narrow element, part, and environment
 * interfaces the activation, the live handlers, and the browser bootstrap all name. Types and two
 * constants only, so every other search module may import it without a cycle.
 */

import type { SiteNetwork } from "@velella/mizzen/contracts";
import type { PalettePayload, ThemeChoice } from "../command-palette/actions.ts";
import type { PagefindApi } from "./loader.ts";
import type { SearchRecord } from "./options.ts";
import type { SearchDocument, SearchResults } from "./render.ts";
import type { SearchMessages } from "./messages.ts";

/** The path of the dedicated search page the all-results link opens. */
export const SEARCH_PAGE_PATH = "/search/";

/** Most results shown for one query; Pagefind ranks them, and the top of the list is what a reader wants. */
export const RESULT_LIMIT = 20;

/** The header's search button: `client.ts` reveals it and returns focus to it when the dialog closes. */
export interface SearchButton {
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "click", listener: () => void): void;
  removeEventListener?(type: "click", listener: () => void): void;
  click(): void;
  focus(): void;
}

/** The dialog's close button; it has the same shape as the search button. */
export type SearchClose = SearchButton;

/** A control the dialog reveals only while it can act: the field's clear button and the retry action. */
export interface SearchAction {
  hidden: boolean;
  disabled: boolean;
  addEventListener(type: "click", listener: () => void): void;
  removeEventListener?(type: "click", listener: () => void): void;
}

/** The all-results link: hidden and without an href until the field holds a query. */
export interface SearchLink {
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * The query field. It is the combobox, so it carries the popup's state: `aria-expanded` while the
 * dialog is open, and the active option in `aria-activedescendant`. That attribute is removed rather
 * than emptied when no row is active, because a reference to a row that is not there would dangle.
 */
export interface SearchInput {
  value: string;
  focus(): void;
  setAttribute(name: string, value: string): void;
  removeAttribute?(name: string): void;
  addEventListener(type: "input", listener: () => void): void;
  removeEventListener?(type: "input", listener: () => void): void;
}

/** Anything in the dialog that can take keyboard focus, for the focus trap. */
export interface SearchFocusable {
  focus(): void;
}

/** The status region results and failures are announced on. */
export interface SearchStatus {
  textContent: string | null;
}

/** The inert JSON `chrome/command-palette/` writes into the dialog. */
export interface SearchPaletteSource {
  textContent: string | null;
}

/** What running one action does; the browser supplies working versions, tests inject spies. */
export interface PaletteHandlers {
  theme?(choice: ThemeChoice): void;
  copy?(url: string): void | Promise<void>;
  section?(id: string): void;
  source?(): void;
}

/** A keyboard or dialog event as the dialog reads it. */
export interface SearchEvent {
  readonly key?: string | undefined;
  readonly shiftKey?: boolean | undefined;
  readonly isComposing?: boolean | undefined;
  readonly target?: unknown;
  preventDefault(): void;
}

/** The `<dialog>` element as the script touches it. */
export interface SearchDialog {
  readonly open: boolean;
  hidden: boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  showModal(): void;
  close(): void;
  querySelectorAll(selector: string): Iterable<SearchFocusable>;
  addEventListener(type: string, listener: (event: SearchEvent) => void): void;
  removeEventListener?(type: string, listener: (event: SearchEvent) => void): void;
}

/** The optional network scope selector inside the dialog. */
export interface SearchScope {
  value: string;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener?(type: "change", listener: () => void): void;
}

/** The elements the island wires together. */
export interface SearchParts {
  dialog: SearchDialog;
  button: SearchButton;
  close: SearchClose;
  input: SearchInput;
  results: SearchResults;
  status: SearchStatus;
  /** The command palette's JSON script, when the page carries one. */
  palette?: SearchPaletteSource | undefined;
  /** The field's clear button; it appears only while the field holds text. */
  clear?: SearchAction | undefined;
  /** The retry action; it appears only after an index load failed, and only until one succeeds. */
  retry?: SearchAction | undefined;
  /** The link to the dedicated search page, which follows the field's query. */
  all?: SearchLink | undefined;
  scope?: SearchScope | undefined;
}

/** Everything the island reads from the world; tests pass fakes, the browser supplies its own. */
export interface SearchEnv {
  document: SearchDocument;
  load(url: string): Promise<PagefindApi>;
  /** The action payload; the island parses it from `parts.palette`, tests pass it directly. */
  palette?: PalettePayload | undefined;
  /** How actions run; the island uses `liveHandlers()`, tests inject spies. */
  handlers?: PaletteHandlers | undefined;
  /** The page language, which chooses the count's plural category. */
  lang?: string | undefined;
  /** The page language's messages; the island reads them from the dialog's attributes. */
  messages?: SearchMessages | undefined;
  /** The current `scope` query parameter, kept on the all-results link. */
  scope?: string | null | undefined;
  indexFolder?: string | undefined;
  network?: SiteNetwork | undefined;
  /** Opens the ask panel with the question and the results the dialog currently shows. */
  ask?: ((question: string, records: readonly SearchRecord[]) => void) | undefined;
}
