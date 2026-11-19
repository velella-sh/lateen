import { h } from "preact";
import type { ComponentChildren, VNode } from "preact";
import type { Component } from "@velella/mizzen/contracts";

export const directive = "file-tree";

export interface FileTreeEntry {
  name: string;
  note: string;
  children: FileTreeEntry[];
}

export type FileTreeProps = {
  label?: string;
  id?: string;
};

type Open = { entry: FileTreeEntry; label: string; labelDone: boolean };

const NOTE_SEPARATOR = /\s#(?=\s|$)/;
const TAG = /<(\/?)([a-zA-Z][\w-]*)[^>]*>|[^<]+/g;

export function parseEntries(html: string): FileTreeEntry[] {
  const roots: FileTreeEntry[] = [];
  const open: Open[] = [];

  for (const match of html.matchAll(TAG)) {
    const [raw, slash, tag] = match;
    const top = open[open.length - 1];

    if (tag === undefined) {
      if (top && !top.labelDone) top.label += raw;
      continue;
    }

    const name = tag.toLowerCase();
    const closing = slash === "/";

    if (name === "li") {
      if (closing) {
        const done = open.pop();
        if (done) finish(done);
      } else {
        const entry: FileTreeEntry = { name: "", note: "", children: [] };
        (top ? top.entry.children : roots).push(entry);
        open.push({ entry, label: "", labelDone: false });
      }
    } else if (name === "ul" || name === "ol") {
      if (!closing && top) top.labelDone = true;
    } else if (name !== "p" && top && !top.labelDone) {
      top.label += raw;
    }
  }

  while (open.length > 0) finish(open.pop()!);
  return roots;
}

function finish({ entry, label }: Open): void {
  const text = label.trim();
  const separator = NOTE_SEPARATOR.exec(text);
  if (separator) {
    entry.name = text.slice(0, separator.index).trim();
    entry.note = text.slice(separator.index + separator[0].length).trim();
  } else {
    entry.name = text;
  }
}

function row(entry: FileTreeEntry, depth: number): VNode {
  return h(
    "div",
    { class: depth === 0 ? "tree-row" : "tree-row in", style: depth > 1 ? `padding-inline-start:${depth * 16}px` : undefined },
    h("span", { class: "tree-name" }, entry.name || "…"),
    entry.note ? h("span", { class: "tree-note" }, entry.note) : null,
    ...entry.children.map((child) => row(child, depth + 1)),
  );
}

const fileTree: Component<FileTreeProps> = ({ props, html }) => {
  const entries = parseEntries(html);
  const label = props.label?.trim() || "File tree";
  const children: ComponentChildren = entries.length > 0
    ? entries.map((entry) => row(entry, 0))
    : h("div", { dangerouslySetInnerHTML: { __html: html } });
  return h(
    "div",
    {
      class: "file-tree tree",
      role: "tree",
      "aria-label": label,
      ...(props.id ? { id: props.id } : {}),
    },
    children,
  );
};

export default fileTree;
