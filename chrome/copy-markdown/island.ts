/*
 * The page copy island, shared by `chrome/copy-markdown` and `chrome/page-agent-menu`: fetch the
 * page's Markdown twin, write it to the clipboard, and announce loading, success, and failure on the
 * control's status region. Both page actions run this one implementation, so the same denial or
 * failed request gives the same visible, announced answer wherever the reader asked.
 *
 * The module is pure; each unit's `client.ts` passes the browser's button, status region, clipboard,
 * and `fetch`.
 */

import { writeClipboard, type Clipboard } from "../clipboard/result.ts";
import { fetchText, type Fetcher } from "../../src/fetch.ts";

/** The part of `navigator.clipboard` the island uses; the shared clipboard result path defines it. */
export type { Clipboard };

/** The parts of the copy button the island reads and writes. */
export interface CopyButton {
  hidden: boolean;
  dataset: { markdown?: string; copied?: string; copyFailed?: string };
  addEventListener(type: "click", listener: () => void, options?: { signal?: AbortSignal | undefined }): void;
}

/** The status region the island announces the result on. */
export interface CopyStatus {
  textContent: string | null;
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
}

/** Everything the island reads from the world; tests pass fakes, the browser supplies its own. */
export interface CopyEnv {
  clipboard?: Clipboard | undefined;
  fetchText?: ((url: string) => Promise<string>) | undefined;
  status: CopyStatus;
}

export interface ActivateEnv extends CopyEnv {
  /** Aborting detaches the click listener. Absent, the listener lives for the page. */
  signal?: AbortSignal | undefined;
}

/** Buttons with a copy already in flight; a second press waits for the first answer. */
const busy = new WeakSet<CopyButton>();

/**
 * Fetches the button's Markdown twin and writes it to the clipboard. The status region is cleared
 * and marked `aria-busy` while the request runs, then carries the button's localized success or
 * failure text. A button with no address, or an environment without the clipboard or `fetch`, copies
 * nothing and announces nothing, so the plain Markdown link stays the fallback.
 */
export function copy(button: CopyButton, env: CopyEnv): Promise<void> {
  const clipboard = env.clipboard;
  const fetchText = env.fetchText;
  const url = button.dataset.markdown;
  if (clipboard === undefined || fetchText === undefined || url === undefined || url === "") return Promise.resolve();
  if (busy.has(button)) return Promise.resolve();

  busy.add(button);
  env.status.textContent = "";
  env.status.setAttribute?.("aria-busy", "true");
  const finish = (message: string | undefined): void => {
    busy.delete(button);
    env.status.removeAttribute?.("aria-busy");
    env.status.textContent = message ?? "";
  };

  return fetchText(url)
    .then((markdown) => writeClipboard(clipboard, markdown))
    .then(
      (ok) => finish(ok ? button.dataset.copied : button.dataset.copyFailed),
      () => finish(button.dataset.copyFailed),
    );
}

/** Reveals the copy button when the browser can fetch and write to the clipboard. */
export function activate(button: CopyButton, env: ActivateEnv): void {
  if (env.clipboard === undefined || env.fetchText === undefined) return;
  if (button.dataset.markdown === undefined || button.dataset.markdown === "") return;
  const signal = env.signal;
  button.hidden = false;
  button.addEventListener("click", () => {
    void copy(button, env);
  }, { signal });
}

/** The browser environment: the page's clipboard, `fetch`, and an element query. */
export const globals = globalThis as unknown as {
  document?: {
    querySelector(selector: string): unknown;
  };
  navigator?: { clipboard?: Clipboard };
  fetch?: Fetcher;
};

/** `fetch` as the island wants it: resolves to the body text, and rejects on an HTTP error. */
export function browserFetch(url: string): Promise<string> {
  return fetchText(globals.fetch, url);
}
