import { THEME_KEY, type ThemeChoice } from "./key.ts";

const DEFAULT_THEME: ThemeChoice = "dark";

/** The parts of `Storage` the switch uses, so tests can pass plain objects. */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** An element of the switch the script writes to: the button or the status region. */
export interface ThemeElement {
  textContent: string | null;
  setAttribute(name: string, value: string): void;
}

/** A click event; the switch needs nothing from it. */
export interface ThemeClick {
  target?: unknown;
}

/** The switch root as the script touches it. */
export interface ThemeToggleRoot {
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  querySelector(selector: string): ThemeElement | null;
  addEventListener(type: string, listener: (event: ThemeClick) => void): void;
}

/** The one element `data-theme` is set on (`document.documentElement`). */
export interface ThemeRoot {
  setAttribute(name: string, value: string): void;
}

/** A storage event from another tab; the switch reads only the key and its new value. */
export interface ThemeStorageEvent {
  readonly key?: string | null;
  readonly newValue?: string | null;
}

/** The window events the switch listens to for other tabs. */
export interface ThemeEvents {
  addEventListener?(type: "storage", listener: (event: ThemeStorageEvent) => void): void;
  removeEventListener?(type: "storage", listener: (event: ThemeStorageEvent) => void): void;
}

/** The environment the switch lives in; `live()` builds the browser's. */
export interface ThemeEnv {
  storage: ThemeStorage;
  root: ThemeRoot;
  events?: ThemeEvents;
}

// The theme's tsconfig has no DOM lib; these are the browser globals the switch needs, no more.
declare const document: { querySelector(selector: string): unknown; documentElement: ThemeRoot };
declare const localStorage: ThemeStorage;

const WORDS: Record<ThemeChoice, string> = { light: "Light", dark: "Dark" };

/** The saved choice, or the default when storage has no supported value or is unavailable. */
export function read(storage: ThemeStorage): ThemeChoice {
  try {
    const saved = storage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage is unavailable */
  }
  return DEFAULT_THEME;
}

/** Remember the choice. Storage may throw (private mode); the choice still applies to this page view. */
export function save(storage: ThemeStorage, choice: ThemeChoice): void {
  try {
    storage.setItem(THEME_KEY, choice);
  } catch {
    /* storage is unavailable: apply the choice without remembering it */
  }
}

/** Put the theme for `choice` on the page. */
export function apply(env: ThemeEnv, choice: ThemeChoice): void {
  env.root.setAttribute("data-theme", choice);
}

/** The choice a press moves to from `choice`. */
export function next(choice: ThemeChoice): ThemeChoice {
  return choice === "light" ? "dark" : "light";
}

/** Reveal the switch, show the icon of `choice`, and name the choice and the next one on the button. */
export function sync(toggle: ThemeToggleRoot, choice: ThemeChoice): void {
  toggle.hidden = false;
  toggle.setAttribute("data-choice", choice);
  const label = `Color theme: ${WORDS[choice]}. Switch to ${WORDS[next(choice)].toLowerCase()}.`;
  toggle.querySelector(".theme-toggle-button")?.setAttribute("aria-label", label);
}

/** Announce the new choice on the switch's status region. */
export function announce(toggle: ThemeToggleRoot, choice: ThemeChoice): void {
  const status = toggle.querySelector(".theme-toggle-status");
  if (status) status.textContent = `${WORDS[choice]} theme.`;
}

/** One change of the switch: remember the choice, apply it, reflect it, and announce it. */
export function choose(env: ThemeEnv, toggle: ThemeToggleRoot, choice: ThemeChoice): void {
  save(env.storage, choice);
  apply(env, choice);
  sync(toggle, choice);
  announce(toggle, choice);
}

/**
 * Reveal the switch, show and apply the saved choice, move to the next choice on every press, and follow
 * other tabs; returns a cleanup that stops listening for storage changes.
 */
export function activate(toggle: ThemeToggleRoot, env: ThemeEnv): () => void {
  let current = read(env.storage);
  sync(toggle, current);
  apply(env, current);

  /** Take a choice made elsewhere (another tab), without saving it back. */
  const follow = (choice: ThemeChoice) => {
    if (choice === current) return;
    current = choice;
    apply(env, choice);
    sync(toggle, choice);
    announce(toggle, choice);
  };

  const onStorage = (event: ThemeStorageEvent) => {
    if (event.key != null && event.key !== THEME_KEY) return;
    const saved = event.newValue;
    if (saved === "light" || saved === "dark") follow(saved);
    else if (saved == null || saved === "system") follow(DEFAULT_THEME);
  };

  env.events?.addEventListener?.("storage", onStorage);

  toggle.addEventListener("click", () => {
    current = next(current);
    choose(env, toggle, current);
  });

  return () => {
    env.events?.removeEventListener?.("storage", onStorage);
  };
}

/** The browser environment: page storage, `<html>`, and other tabs' storage events. */
function live(): ThemeEnv {
  return {
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
    root: document.documentElement,
    events: globalThis as unknown as ThemeEvents,
  };
}

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (typeof document !== "undefined") {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) activate(toggle as ThemeToggleRoot, live());
}
