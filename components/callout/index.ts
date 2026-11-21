import { h } from "preact";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import { Info, Lightbulb, MessageSquare, OctagonAlert, TriangleAlert } from "lucide";
import type { IconNode } from "lucide";
import { icon as lucideIcon } from "../../src/icon.ts";
import { t } from "../../i18n/index.ts";

/** Class of the title paragraph, which also names the callout for assistive technology. */
export const TITLE_CLASS = "callout-title";

/** Class of the kind label shown above an author's title, matching the mockup eyebrow. */
export const KIND_CLASS = "callout-kind";

/** The five kinds GitHub alerts and `:::callout{type=…}` directives use. */
export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";

export type CalloutProps = {
  /** One of the five kinds; anything else (or nothing) is a note. */
  type?: string;
  /** Replaces the kind's default title. */
  title?: string;
};

const KINDS: readonly CalloutKind[] = ["note", "tip", "important", "warning", "caution"];

/** Older content says `danger` for what is now `caution`. */
const ALIASES: ReadonlyMap<string, CalloutKind> = new Map([["danger", "caution"]]);

/** The i18n key with each kind's default title, used when the author gives none. */
const TITLE_KEYS: Readonly<Record<CalloutKind, string>> = {
  note: "callout_note",
  tip: "callout_tip",
  important: "callout_important",
  warning: "callout_warning",
  caution: "callout_caution",
};

const ICONS: Readonly<Record<CalloutKind, IconNode>> = {
  note: Info,
  tip: Lightbulb,
  important: MessageSquare,
  warning: TriangleAlert,
  caution: OctagonAlert,
};

/** The kind a `type` value names. Unknown, missing, or non-string values are a note. */
export function calloutKind(type: unknown): CalloutKind {
  if (typeof type !== "string") return "note";
  const name = type.trim().toLowerCase();
  const alias = ALIASES.get(name);
  if (alias !== undefined) return alias;
  return (KINDS as readonly string[]).includes(name) ? (name as CalloutKind) : "note";
}

/**
 * Title ids already taken, keyed by the Page and the page HTML they were counted against, so one
 * page's ids cannot leak into another page or build.
 */
const pageTitleIds = new WeakMap<Page, { html: string; ids: Set<string> }>();

/**
 * An id for the title that names its callout: `callout-<kind>-title`, then `<base>-2`, `<base>-3`, in
 * page order, so repeated callouts of one kind stay distinct.
 */
function titleId(page: Page, kind: CalloutKind): string {
  let state = pageTitleIds.get(page);
  if (state === undefined || state.html !== page.html) {
    state = { html: page.html, ids: new Set() };
    pageTitleIds.set(page, state);
  }
  const base = `callout-${kind}-title`;
  let id = base;
  for (let n = 2; state.ids.has(id); n += 1) id = `${base}-${n}`;
  state.ids.add(id);
  return id;
}

/**
 * A short message set apart from the text. Lucide draws the kind icon; `role="note"` keeps it a note
 * without announcing it as an alert. The default title is read in the page language.
 */
export default function callout({ props, html, page }: ComponentProps<CalloutProps>) {
  const kind = calloutKind(props.type);
  const custom = typeof props.title === "string" ? props.title.trim() : "";
  const kindLabel = t(page.lang, TITLE_KEYS[kind]);
  const title = custom === "" ? kindLabel : custom;
  const id = titleId(page, kind);

  return h(
    "div",
    { class: `callout callout-${kind}`, role: "note", "aria-labelledby": id },
    lucideIcon({ node: ICONS[kind], class: "callout-icon" }),
    h(
      "div",
      { class: "callout-content" },
      custom === "" ? null : h("p", { class: KIND_CLASS }, kindLabel),
      h("p", { class: TITLE_CLASS, id }, title),
      h("div", { class: "callout-body", dangerouslySetInnerHTML: { __html: html } }),
    ),
  );
}
