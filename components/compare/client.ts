/* Compare island: reveals the "only differences" toggle and the copy button `index.ts` writes
 * hidden and wires them. The rows are hidden, never removed, so turning the toggle off brings the
 * whole table back. The chosen state lives in the address as `?compare=diff`, so a saved or shared
 * link opens the same view. A copy writes the visible rows as a Markdown table, with the record
 * pages under it. The record pickers are `picker.ts`; they read the collection's index only when
 * first opened. */

import { attachPickers } from "./picker.ts";

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

/** The tab row the island fills, and the tabs in it. */
export const TABS_SELECTOR = "[data-compare-tabs]";
export const TAB_CLASS = "compare-tab";

/** Record headers and cells, each naming its record column. */
export const COLUMN_SELECTOR = "[data-compare-column]";
export const HEAD_SELECTOR = "thead th[data-compare-column]";

/** The container width, in CSS pixels, below which one record shows at a time. */
export const NARROW_WIDTH = 640;

/** Present on a comparison that shows one record at a time. */
export const NARROW_ATTRIBUTE = "data-compare-narrow";

/** Present on a row whose values differ. */
export const DIFF_ATTR = "data-diff";

/** The query parameter and value that mean "hide the rows without a difference". */
export const DIFF_PARAM = "compare";
export const DIFF_VALUE = "diff";

/** The part of a click or key event the tabs read. */
export interface CompareEvent {
  readonly key?: string;
  preventDefault?(): void;
}

/** The part of an element the island uses. */
export interface CompareElement {
  hidden: boolean;
  checked?: boolean;
  textContent: string | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: "change" | "click" | "keydown", listener: (event?: CompareEvent) => void): void;
  querySelector(selector: string): CompareElement | null;
  querySelectorAll(selector: string): Iterable<CompareElement>;
  append(...children: CompareElement[]): void;
  replaceChildren(...children: CompareElement[]): void;
  focus?(): void;
  getBoundingClientRect?(): { readonly width: number };
}

/** The part of the document the island uses. */
export interface CompareDocument {
  querySelectorAll(selector: string): Iterable<CompareElement>;
  querySelector(selector: string): CompareElement | null;
  createElement(tag: string): CompareElement;
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
  /** The width of a comparison's container; a missing measure keeps the wide table. */
  width?(root: CompareElement): number;
  /** Calls `update` when the container's width changes, and returns the stop function. */
  watch?(root: CompareElement, update: () => void): () => void;
  /** Reads a text file, used by the record pickers; without it the pickers are not drawn. */
  fetchText?(url: string, signal: AbortSignal): Promise<string>;
  /** Writes the copied comparison; without it the copy button stays hidden. */
  clipboard?: Clipboard | undefined;
  /** The page's own address, so copied record links are absolute. */
  url?(): string;
}

/** One comparison with its record tabs: the buttons, the columns they show, and the chosen record. */
interface View {
  readonly root: CompareElement;
  readonly tabs: CompareElement;
  readonly columns: readonly CompareElement[];
  buttons: readonly CompareElement[];
  selected: number;
}

/** True when the address asks for the differences only. */
export function onlyDiff(search: string): boolean {
  return new URLSearchParams(search).get(DIFF_PARAM)?.trim() === DIFF_VALUE;
}

