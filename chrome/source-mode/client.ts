/*
 * Source mode: a switch that shows `file:line` beside every top-level block. The mode always starts off
 * and is never remembered; it is set as a class on the root element while on, and each change is announced on the
 * switch's status region. The command palette clicks the same button.
 *
 * Labels are stamped once, as the last child of each block, so they follow the block's text in reading
 * order. The stylesheet reveals them beneath the block while the mode is on. Containers that only
 * allow list items or rows get no label.
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
import { parseJson, isRecord } from "../../src/guards.ts";
import {
  SOURCE_MODE_CLASS,
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
  innerHTML?: string;
  setAttribute(name: string, value: string): void;
  removeAttribute?(name: string): void;
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
  /** The visible kind word for a source file (data or template), when the page knows it. */
  readonly kindOf?: (file: string) => string | undefined;
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
  /** Ready SVG markup for the two link actions, so an icon-only action shows the same glyph everywhere. */
  readonly iconOpen?: string | undefined;
  readonly iconEditor?: string | undefined;
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

/** The button, the status region, or the active bar. */
export interface SwitchPart {
  textContent: string | null;
  hidden?: boolean;
  setAttribute(name: string, value: string): void;
  addEventListener?(type: "click", listener: () => void): void;
}

/** The root element, whose class list carries the mode. */
export interface ModeRoot {
  readonly classList: { toggle(name: string, force: boolean): unknown; contains(name: string): boolean };
}

/** Everything the island reads from the world; tests pass fakes. */
export interface SourceEnv {
  readonly root: ModeRoot;
  readonly blocks: Iterable<SourceBlock>;
  readonly storage: SourceModeStorage | undefined;
  createLabel(tag?: string): SourceLabel;
  /** Present in a browser: builds the copy button and links inside each label. */
  readonly actions?: SourceActions;
  /** The page's query string, for `?source=`. */
  readonly search?: string;
  /**
   * Opens the disclosure that holds the switch, when it has one. The doc layout keeps the switch in
   * "Page tools", which starts closed; turning the mode on from the command palette would otherwise
   * leave the active bar and Exit invisible. A layout with the switch in the flow has no disclosure.
   */
  readonly revealSwitch?: (() => void) | undefined;
}

/** Elements that cannot hold a label child without breaking their content model. */
const NO_LABEL = new Set(["UL", "OL", "DL", "TABLE", "THEAD", "TBODY", "TR"]);

/** Interactive hosts that already take input; a label with buttons/links inside them nests controls. */
const NO_LABEL_HOST = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY", "LABEL"]);

