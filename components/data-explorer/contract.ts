/* The data explorer island's contract: the selectors it finds, the ids and classes it writes, its two
 * limits, and the narrow element, window, document, and environment interfaces it touches. Constants and
 * types only, so the view, the environment, and the entry can all import it. */

/** The explorer root the island finds. */
export const ROOT_SELECTOR = "[data-explorer]";

/** The query field. */
export const INPUT_SELECTOR = ".data-explorer-input";

/** The live region that announces the result count. */
export const STATUS_SELECTOR = ".data-explorer-status";

/** The note that names the query when nothing matches. */
export const EMPTY_SELECTOR = ".data-explorer-empty";

/** The button that reveals the next page of matches. */
export const MORE_SELECTOR = ".data-explorer-more";

/** The sort control's wrapper and its select. */
export const SORT_SELECTOR = "[data-explorer-sort]";
export const SORT_FIELD_SELECTOR = ".data-explorer-sort-field";

/** The filter fields the island fills after the index loads. */
export const FILTERS_SELECTOR = "[data-explorer-filters]";

/** The removable chips naming the active filters. */
export const CHIPS_SELECTOR = "[data-explorer-chips]";

/** The box that scrolls the table; hidden while an empty note shows. */
export const TABLE_SELECTOR = ".table-scroll";

/** The table body the island replaces. */
export const BODY_SELECTOR = "tbody";

/** The body row the island reads and writes. */
export const ROW_SELECTOR = "tbody tr";

/** The id prefix of a drawn result row. */
export const OPTION_ID_PREFIX = "explorer-option-";

/** The class the active result row carries. */
export const ACTIVE_ROW_CLASS = "data-explorer-active";

/** The id of the drawn row at `index`: positional, so the field's reference follows its place. */
export function optionId(index: number): string {
  return `${OPTION_ID_PREFIX}${index + 1}`;
}

/** How long typing rests before the query runs. */
export const DEBOUNCE_MS = 150;

/** Rows one page shows; the same number `index.ts` renders as the static table. */
export const ROW_LIMIT = 50;

/** A key press as the island reads it. */
export interface ExplorerKeyEvent {
  readonly key?: string | undefined;
  preventDefault(): void;
}

/** The part of an element the island uses. */
export interface ExplorerElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: (event: ExplorerKeyEvent) => void, options?: { signal?: AbortSignal | undefined }): void;
  querySelector(selector: string): ExplorerElement | null;
  querySelectorAll(selector: string): Iterable<ExplorerElement>;
  append(...children: ExplorerElement[]): void;
  replaceChildren(...children: ExplorerElement[]): void;
  /** Follows a result link, as a pointer would. */
  click?(): void;
  /** Moves focus to the element, where the browser can. */
  focus?(): void;
  /** Brings the active row into view, where the browser can scroll. */
  scrollIntoView?(options: { readonly block: "nearest" }): void;
  textContent: string | null;
  innerHTML: string;
  hidden: boolean;
  checked?: boolean;
  value?: string;
  ownerDocument?: ExplorerDocument | null;
}

/** The page address, read without reloading it. */
export interface ExplorerLocation {
  href: string;
  search: string;
}

/** The page history, written without adding an entry. */
export interface ExplorerHistory {
  replaceState(data: unknown, unused: string, url?: string | null): void;
}

/** The part of the window the island uses to keep the address in step. */
export interface ExplorerWindow {
  location: ExplorerLocation;
  history: ExplorerHistory;
  addEventListener(type: "popstate", listener: () => void, options?: { signal?: AbortSignal | undefined }): void;
  /** The window realm's own `AbortController`, so the teardown signal matches the realm the page's nodes live in. */
  readonly AbortController?: typeof AbortController | undefined;
}

/** The part of the document the island uses. */
export interface ExplorerDocument {
  querySelector(selector: string): ExplorerElement | null;
  querySelectorAll(selector: string): Iterable<ExplorerElement>;
  createElement(tag: string): ExplorerElement;
  documentElement?: { getAttribute(name: string): string | null } | null;
  defaultView?: ExplorerWindow | null;
}

/** What the island reads from the world; tests pass a fake fetch and clock. */
export interface ExplorerEnv {
  /** Reads one index file as parsed JSON. */
  fetchJson(url: string, signal: AbortSignal): Promise<unknown>;
  schedule(listener: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}
