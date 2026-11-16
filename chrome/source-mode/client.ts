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
 *
 * Each label is a copy button (`file:line`), plus, when the site names a GitHub or GitLab repository, a link
 * to those lines there (it opens a new window and its accessible name says so), plus, when the site gives an
 * editor template and the reader has set the folder of their checkout, a link that opens the file in their
 * editor. `?source=<file>:<line>` turns the mode on and scrolls to and focuses the block holding that line.
 */

import type { RepositoryConfig } from "@velella/mizzen/contracts";
import { lineUrlOf } from "../../src/repository.ts";
import { locationOf, parseSpan, type Span } from "../../src/source-span.ts";
import { acceptEditorTemplate, editorUrl, readFolder, saveFolder } from "./editor.ts";
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
  scrollIntoView?(options?: { block?: string }): void;
}

/** The label element the island creates. */
export interface SourceLabel {
  textContent: string | null;
  setAttribute(name: string, value: string): void;
  appendChild?(child: SourceLabel): unknown;
  addEventListener?(type: "click", listener: () => void): void;
  focus?(): void;
  hidden?: boolean;
}

/** What the island needs to build the copy button and the links inside a label. */
export interface SourceActions {
  /** The site's repository, when its host has a line URL shape. */
  readonly repository?: RepositoryConfig | undefined;
  /** The validated editor URL template, when the site names one. */
  readonly editor?: string | undefined;
  /** Where the reader keeps the folder of their checkout. */
  readonly storage: SourceModeStorage | undefined;
  /** Asks the reader for text (`window.prompt`); null when cancelled. */
  prompt?(message: string, initial: string): string | null;
  /** Message patterns with `{location}`, `{file}` and `{line}` placeholders, by `data-msg-*` suffix. */
  readonly messages: (name: string) => string;
  createElement(tag: string): SourceLabel;
  /** Writes text to the clipboard; resolves false when it cannot. */
  copy(text: string): Promise<boolean>;
  announce(message: string): void;
}

