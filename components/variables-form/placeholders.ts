/* Placeholder substitution: which examples belong to a form's group, which variables a block records,
 * and how a value is written into inline spans and code blocks without cascading into other tokens. */

import { GROUP_ATTRIBUTE } from "./group.ts";
import { parseJson } from "../../src/guards.ts";
import { BLOCK_SELECTOR, INLINE_SELECTOR, type GroupScope, type PlaceholderNode, type PlaceholderRoot } from "./contract.ts";

/** The selection a direct `applyValue` call uses: the original page-wide behavior. */
const PAGE_SCOPE: GroupScope = { group: "", legacy: true };

/** The form group an example node belongs to, if it declares one. */
export function groupOf(node: { getAttribute(name: string): string | null }): string | undefined {
  const raw = node.getAttribute(GROUP_ATTRIBUTE);
  return raw === null || raw === "" ? undefined : raw;
}

/**
 * True when an example in `scope`'s group follows the form: a node in the same group always does; an
 * ungrouped node does only in the single-form legacy mode.
 */
export function appliesTo(node: { getAttribute(name: string): string | null }, scope: GroupScope): boolean {
  const own = groupOf(node);
  return own === undefined ? scope.legacy : own === scope.group;
}

/** The `{{name}}` text a placeholder stands for. */
export function tokenOf(name: string): string {
  return `{{${name}}}`;
}

/** The names recorded in a code block's `data-placeholders`, in order; malformed JSON gives none. */
export function namesOf(raw: string | null): string[] {
  if (raw === null || raw.trim() === "") return [];
  const value = parseJson(raw);
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return "";
      const name = (item as Readonly<Record<string, unknown>>).name;
      return typeof name === "string" ? name : "";
    })
    .filter((name) => name !== "");
}

/**
 * Replaces every `from` in a node's text with `to`, visiting text nodes so the surrounding markup keeps its
 * shape. Returns whether anything changed.
 */
export function replaceIn(node: PlaceholderNode, from: string, to: string): boolean {
  if (node.nodeType === 3) {
    const text = node.textContent ?? "";
    if (!text.includes(from)) return false;
    node.textContent = text.split(from).join(to);
    return true;
  }
  const children = node.childNodes;
  if (children === undefined) return false;
  let changed = false;
  for (const child of children) changed = replaceIn(child, from, to) || changed;
  return changed;
}

/** A placeholder the engine recorded: `{{name}}`, with optional spaces the author may have written. */
const PLACEHOLDER = /\{\{[ \t]*([A-Za-z0-9_.-]+)[ \t]*\}\}/g;

/** A code block as the author wrote it: its text nodes and the joined text they hold. */
interface BlockTemplate {
  readonly nodes: PlaceholderNode[];
  /** Where each text node ends in the joined text, so an edit can be written back span by span. */
  readonly ends: number[];
  readonly text: string;
}

/**
 * The authored text of each block, kept on the first edit. Every later edit starts from this template, so a
 * value that equals another variable's token, or the text the block showed a moment ago, is never replaced.
 */
const templates = new WeakMap<PlaceholderNode, BlockTemplate>();

/** The text nodes inside a block, in document order. */
function textNodesOf(node: PlaceholderNode, found: PlaceholderNode[] = []): PlaceholderNode[] {
  if (node.nodeType === 3) {
    found.push(node);
    return found;
  }
  const children = node.childNodes;
  if (children !== undefined) for (const child of children) textNodesOf(child, found);
  return found;
}

/** The block's authored text, captured before the first edit and reused after it. */
function templateOf(block: PlaceholderNode): BlockTemplate {
  const cached = templates.get(block);
  if (cached !== undefined) return cached;
  const nodes = textNodesOf(block);
  const ends: number[] = [];
  let at = 0;
  for (const node of nodes) {
    at += (node.textContent ?? "").length;
    ends.push(at);
  }
  const template = { nodes, ends, text: nodes.map((node) => node.textContent ?? "").join("") };
  templates.set(block, template);
  return template;
}

/** One token to replace in the template and the text that takes its place. */
interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** The edits for the values this block knows, skipping an escaped `\{{name}}` the author meant literally. */
function editsIn(template: string, values: ReadonlyMap<string, string>): Edit[] {
  const edits: Edit[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const start = match.index ?? 0;
    let backslashes = 0;
    for (let i = start - 1; i >= 0 && template.charAt(i) === "\\"; i -= 1) backslashes += 1;
    if (backslashes % 2 === 1) continue;
    const value = values.get(match[1] ?? "");
    if (value === undefined) continue;
    edits.push({ start, end: start + match[0].length, text: value });
  }
  return edits;
}

/** Where template offset `at` lands once the edits are applied, so each text node keeps its own slice. */
function offsetAfter(at: number, edits: readonly Edit[]): number {
  let delta = 0;
  for (const edit of edits) {
    if (edit.start >= at) break;
    const original = Math.min(at, edit.end) - edit.start;
    // Past the edit the whole replacement counts; inside it only the part before `at`.
    const replacement = at >= edit.end ? edit.text.length : Math.min(original, edit.text.length);
    delta += replacement - original;
  }
  return at + delta;
}

/**
 * Writes every known variable's value into the block it was authored with. A token split across highlighted
 * spans is found in the joined text and its replacement is spread back over the same nodes, so the rest of the
 * markup keeps its shape. Tokens are matched once against the template, so a value never cascades into another.
 */
function fillTemplate(block: PlaceholderNode, values: ReadonlyMap<string, string>): void {
  const template = templateOf(block);
  const edits = editsIn(template.text, values);
  if (edits.length === 0) return;
  let out = "";
  let cursor = 0;
  for (const edit of edits) {
    out += template.text.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  out += template.text.slice(cursor);
  for (const [index, node] of template.nodes.entries()) {
    const from = index === 0 ? 0 : offsetAfter(template.ends[index - 1] ?? 0, edits);
    const to = index === template.nodes.length - 1 ? out.length : offsetAfter(template.ends[index] ?? 0, edits);
    node.textContent = out.slice(from, to);
  }
}

/** What each block last received per variable, so a later edit can be rendered from the template. */
const appliedValues = new WeakMap<PlaceholderNode, Map<string, string>>();

/**
 * Writes `value` into every placeholder for `name` that belongs to `scope`: inline code spans only in the
 * single-form legacy mode, and code blocks and terminal sessions that recorded the name in
 * `data-placeholders`. Other variables and escaped placeholders are left alone, and each block is rendered
 * from the text the author wrote, so a second edit replaces only the tokens and never a value it showed
 * before. A terminal's copy button reads its command text from the page when it is clicked, so the copied
 * commands follow this change too.
 */
export function applyValue(root: PlaceholderRoot, name: string, value: string, scope: GroupScope = PAGE_SCOPE): void {
  if (name === "") return;

  if (scope.legacy) {
    for (const span of root.querySelectorAll(INLINE_SELECTOR)) {
      if (span.getAttribute("data-var") === name) span.textContent = value;
    }
  }
  for (const block of root.querySelectorAll(BLOCK_SELECTOR)) {
    if (!appliesTo(block, scope)) continue;
    if (!namesOf(block.getAttribute("data-placeholders")).includes(name)) continue;
    const applied = appliedValues.get(block) ?? new Map<string, string>();
    applied.set(name, value);
    appliedValues.set(block, applied);
    fillTemplate(block, applied);
  }
}
