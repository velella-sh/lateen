/* Compare island: reveals the "only differences" toggle `index.ts` writes hidden and wires it. The
 * rows are hidden, never removed, so turning the toggle off brings the whole table back. The chosen
 * state lives in the address as `?compare=diff`, so a saved or shared link opens the same view. */

/** The wrapper around a comparison. */
export const ROOT_SELECTOR = "[data-compare]";
export const CONTROLS_SELECTOR = "[data-compare-controls]";
export const TOGGLE_SELECTOR = "[data-compare-only-diff]";
export const STATUS_SELECTOR = ".compare-status";
export const ROW_SELECTOR = "[data-compare-row]";

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
  createElement(tag: string): CompareElement;
}

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
    const toggle = root.querySelector(TOGGLE_SELECTOR);
    if (toggle === null) continue;
    toggle.addEventListener("change", () => {
      const on = toggle.checked === true;
      apply(on);
      env.replaceUrl(`${withDiff(env.search(), on)}${env.hash()}`);
    });
  }
}

/** The browser environment: the page's address and history. */
function browserEnv(): CompareEnv {
  const globals = globalThis as unknown as {
    location?: { search: string; hash: string };
    history?: { replaceState(data: unknown, title: string, url?: string | null): void };
    ResizeObserver?: new (callback: () => void) => { observe(target: unknown): void; disconnect(): void };
  };
  return {
    search: () => globals.location?.search ?? "",
    hash: () => globals.location?.hash ?? "",
    replaceUrl: (url) => globals.history?.replaceState(null, "", url),
    width: (root) => root.getBoundingClientRect?.().width ?? Number.POSITIVE_INFINITY,
    watch: (root, update) => {
      if (globals.ResizeObserver === undefined) return () => {};
      const observer = new globals.ResizeObserver(update);
      observer.observe(root);
      return () => observer.disconnect();
    },
  };
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: CompareDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