/** A stamped block: where to scroll and what to focus. */
export interface Stamped {
  readonly block: SourceBlock;
  readonly span: Span;
  readonly focus: SourceLabel;
  /** Shows or hides the editor link as the folder is set. */
  refresh(): void;
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
  /** Present in a browser: builds the copy button and links inside each label. */
  readonly actions?: SourceActions;
  /** The page's query string, for `?source=`. */
  readonly search?: string;
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

/** Fills `{name}` placeholders in a message pattern. */
function fill(pattern: string, values: Readonly<Record<string, string | number>>): string {
  return pattern.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
}

/** Builds the copy button and links into `label` for one span; returns the focus target and a refresher. */
function stampActions(label: SourceLabel, span: Span, actions: SourceActions): Pick<Stamped, "focus" | "refresh"> {
  const location = locationOf(span);
  const add = (tag: string): SourceLabel => {
    const element = actions.createElement(tag);
    label.appendChild?.(element);
    return element;
  };

  const copy = add("button");
  copy.setAttribute("type", "button");
  copy.setAttribute("class", "source-label-copy");
  copy.setAttribute("aria-label", fill(actions.messages("copy-label"), { location }));
  copy.textContent = location;
  copy.addEventListener?.("click", () => {
    void actions.copy(location).then((ok) =>
      actions.announce(fill(actions.messages(ok ? "copied" : "copy-failed"), { location })),
    );
  });

  if (actions.repository !== undefined) {
    const href = lineUrlOf(actions.repository, span.file, span.line);
    if (href !== undefined) {
      const link = add("a");
      link.setAttribute("class", "source-label-link");
      link.setAttribute("href", href);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      // The name says the link opens a new window.
      link.setAttribute("aria-label", fill(actions.messages("repo-label"), { location }));
      link.textContent = actions.messages("repo-link");
    }
  }

  let refresh = (): void => {};
  const template = acceptEditorTemplate(actions.editor);
  if (template !== undefined) {
    const link = add("a");
    link.setAttribute("class", "source-label-editor");
    link.setAttribute("aria-label", fill(actions.messages("editor-label"), { location }));
    link.textContent = actions.messages("editor-link");
    link.hidden = true;
    refresh = () => {
      const href = editorUrl(template, readFolder(actions.storage), span.file, span.line, span.column);
      if (href === undefined) {
        link.hidden = true;
        return;
      }
      link.setAttribute("href", href);
      link.hidden = false;
    };
    refresh();
  }
  return { focus: copy, refresh };
}

/** Appends one `file:line` label to each labelable block; returns what it stamped, in document order. */
export function stamp(env: Pick<SourceEnv, "blocks" | "createLabel" | "actions">): Stamped[] {
  const out: Stamped[] = [];
  for (const block of labelable(env.blocks)) {
    const span = parseSpan(block.getAttribute("data-src"));
    if (span === undefined) continue;
    const label = env.createLabel();
    label.setAttribute("class", "source-label");
    label.setAttribute("data-source-label", "");
    // File paths read left to right in every page direction.
    label.setAttribute("dir", "ltr");
    if (env.actions === undefined) {
      label.textContent = locationOf(span);
      label.setAttribute("tabindex", "-1");
      out.push({ block, span, focus: label, refresh() {} });
    } else {
      out.push({ block, span, ...stampActions(label, span, env.actions) });
    }
    block.appendChild(label);
  }
  return out;
}

/** Appends one `file:line` label to each labelable block; returns how many it added. */
export function stampLabels(env: Pick<SourceEnv, "blocks" | "createLabel" | "actions">): number {
  return stamp(env).length;
}

/** The result of looking up a `?source=` value. */
export type Jump =
  | { readonly kind: "block"; readonly target: Stamped; readonly exact: boolean }
  | { readonly kind: "other-file"; readonly file: string; readonly line: number }
  | { readonly kind: "none"; readonly file: string; readonly line: number }
  | { readonly kind: "ignore" };

/**
 * Finds the block for `?source=<file>:<line>`: the one whose span holds the line, else the nearest block
 * before it. A file that none of the page's blocks come from, or a line above every block, is reported, never dropped.
 */
export function findJump(stamped: readonly Stamped[], value: string | null): Jump {
  if (value === null) return { kind: "ignore" };
  const wanted = parseSpan(value);
  if (wanted === undefined) return { kind: "ignore" };
  const { file, line } = wanted;
  const same = stamped.filter((entry) => entry.span.file === file);
  if (same.length === 0) return { kind: "other-file", file, line };
  const exact = same.find((entry) => entry.span.line <= line && line <= entry.span.endLine);
  if (exact !== undefined) return { kind: "block", target: exact, exact: true };
  let before: Stamped | undefined;
  for (const entry of same) {
    if (entry.span.line <= line && (before === undefined || entry.span.line >= before.span.line)) before = entry;
  }
  return before === undefined ? { kind: "none", file, line } : { kind: "block", target: before, exact: false };
}

/** Reveals the switch, applies the saved choice, and wires the button and the shortcut. */
export function activate(root: SwitchRoot, env: SourceEnv): void {
  const button = root.querySelector(".source-mode-button");
  const status = root.querySelector(".source-mode-status");
  if (button === null) return;

  const stamped = stamp(env);
  let on = readSourceMode(env.storage);
  const note = (message: string): void => {
    if (status !== null) status.textContent = message;
  };
  const message = (name: string, values: Readonly<Record<string, string | number>>): string =>
    fill(env.actions?.messages(name) ?? "", values);

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

  // The folder button appears with an editor template: the reader sets the checkout folder once.
  const folderButton = root.querySelector(".source-folder-button");
  if (folderButton !== null && env.actions !== undefined) {
    const actions = env.actions;
    folderButton.addEventListener?.("click", () => {
      const answer = actions.prompt?.(actions.messages("folder-prompt"), readFolder(actions.storage) ?? "");
      if (answer === null || answer === undefined || answer.trim() === "") return;
      if (!saveFolder(actions.storage, answer)) return;
      for (const entry of stamped) entry.refresh();
      note(message("folder-saved", {}));
    });
  }

  root.hidden = false;
  show(false);

  const jump = findJump(stamped, new URLSearchParams(env.search ?? "").get("source"));
  if (jump.kind === "block") {
    on = true;
    show(false);
    jump.target.block.scrollIntoView?.({ block: "center" });
    jump.target.focus.focus?.();
    if (!jump.exact) {
      const wanted = parseSpan(new URLSearchParams(env.search ?? "").get("source"));
      note(message("jump-nearest", { line: wanted?.line ?? "", file: wanted?.file ?? "" }));
    }
  } else if (jump.kind === "other-file") {
    note(message("jump-other", { file: jump.file, line: jump.line }));
  } else if (jump.kind === "none") {
    note(message("jump-none", { file: jump.file, line: jump.line }));
  }
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
declare const location: { search: string };
declare const navigator: { clipboard?: { writeText(text: string): Promise<void> } };
declare const window: { prompt(message: string, initial: string): string | null };

/** The island's actions from the switch root's data attributes. */
function actionsOf(root: SwitchRoot, announce: (message: string) => void): SourceActions {
  let repository: SourceActions["repository"];
  try {
    const raw = root.getAttribute("data-repository");
    if (raw !== null) repository = JSON.parse(raw) as SourceActions["repository"];
  } catch {
    repository = undefined;
  }
  return {
    repository,
    editor: root.getAttribute("data-editor") ?? undefined,
    storage: shortcutStorage(),
    messages: (name) => root.getAttribute(`data-msg-${name}`) ?? "",
    createElement: (tag) => document.createElement(tag),
    copy: async (text) => {
      try {
        await navigator.clipboard?.writeText(text);
        return navigator.clipboard !== undefined;
      } catch {
        return false;
      }
    },
    announce,
    prompt: (message, initial) => window.prompt(message, initial),
  };
}

if (typeof document !== "undefined") {
  const root = document.querySelector("[data-source-mode]") as SwitchRoot | null;
  if (root !== null) {
    const status = root.querySelector(".source-mode-status");
    activate(root, {
      root: document.documentElement,
      blocks: document.querySelectorAll("[data-src]"),
      storage: shortcutStorage(),
      createLabel: () => document.createElement("span"),
      actions: actionsOf(root, (message) => {
        if (status !== null) status.textContent = message;
      }),
      search: location.search,
      addKeydown: (listener) => document.addEventListener("keydown", listener),
    });
  }
}
