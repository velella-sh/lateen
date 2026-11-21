/* cta-band island: reveals the one copy button and wires it with the code copy control from the terminal island. The button copies the command of the package manager the reader has selected. Without a clipboard the button stays hidden. */
import { activate, type Clipboard, type CopyButton, type CopyEnv } from "../terminal/client.ts";

/** Selector for the button (`COPY_ATTRIBUTE` in `index.ts`). */
export const BUTTON_SELECTOR = "[data-cta-copy]";

/** Selector for the panel the checked radio shows. */
const COMMAND_SELECTOR = ".install-tabs-tab:has(.install-tabs-radio:checked) + .install-tabs-panel";

/** The part of the install tabs the island reads when the button is clicked. */
export interface Tabs {
  querySelector(selector: string): { readonly textContent: string | null } | null;
}

/**
 * Wires one button. The frame handed to the copy control yields the command shown right now: the panel of
 * the checked radio, or the single panel when there are no tabs.
 */
export function wire(button: CopyButton, tabs: Tabs, env: CopyEnv): void {
  const shown = () => tabs.querySelector(COMMAND_SELECTOR) ?? tabs.querySelector(".install-tabs-panel");
  activate(button, env, {
    querySelectorAll: () => {
      const node = shown();
      return node === null ? [] : [node];
    },
  });
}

/** The part of the document the island uses. */
export interface CtaDocument {
  querySelectorAll(selector: string): Iterable<CopyButton & { readonly parentElement: Tabs | null }>;
}

/** Wires every cta-band copy button on the page. */
export function activateAll(doc: CtaDocument, env: CopyEnv): void {
  for (const button of doc.querySelectorAll(BUTTON_SELECTOR)) {
    if (button.parentElement !== null) wire(button, button.parentElement, env);
  }
}

const globals = globalThis as unknown as {
  document?: CtaDocument;
  navigator?: { clipboard?: Clipboard };
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) {
  activateAll(globals.document, {
    clipboard: globals.navigator?.clipboard,
    schedule: (callback, ms) => globals.setTimeout(callback, ms),
    cancel: (handle) => globals.clearTimeout(handle),
  });
}
