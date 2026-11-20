/* Compare island: reveals the "only differences" toggle and the copy button `index.ts` writes
 * hidden and wires them. The rows are hidden, never removed, so turning the toggle off brings the
 * whole table back. The chosen state lives in the address as `?compare=diff`, so a saved or shared
 * link opens the same view. A copy writes the visible rows as a Markdown table, with the record
 * pages under it. The record pickers are `picker.ts`; they read the collection's index only when
 * first opened. */

import { attachPickers } from "./picker.ts";
import { fetchJson, type Fetcher } from "../../src/fetch.ts";
import { withParams } from "../../src/url.ts";

/** The wrapper around a comparison. */
export const ROOT_SELECTOR = "[data-compare]";
export const CONTROLS_SELECTOR = "[data-compare-controls]";
export const TOGGLE_SELECTOR = "[data-compare-only-diff]";
export const STATUS_SELECTOR = ".compare-status";
export const ROW_SELECTOR = "[data-compare-row]";

/** The copy button, its live region, and the chrome that owns the result's words. */
export const COPY_SELECTOR = "[data-compare-copy]";
export const COPY_STATUS_SELECTOR = ".compare-copy-status";
export const CODE_COPY_TEMPLATE_SELECTOR = "[data-code-copy]";

/** The class `picker.ts` puts on the element that holds a column's title. */
const TITLE_SELECTOR = ".compare-title";

/** The hidden text marker on a row that differs. */
const DIFF_MARKER_SELECTOR = ".compare-diff-marker";

/** The record title repeated in each narrow cell. */
const RECORD_SELECTOR = ".compare-record";

/** Record headers, each naming its record column. */
export const HEAD_SELECTOR = "thead th[data-compare-column]";

/** Present on a row whose values differ. */
export const DIFF_ATTR = "data-diff";

/** The query parameter and value that mean "hide the rows without a difference". */
export const DIFF_PARAM = "compare";
export const DIFF_VALUE = "diff";

/** The part of an element the island uses. */
export interface CompareElement {
  hidden: boolean;
  checked?: boolean;
  textContent: string | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: "change" | "click", listener: () => void, options?: { signal?: AbortSignal | undefined }): void;
  querySelector(selector: string): CompareElement | null;
  querySelectorAll(selector: string): Iterable<CompareElement>;
  append(...children: CompareElement[]): void;
  replaceChildren(...children: CompareElement[]): void;
  prepend(...children: CompareElement[]): void;
  focus?(): void;
}

/** The part of the document the island uses. */
export interface CompareDocument {
  querySelectorAll(selector: string): Iterable<CompareElement>;
  querySelector(selector: string): CompareElement | null;
  /** The document's window, read only for its realm's `AbortController`; a fake may omit it. */
  defaultView?: { readonly AbortController?: typeof AbortController | undefined } | null;
}

/** The part of `navigator.clipboard` the island uses. */
export interface Clipboard {
  writeText(text: string): Promise<void>;
}

/** The words the copy reports: the `code-copy` chrome's own success and failure messages. */
export interface CopyLabels {
  readonly copied: string;
  readonly failed: string;
}

/** English fallbacks for a page whose layout lacks the `code-copy` template. */
export const DEFAULT_COPY_LABELS: CopyLabels = {
  copied: "Copied",
  failed: "Copy failed. Select the text and copy it by hand.",
};

/** The record pickers: one per column, reading the collection's index the first time one opens. */
export { attachPickers } from "./picker.ts";

/** What the island reads and writes outside the document, so tests can pass fakes. */
export interface CompareEnv {
  /** The page URL's query, as `location.search` gives it (`"?compare=diff"` or `""`). */
  search(): string;
  /** The page URL's fragment, kept as it was. */
  hash(): string;
  /** Replaces the address without reloading the page. */
  replaceUrl(url: string): void;
  /** Reads one index file as parsed JSON, used by the record pickers; without it the pickers are not drawn. */
  fetchJson?(url: string, signal: AbortSignal): Promise<unknown>;
  /** Writes the copied comparison; without it the copy button stays hidden. */
  clipboard?: Clipboard | undefined;
  /** The page's own address, so copied record links are absolute. */
  url?(): string;
  /**
   * Aborting it detaches every listener `activate` attached, so a host that mounts and unmounts the
   * comparison tears the wiring down without a custom removal API. Absent, the wiring lives for the page.
   */
  signal?: AbortSignal | undefined;
}

