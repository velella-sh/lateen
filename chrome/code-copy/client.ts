/* Code block copy and wrap controls: copies a block's code without diff markers or shell prompts,
 * confirms with a short text change and a live message, and wraps long lines on demand. The controls
 * are made here, so a visitor without JavaScript gets no control that would do nothing. It also marks
 * the lines a `#<block>-L3-L7` fragment names, a range no `:target` rule can select on its own. */

import { parseJson } from "../../src/guards.ts";
import { parseLineFragment, TARGET_CLASS } from "../../components/code/line-fragment.ts";
import { createResultFlash, writeClipboard, type Clipboard, type ResultFlash } from "../clipboard/result.ts";

/** Class on the copy button. */
export const BUTTON_CLASS = "code-copy";

/** Class on the wrap toggle. */
export const WRAP_BUTTON_CLASS = "code-wrap";

/** Class the toggle puts on the block; `ui.css` turns it into wrapped lines, never different text. */
export const WRAPPED_CLASS = "is-wrapped";

/** Class on the wrapper that holds the button and the live message, placed over the block. */
export const BAR_CLASS = "code-copy-bar";

/** Class on the wrapper that makes the block the positioning context for its control. */
export const FRAME_CLASS = "code-frame";

/** Class on the live region that announces the result. */
export const STATUS_CLASS = "code-copy-status";

/** Class on the code block the island works on (`CODE_CLASS` in `index.ts`). Terminal bodies also use `pre.code` but own their copy control. */
export const BLOCK_SELECTOR = "pre.code:not(.terminal-body)";

/** How long the result stays on the button before its label comes back. */
export const RESET_MS = 2000;

/** Hidden template the server writes, so the control's words follow the page's language. */
export const TEMPLATE_SELECTOR = "[data-code-copy]";

/** The words the control shows: its label, the result, the fallback when a copy fails, and the wrap toggle. */
export interface CopyLabels {
  readonly copy: string;
  readonly copied: string;
  readonly failed: string;
  readonly wrap: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
type IconNode = [string, Record<string, string | number>][];
type CopyIcons = { copy: IconNode; check: IconNode };

/** A Lucide icon in `currentColor`, hidden from assistive tech. */
function icon(env: CopyDocument, node: IconNode): CopyNode {
  const svg = env.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [tag, attrs] of node) {
    const child = env.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) child.setAttribute(name, String(value));
    svg.append(child);
  }
  return svg;
}

/** English fallback for a test, or a page whose template an older build did not write. */
export const DEFAULT_LABELS: CopyLabels = {
  copy: "Copy",
  copied: "Copied",
  failed: "Copy failed. Select the text and copy it by hand.",
  wrap: "Wrap lines",
};

/** Languages for a recorded console session: only prompted lines are command input; the rest is output. */
const SESSION = new Set(["console", "shellsession", "terminal"]);

/** Languages for a shell source file: a prompt is taken off, but every line stays code. */
const SHELL = new Set(["bash", "shell", "sh", "zsh"]);

/** Languages whose lines may start with a Python prompt (`>>> ` or `... `). */
const PYTHON = new Set(["py", "pycon", "python", "python3"]);

/** A node the island builds or writes to. */
export interface CopyNode {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  append(...children: unknown[]): void;
  addEventListener(type: "click", listener: () => void): void;
  textContent: string | null;
}

/** A code block as the island reads it. */
export interface CopyBlock {
  getAttribute(name: string): string | null;
  classList: { toggle?(name: string, force?: boolean): unknown; add?(name: string): void; remove?(name: string): void };
  querySelector(selector: string): { textContent: string | null } | null;
  before(node: CopyNode): void;
}

/** A line the fragment names. */
export interface CopyLine extends CopyBlock {
  classList: { add(name: string): void; remove(name: string): void };
  scrollIntoView?(options?: { block?: "center" }): void;
}

/** The part of the document the island uses. */
export interface CopyDocument {
  createElement(tag: string): CopyNode;
  createElementNS(namespace: string, tag: string): CopyNode;
  querySelectorAll(selector: string): Iterable<CopyBlock>;
  getElementById?(id: string): CopyLine | null;
  /** The hidden label template; an absent one keeps the English fallback. */
  querySelector?(selector: string): { getAttribute(name: string): string | null } | null;
}

/** The part of `navigator.clipboard` the island uses; the shared clipboard result path defines it. */
export type { Clipboard };

/** Everything the island reads from the world; tests pass fakes, the browser supplies its own. */
export interface CopyEnv {
  clipboard?: Clipboard | undefined;
  schedule(callback: () => void, ms: number): unknown;
  /** Cancels a scheduled reset, so a superseded or torn-down result never runs its restore. */
  cancel?(handle: unknown): void;
}

