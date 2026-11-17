/* Compare island: reveals the "only differences" toggle `index.ts` writes hidden and wires it. The
 * rows are hidden, never removed, so turning the toggle off brings the whole table back. The chosen
 * state lives in the address as `?compare=diff`, so a saved or shared link opens the same view. */

/** The wrapper around a comparison. */
export const ROOT_SELECTOR = "[data-compare]";
export const CONTROLS_SELECTOR = "[data-compare-controls]";
export const TOGGLE_SELECTOR = "[data-compare-only-diff]";
export const STATUS_SELECTOR = ".compare-status";
export const ROW_SELECTOR = "[data-compare-row]";

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
  addEventListener(type: "change", listener: () => void): void;
  querySelector(selector: string): CompareElement | null;
  querySelectorAll(selector: string): Iterable<CompareElement>;
}

/** The part of the document the island uses. */
export interface CompareDocument {
  querySelectorAll(selector: string): Iterable<CompareElement>;
}

/** What the island reads and writes outside the document, so tests can pass fakes. */
export interface CompareEnv {
  /** The page URL's query, as `location.search` gives it (`"?compare=diff"` or `""`). */
  search(): string;
  /** The page URL's fragment, kept as it was. */
  hash(): string;
  /** Replaces the address without reloading the page. */
  replaceUrl(url: string): void;
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
  };
  return {
    search: () => globals.location?.search ?? "",
    hash: () => globals.location?.hash ?? "",
    replaceUrl: (url) => globals.history?.replaceState(null, "", url),
  };
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: CompareDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
