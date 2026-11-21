/* Terminal copy button: copies the commands of a terminal block, never its output. The button stays hidden unless the browser has a clipboard to write to, and the commands are read from the page when it is clicked, so a value the variables form changed is the one copied. */
import { createResultFlash, writeClipboard, type Clipboard, type Timers } from "../../chrome/clipboard/result.ts";

export type { Clipboard };

/** Selector for the button the frame renders (`data-terminal-copy` in `index.ts`). */
export const BUTTON_SELECTOR = "[data-terminal-copy]";

/** Selector for the command text inside a session, one line each. */
export const COMMAND_SELECTOR = ".terminal-command .terminal-text";

/** The parts of the button the island reads and writes. */
export interface CopyButton {
  hidden: boolean;
  readonly disabled?: boolean;
  readonly nextElementSibling: { textContent: string | null } | null;
  dataset: { commands?: string; copied?: string; copyFailed?: string };
  addEventListener(type: "click", listener: () => void): void;
}

/** The part of the frame the island reads at click time. */
export interface TerminalFrame {
  querySelectorAll(selector: string): Iterable<{ readonly textContent: string | null }>;
}

/** Everything the island reads from the world; tests pass fakes, the browser supplies its own. */
export interface CopyEnv extends Timers {
  clipboard?: Clipboard | undefined;
}

/** How long the button shows the result before it goes back to its label. */
export const RESET_MS = 2000;

/** The commands the session currently shows, one per line: what the copy button takes. */
export function commandsOf(frame: TerminalFrame): string {
  return [...frame.querySelectorAll(COMMAND_SELECTOR)]
    .map((line) => line.textContent ?? "")
    .join("\n");
}

/**
 * Reveals the button and wires its click, unless there is no clipboard for it to use. With a frame, the
 * button takes the commands the page currently shows, so a changed value is copied as it is displayed.
 */
export function activate(button: CopyButton, env: CopyEnv, frame?: TerminalFrame): void {
  const status = button.nextElementSibling;
  if (env.clipboard === undefined || status === null) return;
  const flash = createResultFlash<typeof status>({
    timers: env,
    resetMs: RESET_MS,
    apply(target, ok) {
      target.textContent = (ok ? button.dataset.copied : button.dataset.copyFailed) ?? "";
    },
    reset(target) {
      // The variables form owns the status while its commands are invalid.
      if (!button.disabled) target.textContent = "";
    },
  });
  let clicks = 0;
  button.hidden = false;
  button.addEventListener("click", () => {
    const click = ++clicks;
    flash.restore(status);
    const text = frame === undefined ? button.dataset.commands ?? "" : commandsOf(frame);
    void writeClipboard(env.clipboard, text).then((ok) => {
      if (click === clicks && !button.disabled) flash.show(status, ok);
    });
  });
}

/** The part of the document the island uses: each button inside its terminal frame. */
export interface CopyDocument {
  querySelectorAll(
    selector: string,
  ): Iterable<CopyButton & { readonly parentElement: { readonly parentElement: TerminalFrame | null } | null }>;
}

/** Wires every terminal copy button on the page to the session it belongs to. */
export function activateAll(doc: CopyDocument, env: CopyEnv): void {
  for (const button of doc.querySelectorAll(BUTTON_SELECTOR)) {
    activate(button, env, button.parentElement?.parentElement ?? undefined);
  }
}

/** The browser environment: the page's clipboard and its timer. */
const globals = globalThis as unknown as {
  document?: CopyDocument;
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