/** The elements of one block's copy control. */
interface CopyUi {
  copyIcon: CopyNode;
  checkIcon: CopyNode;
  status: CopyNode;
}

/**
 * The text a copy takes from a block: its code with the markers and prompts of its language removed.
 * In a `diff` block, removed lines (`-`) and file and hunk headers are dropped, and the `+` or space marker
 * is taken off the rest. In a recorded session (`console`, `shellsession`, `terminal`) only the prompted
 * command lines are kept, with their prompts and any `>` continuation prompts taken off; output, blank
 * lines, and diff metadata are dropped, so the clipboard can be run. In a shell block the `$ ` and `% `
 * prompts are taken off and every line stays; in a Python block the `>>> ` and `... ` prompts. Every other
 * language is copied as written.
 */
export function copyText(text: string, lang: string | undefined): string {
  const kind = (lang ?? "").trim().toLowerCase();
  const lines = text.split("\n");
  if (kind === "diff" || kind === "patch") return fromDiff(lines).join("\n");
  if (SESSION.has(kind)) return fromSession(lines).join("\n");
  if (SHELL.has(kind)) return lines.map((line) => line.replace(/^(\s*)[$%] /, "$1")).join("\n");
  if (PYTHON.has(kind)) return lines.map((line) => line.replace(/^(\s*)(>>>|\.\.\.) /, "$1")).join("\n");
  return text;
}

/**
 * The command input of a recorded session, one line per command, and nothing else. A `$` or `%` line is a
 * command and an empty one adds no line. A line that continues the command is kept: the lines after a
 * trailing `\`, and the body and delimiter of a heredoc. A `>` before a continuation line is its prompt and
 * is taken off; any other line is output or diff metadata and is dropped.
 */
function fromSession(lines: readonly string[]): string[] {
  const out: string[] = [];
  let open = false;
  let heredoc: string | undefined;
  for (const line of lines) {
    if (heredoc !== undefined) {
      const text = line.replace(/^\s*> /, "");
      out.push(text);
      if (text.trim() === heredoc) heredoc = undefined;
      continue;
    }
    if (open) {
      const text = line.replace(/^\s*> /, "");
      out.push(text);
      open = text.trimEnd().endsWith("\\");
      continue;
    }
    const command = /^\s*[$%](?:[ \t](.*))?$/.exec(line);
    if (command === null) continue;
    const text = command[1] ?? "";
    if (text.trim() === "") continue;
    out.push(text);
    open = text.trimEnd().endsWith("\\");
    heredoc = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(text)?.[2];
  }
  return out;
}

/** The lines of a diff that are still code: no headers, no removed lines, no `+` or space markers. */
function fromDiff(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (/^(diff |index |--- |\+\+\+ |@@ )/.test(line)) continue;
    if (line.startsWith("-")) continue;
    out.push(/^[+ ]/.test(line) ? line.slice(1) : line);
  }
  return out;
}

/** Adds a copy button and a wrap toggle above each code block and wires them. */
export function activate(doc: CopyDocument, env: CopyEnv): () => void {
  const labels = labelsOf(doc);
  const icons = iconsOf(doc);
  const flash = createResultFlash<CopyUi>({
    timers: env,
    resetMs: RESET_MS,
    apply(ui, ok) {
      ui.status.textContent = ok ? labels.copied : labels.failed;
      const shown = ok ? ui.checkIcon : ui.copyIcon;
      const hidden = ok ? ui.copyIcon : ui.checkIcon;
      hidden.setAttribute("hidden", "");
      shown.removeAttribute("hidden");
    },
    reset(ui) {
      ui.status.textContent = "";
      ui.checkIcon.setAttribute("hidden", "");
      ui.copyIcon.removeAttribute("hidden");
    },
  });
  const attached: CopyUi[] = [];
  let live = true;
  for (const block of doc.querySelectorAll(BLOCK_SELECTOR)) {
    const ui = attach(doc, block, env, labels, icons, flash, () => live);
    if (ui !== undefined) attached.push(ui);
  }
  return () => {
    live = false;
    for (const ui of attached) flash.restore(ui);
  };
}

/**
 * Marks the lines a fragment names: one line or a range in one block. Older marks are cleared first, so
 * a hash change never leaves two ranges lit. A range scrolls its first line here, because the browser
 * has no element with the range's own id.
 */
export function targetLines(doc: CopyDocument, hash: string): CopyLine[] {
  for (const line of doc.querySelectorAll(`.${TARGET_CLASS}`)) line.classList.remove?.(TARGET_CLASS);
  const fragment = parseLineFragment(hash);
  if (fragment === undefined) return [];
  const lines: CopyLine[] = [];
  for (let number = fragment.from; number <= fragment.to; number += 1) {
    const line = doc.getElementById?.(`${fragment.block}-L${number}`) ?? null;
    if (line === null) break;
    line.classList.add(TARGET_CLASS);
    lines.push(line);
  }
  if (fragment.from !== fragment.to) lines[0]?.scrollIntoView?.({ block: "center" });
  return lines;
}

