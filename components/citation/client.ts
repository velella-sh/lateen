/* Citation island: adds a button that copies the visible citation text. The button is made here, so a
 * reader without JavaScript gets a plain, selectable citation and no control that would do nothing. */

/** The aside around a citation. */
export const ROOT_SELECTOR = "[data-citation]";

/** The paragraph whose text the copy takes. */
export const TEXT_SELECTOR = ".citation-text";

/** Class on the copy button the island adds. */
export const BUTTON_CLASS = "citation-copy";

/** How long the copied label stays before the copy label comes back. */
export const RESET_MS = 2000;

/** The part of an element the island reads and writes. */
export interface CitationElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  append(...nodes: unknown[]): void;
  addEventListener(type: "click", listener: () => void): void;
  querySelector(selector: string): { textContent: string | null } | null;
  textContent: string | null;
}

/** The part of the document the island uses. */
export interface CitationDocument {
  createElement(tag: string): CitationElement;
  querySelectorAll(selector: string): Iterable<CitationElement>;
}

/** The part of `navigator.clipboard` the island uses. */
export interface CitationClipboard {
  writeText(text: string): Promise<void>;
}

/** Everything the island reads from the world; tests pass fakes, the browser supplies its own. */
export interface CitationEnv {
  clipboard?: CitationClipboard | undefined;
  schedule(callback: () => void, ms: number): unknown;
}

/** The browser globals the island starts from, so a runtime without a document stays inert. */
export interface CitationGlobals {
  document?: CitationDocument;
  navigator?: { clipboard?: CitationClipboard };
  setTimeout?(callback: () => void, ms: number): unknown;
}

/** The label a copy control shows: the result when it worked, the copy label otherwise. */
export function labelAfterCopy(ok: boolean, copy: string, copied: string): string {
  return ok ? copied : copy;
}

/** A label from the aside, or a fallback when an older build wrote none. */
function labelOf(button: CitationElement, name: string, fallback: string): string {
  const value = button.getAttribute(name)?.trim() ?? "";
  return value === "" ? fallback : value;
}

/** Adds a copy button to every citation and wires it to the visible text. */
export function activate(doc: CitationDocument, env: CitationEnv): void {
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) {
    const text = root.querySelector(TEXT_SELECTOR)?.textContent?.trim() ?? "";
    if (text === "") continue;

    const copy = labelOf(root, "data-copy", "Copy citation");
    const copied = labelOf(root, "data-copied", "Citation copied");
    const button = doc.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("class", BUTTON_CLASS);
    button.textContent = copy;
    root.append(button);

    let clicks = 0;
    button.addEventListener("click", () => {
      const click = ++clicks;
      const clipboard = env.clipboard;
      if (clipboard === undefined) return;
      Promise.resolve()
        .then(() => clipboard.writeText(text))
        .then(
          () => {
            button.textContent = labelAfterCopy(true, copy, copied);
            env.schedule(() => {
              if (click === clicks) button.textContent = copy;
            }, RESET_MS);
          },
          () => {
            button.textContent = labelAfterCopy(false, copy, copied);
          },
        );
    });
  }
}

/** Adds the copy buttons on the page; a runtime without a document touches nothing. */
export function start(globals: CitationGlobals): void {
  const doc = globals.document;
  if (doc === undefined) return;
  activate(doc, {
    clipboard: globals.navigator?.clipboard,
    schedule: (callback, ms) => globals.setTimeout?.(callback, ms),
  });
}

start(globalThis as unknown as CitationGlobals);
