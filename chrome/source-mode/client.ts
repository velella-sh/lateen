/*
 * Source mode: a switch that shows `file:line` beside every top-level block. The choice is remembered
 * for the site in local storage and set as a class on the root element; each change is announced on the
 * switch's status region. The unmodified shortcut is `y` (with the single-key preference honoured) and
 * the command palette clicks the same button, so there is one code path.
 *
 * Labels are stamped once, as the last child of each block, so they follow the block's text in reading
 * order; the stylesheet draws them in the start margin (above the block on narrow screens) and only under
 * the root class, so turning the mode on shifts nothing. Blocks whose content model allows only list items
 * or rows (lists, tables) get no label yet.
 */

import { locationOf, parseSpan } from "../../src/source-span.ts";
import { isTypingTarget } from "../shortcuts/client.ts";
import { liveStorage as shortcutStorage, shortcutsEnabled } from "../shortcuts/preference.ts";
import {
  readSourceMode,
  saveSourceMode,
  SOURCE_MODE_CLASS,
  SOURCE_MODE_KEY_CHAR,
  type SourceModeStorage,
} from "./state.ts";

/** A block as the island reads it. */
export interface SourceBlock {
  readonly tagName?: string;
  readonly parentElement: { closest?(selector: string): unknown } | null;
  getAttribute(name: string): string | null;
  appendChild(child: SourceLabel): unknown;
}

/** The label element the island creates. */
export interface SourceLabel {
  textContent: string | null;
  setAttribute(name: string, value: string): void;
}

/** The switch root and the parts of it the island writes. */
export interface SwitchRoot {
  hidden: boolean;
  getAttribute(name: string): string | null;
  querySelector(selector: string): SwitchPart | null;
}

/** The button or the status region. */
export interface SwitchPart {
  textContent: string | null;
  setAttribute(name: string, value: string): void;
  addEventListener?(type: "click", listener: () => void): void;
}

/** The root element, whose class list carries the mode. */
export interface ModeRoot {
  readonly classList: { toggle(name: string, force: boolean): unknown; contains(name: string): boolean };
}

/** A key event as the shortcut reads it. */
export interface SourceKeyEvent {
  readonly key?: string | undefined;
  readonly metaKey?: boolean | undefined;
  readonly ctrlKey?: boolean | undefined;
  readonly altKey?: boolean | undefined;
  readonly target?: unknown;
  preventDefault(): void;
}

/** Everything the island reads from the world; tests pass fakes. */
export interface SourceEnv {
  readonly root: ModeRoot;
  readonly blocks: Iterable<SourceBlock>;
  readonly storage: SourceModeStorage | undefined;
  createLabel(): SourceLabel;
  addKeydown(listener: (event: SourceKeyEvent) => void): void;
}

/** Elements that cannot hold a label child without breaking their content model. */
const NO_LABEL = new Set(["UL", "OL", "DL", "TABLE", "THEAD", "TBODY", "TR"]);

/** Whether `event` is the source-mode shortcut: the bare key, with no command or alt modifier. */
export function isSourceShortcut(event: SourceKeyEvent): boolean {
  return (
    event.key?.toLowerCase() === SOURCE_MODE_KEY_CHAR &&
    event.metaKey !== true &&
    event.ctrlKey !== true &&
    event.altKey !== true
  );
}

/** Blocks with a valid span and no sourced ancestor, in document order, that can hold a label. */
export function labelable(blocks: Iterable<SourceBlock>): SourceBlock[] {
  const out: SourceBlock[] = [];
  const seen = new Set<SourceBlock>();
  for (const block of blocks) {
    const span = parseSpan(block.getAttribute("data-src"));
    if (span === undefined || seen.has(block)) continue;
    if (block.parentElement?.closest?.("[data-src]") != null) continue;
    if (block.tagName !== undefined && NO_LABEL.has(block.tagName.toUpperCase())) continue;
    seen.add(block);
    out.push(block);
  }
  return out;
}

/** Appends one `file:line` label to each labelable block; returns how many it added. */
export function stampLabels(env: Pick<SourceEnv, "blocks" | "createLabel">): number {
  let count = 0;
  for (const block of labelable(env.blocks)) {
    const span = parseSpan(block.getAttribute("data-src"));
    if (span === undefined) continue;
    const label = env.createLabel();
    label.textContent = locationOf(span);
    label.setAttribute("class", "source-label");
    label.setAttribute("data-source-label", "");
    // File paths read left to right in every page direction.
    label.setAttribute("dir", "ltr");
    block.appendChild(label);
    count += 1;
  }
  return count;
}

/** Reveals the switch, applies the saved choice, and wires the button and the shortcut. */
export function activate(root: SwitchRoot, env: SourceEnv): void {
  const button = root.querySelector(".source-mode-button");
  const status = root.querySelector(".source-mode-status");
  if (button === null) return;

  stampLabels(env);
  let on = readSourceMode(env.storage);

  const show = (announce: boolean): void => {
    env.root.classList.toggle(SOURCE_MODE_CLASS, on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    if (announce && status !== null) {
      status.textContent = (on ? root.getAttribute("data-on-message") : root.getAttribute("data-off-message")) ?? "";
    }
  };

  const toggle = (): void => {
    on = !on;
    saveSourceMode(env.storage, on);
    show(true);
  };

  root.hidden = false;
  show(false);
  button.addEventListener?.("click", toggle);
  env.addKeydown((event) => {
    if (!isSourceShortcut(event) || isTypingTarget(event.target)) return;
    if (!shortcutsEnabled(shortcutStorage())) return;
    event.preventDefault();
    toggle();
  });
}

// The island runs in a browser; the theme's tsconfig has no DOM lib, so these are the globals it needs.
declare const document: {
  querySelector(selector: string): unknown;
  querySelectorAll(selector: string): Iterable<SourceBlock>;
  createElement(tag: string): SourceLabel;
  documentElement: ModeRoot;
  addEventListener(type: "keydown", listener: (event: SourceKeyEvent) => void): void;
};

if (typeof document !== "undefined") {
  const root = document.querySelector("[data-source-mode]");
  if (root !== null) {
    activate(root as SwitchRoot, {
      root: document.documentElement,
      blocks: document.querySelectorAll("[data-src]"),
      storage: shortcutStorage(),
      createLabel: () => document.createElement("span"),
      addKeydown: (listener) => document.addEventListener("keydown", listener),
    });
  }
}