/** The template's words for this page, falling back to English when it has none. */
export function labelsOf(doc: CopyDocument): CopyLabels {
  const template = doc.querySelector?.(TEMPLATE_SELECTOR) ?? null;
  const read = (name: string, fallback: string): string => {
    const value = template?.getAttribute(name)?.trim() ?? "";
    return value === "" ? fallback : value;
  };
  return {
    copy: read("data-copy", DEFAULT_LABELS.copy),
    copied: read("data-copied", DEFAULT_LABELS.copied),
    failed: read("data-failed", DEFAULT_LABELS.failed),
    wrap: read("data-wrap", DEFAULT_LABELS.wrap),
  };
}

function iconsOf(doc: CopyDocument): CopyIcons {
  const template = doc.querySelector?.(TEMPLATE_SELECTOR) ?? null;
  const read = (name: string): IconNode => {
    const value = template?.getAttribute(name);
    if (!value) return [];
    const parsed = parseJson(value);
    return Array.isArray(parsed) ? (parsed as IconNode) : [];
  };
  return { copy: read("data-copy-icon"), check: read("data-check-icon") };
}

/** One block's control: a bar above the block with the button and the live message. Returns the control's result target, or nothing when the block has no code. */
function attach(
  doc: CopyDocument, block: CopyBlock, env: CopyEnv, labels: CopyLabels, icons: CopyIcons,
  flash: ResultFlash<CopyUi>, isLive: () => boolean,
): CopyUi | undefined {
  const code = block.querySelector("code");
  if (code === null) return undefined;

  const bar = doc.createElement("div");
  bar.setAttribute("class", BAR_CLASS);

  const status = doc.createElement("span");
  status.setAttribute("class", STATUS_CLASS);
  status.setAttribute("role", "status");
  status.textContent = "";

  const button = doc.createElement("button");
  button.setAttribute("type", "button");
  button.setAttribute("class", BUTTON_CLASS);
  button.setAttribute("aria-label", labels.copy);

  // The source, language, and stable block id ride on the control, so a copy keeps its context.
  const lang = block.getAttribute("data-lang");
  if (lang !== null) button.setAttribute("data-lang", lang);
  const source = block.getAttribute("data-src");
  if (source !== null) button.setAttribute("data-src", source);
  const identity = block.getAttribute("id") ?? source;
  if (identity !== null) button.setAttribute("data-block-id", identity);

  const copyIcon = icon(doc, icons.copy);
  const checkIcon = icon(doc, icons.check);
  checkIcon.setAttribute("hidden", "");
  button.append(copyIcon, checkIcon);

  // A real button, so Enter and Space work without a key handler. It changes only the block's class.
  const wrap = doc.createElement("button");
  wrap.setAttribute("type", "button");
  wrap.setAttribute("class", WRAP_BUTTON_CLASS);
  wrap.setAttribute("aria-pressed", "false");
  wrap.textContent = labels.wrap;
  let wrapped = false;
  wrap.addEventListener("click", () => {
    wrapped = !wrapped;
    wrap.setAttribute("aria-pressed", wrapped ? "true" : "false");
    block.classList.toggle?.(WRAPPED_CLASS, wrapped);
  });

  const size = doc.createElement("span");
  size.setAttribute("class", "copy-status-size");
  size.setAttribute("aria-hidden", "true");
  size.textContent = labels.failed;
  bar.append(button, status, wrap, size);

  const frame = doc.createElement("div");
  frame.setAttribute("class", FRAME_CLASS);
  block.before(frame);
  frame.append(bar, block);

  const ui = { copyIcon, checkIcon, status };
  let clicks = 0;
  button.addEventListener("click", async () => {
    if (!isLive()) return;
    const click = ++clicks;
    const text = copyText(code.textContent ?? "", block.getAttribute("data-lang") ?? undefined);
    const ok = await writeClipboard(env.clipboard, text);
    if (click === clicks && isLive()) flash.show(ui, ok);
  });
  return ui;
}

/** The browser environment: the page's document, clipboard, and timer. */
const globals = globalThis as unknown as {
  document?: CopyDocument;
  navigator?: { clipboard?: Clipboard };
  location?: { readonly hash: string };
  addEventListener?(type: "hashchange", listener: () => void): void;
};

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) {
  activate(globals.document, {
    clipboard: globals.navigator?.clipboard,
    schedule: setTimeout,
    cancel: clearTimeout,
  });
  const mark = (): void => {
    targetLines(globals.document!, globals.location?.hash ?? "");
  };
  mark();
  globals.addEventListener?.("hashchange", mark);
}
