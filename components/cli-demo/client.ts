/* cli-demo island: reveals the copy buttons the page can use and, with `play`, the playback controls. Without it the session is plain selectable text and the bar stays hidden. */
import { createPlayer, type PlayEnv, type PlayLine, type PlayState } from "./play.ts";

export const ROOT_SELECTOR = "[data-cli-demo]";
export const BAR_SELECTOR = ".cli-demo-bar";
export const LINE_SELECTOR = ".cli-demo-line";
export const STATUS_SELECTOR = "[data-cli-demo-status]";
const SELECTORS = {
  commands: "[data-cli-demo-copy-commands]",
  all: "[data-cli-demo-copy-all]",
  play: "[data-cli-demo-play]",
  pause: "[data-cli-demo-pause]",
  showAll: "[data-cli-demo-show-all]",
} as const;

/** How long a button shows the result of a copy before it goes back to its label. */
export const RESET_MS = 2000;

export interface Button {
  hidden: boolean;
  textContent: string | null;
  dataset: { text?: string };
  addEventListener(type: "click", listener: () => void): void;
}

export interface Line extends PlayLine {
  readonly textContent?: string | null;
}

export interface Root {
  dataset: { copied?: string; copyFailed?: string; play?: string };
  querySelector(selector: string): (Button & { textContent: string | null }) | null;
  querySelectorAll(selector: string): Iterable<Line>;
}

export interface Clipboard {
  writeText(text: string): Promise<void>;
}

export interface Env extends PlayEnv {
  clipboard?: Clipboard | undefined;
  /** Calls `listener` when the reader's reduced-motion preference changes while the page is open. */
  watchReducedMotion?: ((listener: (reduced: boolean) => void) => void) | undefined;
}

/** Writes `text` to the clipboard and tells the reader the result on the button and in the status line. */
export function copy(button: Button, text: string, root: Root, env: Env): Promise<void> {
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
  return clipboard.writeText(text).then(
    () => say(root.dataset.copied ?? label),
    () => say(root.dataset.copyFailed ?? label),
  );
}

/** Wires one session: the two copy buttons when a clipboard exists, the playback controls when `play` is set and motion is allowed. */
export function activate(root: Root, env: Env): void {
  const bar = root.querySelector(BAR_SELECTOR);
  let revealed = false;
  let copiesRevealed = false;
  const reveal = (button: Button | null): void => {
    if (button === null) return;
    button.hidden = false;
    revealed = true;
  };

  if (env.clipboard !== undefined) {
    for (const key of ["commands", "all"] as const) {
      const button = root.querySelector(SELECTORS[key]);
      if (button === null) continue;
      copiesRevealed = true;
      reveal(button);
      button.addEventListener("click", () => void copy(button, button.dataset.text ?? "", root, env));
    }
  }

  if (root.dataset.play !== undefined && !env.reducedMotion) {
    const play = root.querySelector(SELECTORS.play);
    const pause = root.querySelector(SELECTORS.pause);
    const showAll = root.querySelector(SELECTORS.showAll);
    if (play !== null && pause !== null && showAll !== null) {
      const sync = (state: PlayState): void => {
        play.hidden = state === "playing";
        pause.hidden = state !== "playing";
        showAll.hidden = state === "idle";
      };
      const player = createPlayer([...root.querySelectorAll(LINE_SELECTOR)], env, sync);
      play.addEventListener("click", () => player.play());
      pause.addEventListener("click", () => player.pause());
      showAll.addEventListener("click", () => player.showAll());
      sync("idle");
      revealed = true;
      env.watchReducedMotion?.((reduced) => {
        if (!reduced) {
          sync("idle");
          if (bar !== null) bar.hidden = false;
          return;
        }
        player.showAll();
        for (const button of [play, pause, showAll]) button.hidden = true;
        if (!copiesRevealed && bar !== null) bar.hidden = true;
      });
    }
  }

  if (revealed && bar !== null) bar.hidden = false;
}

export interface Doc {
  querySelectorAll(selector: string): Iterable<Root>;
}

/** Wires every session on the page. */
export function activateAll(doc: Doc, env: Env): void {
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) activate(root, env);
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

interface MediaQuery {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
}

const globals = globalThis as unknown as {
  document?: Doc;
  navigator?: { clipboard?: Clipboard };
  matchMedia?: (query: string) => MediaQuery;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) {
  const motion = globals.matchMedia?.(REDUCED_MOTION);
  activateAll(globals.document, {
    clipboard: globals.navigator?.clipboard,
    schedule: (callback, ms) => globals.setTimeout(callback, ms),
    cancel: (handle) => globals.clearTimeout(handle),
    reducedMotion: motion?.matches === true,
    watchReducedMotion:
      motion === undefined
        ? undefined
        : (listener) => motion.addEventListener("change", () => listener(motion.matches)),
  });
}
