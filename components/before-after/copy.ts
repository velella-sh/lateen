/* Copy buttons for the guide components: the button holds the text to copy in `data-text`, starts
   `hidden`, and is revealed only when the browser has a clipboard to write to. */

import { bootOnce } from "../../src/boot.ts";

export const RESET_MS = 2000;

export interface CopyButton {
  hidden: boolean;
  textContent: string | null;
  dataset: { text?: string; copied?: string; copyFailed?: string };
  addEventListener(type: "click", listener: () => void): void;
}

export interface CopyEnv {
  clipboard?: { writeText(text: string): Promise<void> } | undefined;
  schedule(callback: () => void, ms: number): unknown;
}

/** Writes the button's text to the clipboard and shows the result on the button for a moment. */
export function copy(button: CopyButton, env: CopyEnv): Promise<void> {
  const clipboard = env.clipboard;
  if (clipboard === undefined) return Promise.resolve();
  const label = button.textContent ?? "";
  const show = (message: string | undefined): void => {
    if (message === undefined) return;
    button.textContent = message;
    env.schedule(() => {
      button.textContent = label;
    }, RESET_MS);
  };
  return clipboard.writeText(button.dataset.text ?? "").then(
    () => show(button.dataset.copied),
    () => show(button.dataset.copyFailed),
  );
}

/** Reveals every button and wires its click, when there is a clipboard; otherwise they stay hidden. */
export function wire(buttons: Iterable<CopyButton>, env: CopyEnv): void {
  if (env.clipboard === undefined) return;
  for (const button of buttons) {
    button.hidden = false;
    button.addEventListener("click", () => void copy(button, env));
  }
}

interface Globals {
  document?: { querySelectorAll(selector: string): Iterable<CopyButton> };
  navigator?: { clipboard?: CopyEnv["clipboard"] };
  setTimeout(callback: () => void, ms: number): unknown;
}

/** Wires the buttons matching `selector` in the browser; does nothing in a runtime without a document. */
export function wireDocument(selector: string): void {
  const g = globalThis as unknown as Globals;
  const doc = g.document;
  if (doc === undefined || !bootOnce(`components/copy-buttons:${selector}`, doc)) return;
  wire(doc.querySelectorAll(selector), {
    clipboard: g.navigator?.clipboard,
    schedule: (callback, ms) => g.setTimeout(callback, ms),
  });
}
