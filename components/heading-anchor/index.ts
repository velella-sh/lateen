import { h } from "preact";
import type { ComponentChildren } from "preact";
import { renderToString } from "preact-render-to-string";
import { t } from "../../i18n/index.ts";
import { Link } from "lucide";
import { icon } from "../../src/icon.ts";

/** Class on the link that points at the heading. */
export const ANCHOR_CLASS = "heading-anchor";

/** Class on the span that holds the heading's own text. */
export const TEXT_CLASS = "heading-text";

/** Heading levels that get an anchor (design brief: h2 to h4). */
export const LEVELS = ["h2", "h3", "h4"] as const;

const DEFAULT_LABEL = t("en", "heading_anchor_label");

export type HeadingAnchorProps = {
  /** The heading's anchor id, from the slug stage. */
  id: string;
  /** Heading level, 2 to 4. */
  level: 2 | 3 | 4;
  children?: ComponentChildren;
  /** Accessible name of the link. */
  label?: string;
};

/**
 * A heading followed by a link icon to itself. The heading's accessible name is
 * its text alone: `aria-labelledby` points at the text span, so the icon and its
 * link label stay out of the name.
 */
export default function headingAnchor({ id, level, children, label = DEFAULT_LABEL }: HeadingAnchorProps) {
  return h(
    `h${level}`,
    { id, "aria-labelledby": textIdFor(id) },
    h("span", { id: textIdFor(id), class: TEXT_CLASS }, children),
    anchorElement(id, linkName(label, flatText(children), id)),
  );
}

/**
 * The link's accessible name: the label plus the heading's own text, so links
 * read out of context say where they go. An empty heading falls back to its id,
 * which is unique on the page.
 */
function linkName(label: string, text: string, id: string): string {
  const name = text.replace(/\s+/g, " ").trim() || id;
  return `${label}: ${name}`;
}

/** Plain text of rendered children, inline elements included. */
function flatText(children: ComponentChildren): string {
  if (children === null || children === undefined || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(flatText).join("");
  const props = (children as { props?: { children?: ComponentChildren } }).props;
  return flatText(props?.children);
}

/** Id of the span that holds a heading's text, unique per page because the slug is. */
export function textIdFor(id: string): string {
  return `heading-text-${id}`;
}

/** The link icon: a chain drawn in `currentColor`, hidden from assistive tech. */
function anchorElement(id: string, label: string) {
  return h(
    "a",
    { class: ANCHOR_CLASS, href: `#${id}`, "aria-label": label },
    icon({ node: Link }),
  );
}

/** Adds permalinks to Markdown headings while preserving their slugs and earlier alias anchors. */
export function anchorMarkdownHeadings(fragment: DocumentFragment, lang: string): boolean {
  const label = t(lang, "heading_anchor_label");
  const headings = Array.from(fragment.querySelectorAll(LEVELS.map((level) => `${level}[id][data-src]`).join(",")));
  let changed = false;
  for (const heading of headings) {
    const id = heading.id;
    if (!id || heading.querySelector(`.${ANCHOR_CLASS}`)) continue;
    const text = fragment.ownerDocument.createElement("span");
    text.id = textIdFor(id);
    text.className = TEXT_CLASS;
    text.append(...heading.childNodes);
    heading.append(text);
    heading.setAttribute("aria-labelledby", text.id);
    heading.setAttribute("data-heading-anchor", "");
    heading.insertAdjacentHTML("beforeend", renderToString(anchorElement(id, linkName(label, text.textContent ?? "", id))));
    changed = true;
  }
  return changed;
}

/** Minimal hast node the rehype step walks. */
export type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

/**
 * Rehype plugin: adds the same anchor to every h2 to h4 that has an id (put there
 * by the slug stage). A heading that already has the anchor is left alone.
 */
export function rehype() {
  return function headingAnchorRehype(tree: HastNode): void {
    anchorHeadings(tree);
  };
}

function anchorHeadings(node: HastNode): void {
  const children = node.children;
  if (!children) return;

  for (const child of children) {
    if (child.type === "element" && isLevel(child.tagName)) {
      anchorHeading(child);
      continue;
    }
    anchorHeadings(child);
  }
}

function isLevel(tagName: string | undefined): boolean {
  return (LEVELS as readonly string[]).includes(tagName ?? "");
}

function anchorHeading(heading: HastNode): void {
  const id = heading.properties?.id;
  if (typeof id !== "string" || id.length === 0) return;
  if (heading.children?.some((child) => hasClass(child, ANCHOR_CLASS))) return;

  const textId = textIdFor(id);
  const original = heading.children ?? [];
  const text: HastNode = {
    type: "element",
    tagName: "span",
    properties: { id: textId, className: [TEXT_CLASS] },
    children: original,
  };
  heading.properties = { ...heading.properties, ariaLabelledBy: textId };
  heading.children = [text, anchorNode(id, linkName(DEFAULT_LABEL, original.map(hastText).join(""), id))];
}

function hastText(node: HastNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(hastText).join("");
}

function anchorNode(id: string, label: string): HastNode {
  return {
    type: "element",
    tagName: "a",
    properties: { className: [ANCHOR_CLASS], href: `#${id}`, ariaLabel: label },
    children: [
      {
        type: "element",
        tagName: "svg",
        properties: {
          viewBox: "0 0 24 24",
          width: 24,
          height: 24,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          ariaHidden: "true",
          focusable: "false",
        },
        children: Link.map(([tagName, properties]) => ({ type: "element", tagName, properties, children: [] })),
      },
    ],
  };
}

function hasClass(node: HastNode, name: string): boolean {
  if (node.type !== "element") return false;
  const value = node.properties?.className ?? node.properties?.class;
  if (Array.isArray(value)) return value.map(String).includes(name);
  if (typeof value === "string") return value.split(/\s+/).includes(name);
  return false;
}