/** The page query with `?compare=diff` set or removed, keeping every other parameter where it was. */
export function withDiff(search: string, on: boolean): string {
  const params = new URLSearchParams(search);
  if (on) params.set(DIFF_PARAM, DIFF_VALUE);
  else params.delete(DIFF_PARAM);
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

/** The announcement: the localised template with `{count}` and `{total}` filled in. */
export function rowsShownText(template: string, count: number, total: number): string {
  const text = template.trim() === "" ? "{count} of {total} rows shown" : template;
  return text.replace(/\{count\}/g, String(count)).replace(/\{total\}/g, String(total));
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
 * the narrow view hides columns only to fit the screen.
 */
export function comparisonMarkdown(root: CompareElement, pageUrl?: string): string {
  const heads = [...root.querySelectorAll(HEAD_SELECTOR)];
  const titles = heads.map(titleOf);
  const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
  const lines = [line(["", ...titles.map(markdownCell)]), line(["---", ...heads.map(() => "---")])];

  for (const row of root.querySelectorAll(ROW_SELECTOR)) {
    if (row.hidden) continue;
    const cells = heads.map((_, at) =>
      markdownCell(oneLine(row.querySelector(`td[data-compare-column="${at}"]`))),
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
  });
}

/**
 * Shows one record column at a time when the comparison is narrower than `NARROW_WIDTH`, and the
 * whole table otherwise. The tabs stay in the markup hidden on a wide container, so a resize never
 * leaves a record unreachable; the chosen record survives a resize.
 */
function applyView(view: View, env: CompareEnv): void {
  const narrow = (env.width?.(view.root) ?? Number.POSITIVE_INFINITY) < NARROW_WIDTH;
  view.tabs.hidden = !narrow;
  if (narrow) view.root.setAttribute(NARROW_ATTRIBUTE, "");
  else view.root.removeAttribute(NARROW_ATTRIBUTE);

  for (const column of view.columns) {
    const at = Number(column.getAttribute("data-compare-column"));
    column.hidden = narrow && at !== view.selected;
  }
  view.buttons.forEach((button, at) => {
    const chosen = at === view.selected;
    button.setAttribute("aria-selected", chosen ? "true" : "false");
    button.setAttribute("tabindex", chosen ? "0" : "-1");
  });
}

/**
 * Builds the tab row for every comparison with two or more records, and returns the views so the
 * caller can apply the width and watch it. A comparison with one record needs no tabs.
 */
function buildViews(doc: CompareDocument, env: CompareEnv): View[] {
  const views: View[] = [];
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) {
    const tabs = root.querySelector(TABS_SELECTOR);
    const heads = [...root.querySelectorAll(HEAD_SELECTOR)];
    if (tabs === null || heads.length < 2) continue;

    const view: View = {
      root,
      tabs,
      columns: [...root.querySelectorAll(COLUMN_SELECTOR)],
      buttons: [],
      selected: 0,
    };
    const select = (next: number): void => {
      view.selected = next;
      applyView(view, env);
      view.buttons[next]?.focus?.();
    };
    view.buttons = heads.map((head, at) => {
      const button = doc.createElement("button");
      button.setAttribute("type", "button");
      button.setAttribute("role", "tab");
      button.setAttribute("class", TAB_CLASS);
      button.textContent = head.textContent?.trim() ?? String(at + 1);
      button.addEventListener("click", () => select(at));
      button.addEventListener("keydown", (event) => {
        const key = event?.key;
        if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
        event?.preventDefault?.();
        const next =
          key === "Home"
            ? 0
            : key === "End"
              ? heads.length - 1
              : key === "ArrowLeft"
                ? (at - 1 + heads.length) % heads.length
                : (at + 1) % heads.length;
        select(next);
      });
      return button;
    });
    tabs.replaceChildren(...view.buttons);
    views.push(view);
  }
  return views;
}

/**
 * Reveals the controls and applies the address's choice. Rows without `data-diff` are hidden, not
 * removed, and the live region says how many of the rows still show. Changing the toggle applies the
 * same choice to every comparison on the page and writes it to the address.
 */
export function activate(doc: CompareDocument, env: CompareEnv = browserEnv()): void {
  const roots = [...doc.querySelectorAll(ROOT_SELECTOR)];
  if (roots.length === 0) return;

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
        status.textContent = rowsShownText(template, shown, rows.length);
      }
    }
  };

  apply(onlyDiff(env.search()));

  for (const view of buildViews(doc, env)) {
    applyView(view, env);
    env.watch?.(view.root, () => applyView(view, env));
  }

  for (const root of roots) {
    attachCopy(doc, root, env);
    const toggle = root.querySelector(TOGGLE_SELECTOR);
    if (toggle === null) continue;
    toggle.addEventListener("change", () => {
      const on = toggle.checked === true;
      apply(on);
      env.replaceUrl(`${withDiff(env.search(), on)}${env.hash()}`);
    });
  }

  attachPickers(doc, env);
}

/** The browser environment: the page's address and history. */
function browserEnv(): CompareEnv {
  const globals = globalThis as unknown as {
    location?: { href: string; search: string; hash: string };
    history?: { replaceState(data: unknown, title: string, url?: string | null): void };
    navigator?: { clipboard?: Clipboard };
    ResizeObserver?: new (callback: () => void) => { observe(target: unknown): void; disconnect(): void };
  };
  return {
    search: () => globals.location?.search ?? "",
    hash: () => globals.location?.hash ?? "",
    replaceUrl: (url) => globals.history?.replaceState(null, "", url),
    clipboard: globals.navigator?.clipboard,
    url: () => globals.location?.href ?? "",
    width: (root) => root.getBoundingClientRect?.().width ?? Number.POSITIVE_INFINITY,
    watch: (root, update) => {
      if (globals.ResizeObserver === undefined) return () => {};
      const observer = new globals.ResizeObserver(update);
      observer.observe(root);
      return () => observer.disconnect();
    },
    async fetchText(url, signal) {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`${url}: ${response.status}`);
      return response.text();
    },
  };
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: CompareDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
