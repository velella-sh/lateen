/* Subscribing island: reveals the copy button of each calendar address when the browser can copy.
   Without it the address stays visible as selectable text and the button stays hidden. The result
   is written to the panel's live region, so assistive technology reads the confirmation. */

export const ROOT_SELECTOR = "[data-list-subscribe]";
export const BUTTON_SELECTOR = "[data-calendar-copy]";
export const STATUS_SELECTOR = ".list-subscribe-status";

/** How long the confirmation stays before the button returns to its label. */
export const RESET_MS = 2000;

export interface Button {
  hidden: boolean;
  textContent: string | null;
  dataset: { text?: string };
  addEventListener(type: "click", listener: () => void): void;
}

export interface Root {
  dataset: { copied?: string; copyFailed?: string };
  querySelector(selector: string): Button | { textContent: string | null } | null;
  querySelectorAll(selector: string): Iterable<Button>;
}

export interface Clipboard {
  writeText(text: string): Promise<void>;
}

export interface Env {
  clipboard?: Clipboard | undefined;
  schedule(callback: () => void, ms: number): unknown;
}

/** Writes the button's address and tells the reader the result in the panel's live region. */
export function copy(button: Button, root: Root, env: Env): Promise<void> {
  const clipboard = env.clipboard;
  if (clipboard === undefined) return Promise.resolve();
  const label = button.textContent ?? "";
  const status = root.querySelector(STATUS_SELECTOR);
  const say = (message: string): void => {
    button.textContent = message;
    if (status !== null) status.textContent = message;
    env.schedule(() => {
      button.textContent = label;
      if (status !== null) status.textContent = "";
    }, RESET_MS);
  };
  return clipboard.writeText(button.dataset.text ?? "").then(
    () => say(root.dataset.copied ?? label),
    () => say(root.dataset.copyFailed ?? label),
  );
}

/** Wires one panel's copy buttons, when there is a clipboard. */
export function activate(root: Root, env: Env): void {
  if (env.clipboard === undefined) return;
  for (const button of root.querySelectorAll(BUTTON_SELECTOR)) {
    button.hidden = false;
    button.addEventListener("click", () => void copy(button, root, env));
  }
}

export interface Doc {
  querySelectorAll(selector: string): Iterable<Root>;
}

/** Wires every panel on the page. */
export function activateAll(doc: Doc, env: Env): void {
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) activate(root, env);
}

const globals = globalThis as unknown as {
  document?: Doc;
  navigator?: { clipboard?: Clipboard };
  setTimeout(callback: () => void, ms: number): unknown;
};

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) {
  activateAll(globals.document, {
    clipboard: globals.navigator?.clipboard,
    schedule: (callback, ms) => globals.setTimeout(callback, ms),
  });
}
