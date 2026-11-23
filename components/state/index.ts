import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

/** The three situations a page can be in when it has nothing to show. */
export const STATE_KINDS = ["empty", "error", "not-found"] as const;
export type StateKind = (typeof STATE_KINDS)[number];

/** A link in the state's action row. The first one is the primary action. */
export type StateAction = {
  readonly href: string;
  readonly label: string;
};

export type StateProps = {
  readonly kind: StateKind;
  /** The heading. An empty note has none and reads as one line of text. */
  readonly title?: string;
  /** What happened and what to do next, in the page language. */
  readonly description: string;
  /** A short mark above the heading, such as `404`. Hidden from assistive technology: the title says the same. */
  readonly code?: string;
  /** Recovery links: the first is the primary action, the rest are secondary. */
  readonly actions?: readonly StateAction[];
  readonly children?: ComponentChildren;
};

/**
 * A page or region that has nothing to show: empty, failed, or not found. It is neutral about where it is
 * used (a list, a search, a missing page) and carries only text from the caller, so the page language is
 * never guessed here. Without a title it is a compact note; with one it is a full recovery block with a
 * heading and actions. An error is announced politely (`role="status"`), the others are plain content.
 */
export function stateView(props: StateProps) {
  const { kind, title, description, code, actions = [], children } = props;
  const block = title !== undefined;
  const classes = `state state-${kind}${block ? " state-block" : " state-note"}`;
  const role: string | undefined = kind === "error" ? "status" : undefined;

  if (!block) return h("p", { class: classes, role }, description, children);

  return h(
    "div",
    { class: classes, role },
    code === undefined ? null : h("p", { class: "state-code", "aria-hidden": "true" }, code),
    h("h1", { class: "state-title" }, title),
    h("p", { class: "state-description" }, description),
    children,
    actions.length === 0
      ? null
      : h(
          "div",
          { class: "state-actions" },
          actions.map((action, index) =>
            h("a", { class: index === 0 ? "state-primary" : "state-secondary", href: action.href }, action.label),
          ),
        ),
  );
}

/** Directive props: `::state{kind=empty description="…"}`. Every value is a string; the body is the description when none is given. */
export type StateDirectiveProps = {
  kind?: string;
  title?: string;
  description?: string;
  code?: string;
  /** A JSON list of `{ "href", "label" }` links. Only root-relative and `https` addresses are kept. */
  actions?: string;
};

function clean(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** The recovery links in a JSON `actions` prop, keeping only entries with a label and a safe address. */
export function actionList(value: unknown): StateAction[] {
  const raw = clean(value);
  if (raw === undefined) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => {
    const { href, label } = (entry ?? {}) as { href?: unknown; label?: unknown };
    const address = clean(href);
    const text = clean(label);
    if (address === undefined || text === undefined) return [];
    return /^(\/(?!\/)|https:\/\/)/.test(address) ? [{ href: address, label: text }] : [];
  });
}

/** The directive form of the state, for pages that need to show one as content. */
export default function state({ props, html }: ComponentProps<StateDirectiveProps>) {
  const kind = (STATE_KINDS as readonly string[]).includes(props.kind ?? "") ? (props.kind as StateKind) : "empty";
  const authored = clean(props.description);
  const description = authored ?? html.replace(/<[^>]*>/g, "").trim();
  if (description === "") return null;
  const title = clean(props.title);
  const code = clean(props.code);
  return stateView({ kind, description, ...(title === undefined ? {} : { title }), ...(code === undefined ? {} : { code }), actions: actionList(props.actions) });
}