/** Blocks with a valid span and no sourced ancestor, in document order, that can hold a label. */
export function labelable(blocks: Iterable<SourceBlock>): SourceBlock[] {
  const out: SourceBlock[] = [];
  const seen = new Set<SourceBlock>();
  for (const block of blocks) {
    const span = parseSpan(block.getAttribute("data-src"));
    if (span === undefined || seen.has(block)) continue;
    if (block.parentElement?.closest?.("[data-src]") != null) continue;
    if (block.tagName !== undefined) {
      const tag = block.tagName.toUpperCase();
      if (NO_LABEL.has(tag) || NO_LABEL_HOST.has(tag)) continue;
    }
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

  const kind = actions.kindOf?.(span.file);
  if (kind !== undefined && kind !== "") {
    const word = add("span");
    word.setAttribute("class", "source-label-kind");
    word.textContent = kind;
  }

  const copy = add("button");
  copy.setAttribute("type", "button");
  copy.setAttribute("class", "source-label-copy");
  copy.setAttribute("aria-label", fill(actions.messages("copy-label"), { location }));
  // The path is its own left-to-right island, so the label keeps the page direction for layout.
  const path = actions.createElement("bdi");
  path.setAttribute("dir", "ltr");
  path.textContent = location;
  copy.appendChild?.(path);
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
      // The name says the link opens a new window, since the icon shows no word.
      link.setAttribute("aria-label", fill(actions.messages("repo-label"), { location }));
      if (link.innerHTML !== undefined && actions.iconOpen !== undefined) link.innerHTML = actions.iconOpen;
    }
  }

  let refresh = (): void => {};
  const template = acceptEditorTemplate(actions.editor);
  if (template !== undefined) {
    const link = add("a");
    link.setAttribute("class", "source-label-editor");
    link.setAttribute("aria-label", fill(actions.messages("editor-label"), { location }));
    if (link.innerHTML !== undefined && actions.iconEditor !== undefined) link.innerHTML = actions.iconEditor;
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
    const id = block.getAttribute("data-block");
    if (id) {
      const identity = env.createLabel("bdi");
      identity.setAttribute("dir", "ltr");
      identity.setAttribute("data-source-block-id", id);
      identity.textContent = id;
      label.appendChild?.(identity);
    }
    if (env.actions === undefined) {
      // File paths read left to right in every page direction without flipping the label's layout.
      const path = env.createLabel("bdi");
      path.setAttribute("dir", "ltr");
      path.textContent = locationOf(span);
      label.appendChild?.(path);
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

/** Reveals the switch (off) and wires the toggle and the exit control. */
export function activate(root: SwitchRoot, env: SourceEnv): void {
  const button = root.querySelector(".source-mode-button");
  const status = root.querySelector(".source-mode-status");
  if (button === null) return;

  const stamped = stamp(env);
  const active = root.querySelector(".source-mode-active");
  const count = root.querySelector(".source-mode-count");
  const exit = root.querySelector(".source-exit-button");
  // Every page view starts off; the mode is never restored, so nothing opens until the reader asks.
  let on = false;
  const note = (message: string): void => {
    if (status !== null) status.textContent = message;
  };
  const message = (name: string, values: Readonly<Record<string, string | number>>): string =>
    fill(env.actions?.messages(name) ?? "", values);
  const countText = (): string =>
    message(stamped.length === 0 ? "mode-empty" : "mode-count", { n: stamped.length });

  // The count is the one line that says the mode is on, and opening the panel that holds the switch
  // is what makes the active state and Exit visible on the doc layout.
  const show = (announce: boolean): void => {
    env.root.classList.toggle(SOURCE_MODE_CLASS, on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    if (active !== null) active.hidden = !on;
    if (count !== null) count.textContent = on ? countText() : "";
    if (on) env.revealSwitch?.();
    if (announce && status !== null) {
      status.textContent = (on ? root.getAttribute("data-on-message") : root.getAttribute("data-off-message")) ?? "";
    }
  };

  // Both controls are real buttons, so Enter and Space drive them with no key handler. Turning the
  // mode off hides the exit control; a browser moves focus off a hidden element on its own.
  const set = (value: boolean): void => {
    on = value;
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
  button.addEventListener?.("click", () => set(!on));
  exit?.addEventListener?.("click", () => set(false));
}

// The island runs in a browser; the theme's tsconfig has no DOM lib, so these are the globals it needs.
declare const document: {
  querySelector(selector: string): unknown;
  querySelectorAll(selector: string): Iterable<SourceBlock>;
  createElement(tag: string): SourceLabel;
  documentElement: ModeRoot;
};
declare const location: { search: string };
declare const navigator: { clipboard?: { writeText(text: string): Promise<void> } };
declare const window: { prompt(message: string, initial: string): string | null };
declare const localStorage: SourceModeStorage;

function liveStorage(): SourceModeStorage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

/** The island's actions from the switch root's data attributes. */
function actionsOf(root: SwitchRoot, storage: SourceModeStorage | undefined, announce: (message: string) => void): SourceActions {
  let repository: SourceActions["repository"];
  const raw = root.getAttribute("data-repository");
  const parsed = raw === null ? undefined : parseJson(raw);
  if (isRecord(parsed) && typeof parsed.url === "string") repository = parsed as unknown as SourceActions["repository"];
  const messages = (name: string): string => root.getAttribute(`data-msg-${name}`) ?? "";
  const template = root.getAttribute("data-record-template");
  const data = root.getAttribute("data-record-data");
  const icon = (name: string): string | undefined => root.getAttribute(`data-icon-${name}`) ?? undefined;
  return {
    repository,
    editor: root.getAttribute("data-editor") ?? undefined,
    storage,
    messages,
    iconOpen: icon("open"),
    iconEditor: icon("editor"),
    kindOf: (file) => (file === template ? messages("kind-template") : file === data ? messages("kind-data") : undefined),
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
    const storage = liveStorage();
    activate(root, {
      root: document.documentElement,
      blocks: document.querySelectorAll("[data-src]"),
      storage,
      revealSwitch: () => {
        // The nearest ancestor `<details>` is "Page tools" on a doc page and absent elsewhere; opening
        // it is what makes the switch, its count, and Exit visible once the mode is on.
        const host = (root as unknown as { closest?(selector: string): { open?: boolean } | null }).closest?.("details");
        if (host !== null && host !== undefined && host.open === false) host.open = true;
      },
      createLabel: (tag = "span") => document.createElement(tag),
      actions: actionsOf(root, storage, (message) => {
        if (status !== null) status.textContent = message;
      }),
      search: location.search,
    });
  }
}