/** True when the address asks for the differences only. */
export function onlyDiff(search: string): boolean {
  return new URLSearchParams(search).get(DIFF_PARAM)?.trim() === DIFF_VALUE;
}

/** The page query with `?compare=diff` set or removed, keeping every other parameter where it was. */
export function withDiff(search: string, on: boolean): string {
  return withParams(search, { [DIFF_PARAM]: on ? DIFF_VALUE : null });
}

/** A count in the page's digits, without pulling the server component's Preact. */
function formatCount(lang: string, value: number): string {
  const language = lang.toLowerCase();
  const numberingSystem = language.startsWith("ar") ? "arab" : language.startsWith("fa") ? "arabext" : "latn";
  try {
    return new Intl.NumberFormat(lang, { numberingSystem }).format(value);
  } catch {
    return String(value);
  }
}

/** The announcement: the localised template with `{count}` and `{total}` filled in. */
export function rowsShownText(template: string, count: number, total: number, lang = "en"): string {
  const text = template.trim() === "" ? "{count} of {total} rows shown" : template;
  return text.replace(/\{count\}/g, formatCount(lang, count)).replace(/\{total\}/g, formatCount(lang, total));
}

/** An element's text as one line, as a table cell needs it. */
function oneLine(element: CompareElement | null): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A table cell: its text with the pipe escaped, so a value never splits its row. */
function markdownCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

/** The title a column header shows, before or after a picker moved it into its own span. */
function titleOf(head: CompareElement): string {
  return oneLine(head.querySelector(TITLE_SELECTOR) ?? head);
}

/** A row's field name, without the hidden marker that names a difference. */
function labelOf(row: CompareElement): string {
  const head = row.querySelector("th[scope='row']");
  if (head === null) return "";
  const text = oneLine(head);
  const marker = oneLine(head.querySelector(DIFF_MARKER_SELECTOR));
  return marker !== "" && text.endsWith(marker) ? text.slice(0, -marker.length).trim() : text;
}

/** A cell's value, without the record title repeated for the narrow row layout. */
function cellTextOf(cell: CompareElement | null): string {
  const text = oneLine(cell);
  const record = oneLine(cell?.querySelector(RECORD_SELECTOR) ?? null);
  return record !== "" && text.startsWith(record) ? text.slice(record.length).trim() : text;
}

/** A record's address, absolute when the page's own address is known. */
function addressOf(href: string, pageUrl: string | undefined): string {
  if (pageUrl === undefined || pageUrl === "") return href;
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return href;
  }
}

/**
 * The comparison as a Markdown table, with the record pages listed under it. Hidden rows are left
 * out, so a differences-only view copies only the differences; every record column is kept, since
 * the narrow row layout repeats the page's own titles rather than replacing them.
 */
export function comparisonMarkdown(root: CompareElement, pageUrl?: string): string {
  const heads = [...root.querySelectorAll(HEAD_SELECTOR)];
  const titles = heads.map(titleOf);
  const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
  const lines = [line(["", ...titles.map(markdownCell)]), line(["---", ...heads.map(() => "---")])];

  for (const row of root.querySelectorAll(ROW_SELECTOR)) {
    if (row.hidden) continue;
    const cells = heads.map((_, at) =>
      markdownCell(cellTextOf(row.querySelector(`td[data-compare-column="${at}"]`))),
    );
    lines.push(line([markdownCell(labelOf(row)), ...cells]));
  }

  const links = heads.flatMap((head, at) => {
    const href = head.querySelector("a")?.getAttribute("href")?.trim() ?? "";
    if (href === "") return [];
    const title = (titles[at] ?? "").replace(/([[\]])/g, "\\$1");
    return [`- [${title}](${addressOf(href, pageUrl)})`];
  });
  if (links.length > 0) lines.push("", ...links);

  return lines.join("\n");
}

