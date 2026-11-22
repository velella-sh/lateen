import { h } from "preact";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import { ChevronDown, Info, Lightbulb, MessageSquare, OctagonAlert, TriangleAlert } from "lucide";
import type { IconNode } from "lucide";
import { icon as lucideIcon } from "../../src/icon.ts";
import { flagOf } from "../../src/flags.ts";
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
  collapsible?: string | boolean;
  open?: string | boolean;
};

const KINDS: readonly CalloutKind[] = ["note", "tip", "important", "warning", "caution"];

/** MkDocs Material names and aliases, mapped to Lateen's five visual variants. */
const ALIASES: ReadonlyMap<string, CalloutKind> = new Map([
  ["info", "note"], ["todo", "note"], ["quote", "note"], ["cite", "note"], ["example", "note"],
  ["tip", "tip"], ["hint", "tip"], ["success", "tip"], ["check", "tip"], ["done", "tip"],
  ["abstract", "important"], ["summary", "important"], ["tldr", "important"],
  ["question", "important"], ["help", "important"], ["faq", "important"],
  ["attention", "warning"],
  ["danger", "caution"], ["failure", "caution"], ["fail", "caution"], ["missing", "caution"],
  ["error", "caution"], ["bug", "caution"],
]);

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

  const marker = lucideIcon({ node: ICONS[kind], class: "callout-icon" });
  const body = h("div", { class: "callout-body", dangerouslySetInnerHTML: { __html: html } });
  if (flagOf(props.collapsible)) {
    return h(
      "details",
      { class: `callout callout-${kind} callout-disclosure`, open: flagOf(props.open) },
      h(
        "summary",
        { class: "callout-summary" },
        marker,
        h("span", { class: TITLE_CLASS }, title),
        lucideIcon({ node: ChevronDown, class: "callout-chevron" }),
      ),
      body,
    );
  }

  return h(
    "div",
    { class: `callout callout-${kind}`, role: "note", "aria-labelledby": id },
    marker,
    h(
      "div",
      { class: "callout-content" },
      custom === "" ? null : h("p", { class: KIND_CLASS }, kindLabel),
      h("p", { class: TITLE_CLASS, id }, title),
      body,
    ),
  );
}

/** A named importer directive shares the callout renderer and locks its own variant. */
export function importedCallout(type: string) {
  return (input: ComponentProps<CalloutProps>) => callout({ ...input, props: { ...input.props, type } });
}