/** The `code-copy` chrome's words for this page, falling back to English when it has none. */
export function copyLabels(doc: CompareDocument): CopyLabels {
  const template = doc.querySelector(CODE_COPY_TEMPLATE_SELECTOR);
  const read = (name: string, fallback: string): string => {
    const value = template?.getAttribute(name)?.trim() ?? "";
    return value === "" ? fallback : value;
  };
  return {
    copied: read("data-copied", DEFAULT_COPY_LABELS.copied),
    failed: read("data-failed", DEFAULT_COPY_LABELS.failed),
  };
}

/** Reveals one comparison's copy button and writes its visible rows as a Markdown table. */
function attachCopy(doc: CompareDocument, root: CompareElement, env: CompareEnv): void {
  const button = root.querySelector(COPY_SELECTOR);
  const clipboard = env.clipboard;
  if (button === null || clipboard === undefined) return;

  const status = root.querySelector(COPY_STATUS_SELECTOR);
  const labels = copyLabels(doc);
  button.hidden = false;
  button.addEventListener("click", () => {
    const text = comparisonMarkdown(root, env.url?.());
    const write = Promise.resolve().then(() => clipboard.writeText(text));
    void write.then(
      () => {
        if (status !== null) status.textContent = labels.copied;
      },
      () => {
        if (status !== null) status.textContent = labels.failed;
      },
    );
  }, { signal: env.signal });
}

/**
 * Reveals the controls and applies the address's choice. Rows without `data-diff` are hidden, not
 * removed, and the live region says how many of the rows still show. Changing the toggle applies the
 * same choice to every comparison on the page and writes it to the address.
 */
export function activate(doc: CompareDocument, env: CompareEnv = browserEnv()): () => void {
  const roots = [...doc.querySelectorAll(ROOT_SELECTOR)];
  if (roots.length === 0) return () => {};

  const apply = (on: boolean): void => {
    for (const root of roots) {
      const controls = root.querySelector(CONTROLS_SELECTOR);
      const toggle = root.querySelector(TOGGLE_SELECTOR);
      const status = root.querySelector(STATUS_SELECTOR);
      const rows = [...root.querySelectorAll(ROW_SELECTOR)];
      if (controls !== null) controls.hidden = false;
      if (toggle !== null) toggle.checked = on;

      let shown = 0;
      for (const row of rows) {
        const hide = on && !row.hasAttribute(DIFF_ATTR);
        row.hidden = hide;
        if (!hide) shown += 1;
      }

      if (status !== null) {
        const template = status.getAttribute("data-template") ?? "";
        const lang = root.getAttribute("data-lang") ?? "en";
        status.textContent = rowsShownText(template, shown, rows.length, lang);
      }
    }
  };

  const lifecycle = new (doc.defaultView?.AbortController ?? AbortController)();
  const signal = env.signal ?? lifecycle.signal;

  apply(onlyDiff(env.search()));

  for (const root of roots) {
    attachCopy(doc, root, { ...env, signal });
    const toggle = root.querySelector(TOGGLE_SELECTOR);
    if (toggle === null) continue;
    toggle.addEventListener("change", () => {
      const on = toggle.checked === true;
      apply(on);
      env.replaceUrl(`${withDiff(env.search(), on)}${env.hash()}`);
    }, { signal });
  }

  attachPickers(doc, { ...env, signal });
  return () => lifecycle.abort();
}

/** The browser's `fetch`, absent in a test runtime. */
const browserFetch = (globalThis as unknown as { fetch?: Fetcher }).fetch;

/** The browser environment: the page's address and history. */
function browserEnv(): CompareEnv {
  const globals = globalThis as unknown as {
    location?: { href: string; search: string; hash: string };
    history?: { replaceState(data: unknown, title: string, url?: string | null): void };
    navigator?: { clipboard?: Clipboard };
  };
  return {
    search: () => globals.location?.search ?? "",
    hash: () => globals.location?.hash ?? "",
    replaceUrl: (url) => globals.history?.replaceState(null, "", url),
    clipboard: globals.navigator?.clipboard,
    url: () => globals.location?.href ?? "",
    fetchJson: (url, signal) => fetchJson(browserFetch, url, signal),
  };
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: CompareDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
