import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import type { ComponentChildren } from "preact";
import { CircleCheckBig, CircleDashed, CircleQuestionMark, Minus } from "lucide";
import type { IconNode } from "lucide";
import { icon as lucideIcon } from "../../src/icon.ts";
import { trustPanelViewOf } from "./view-model.ts";
import type { DateRowView, TrustLevel, TrustPanelProps } from "./view-model.ts";

export {
  EXAMPLES_CLASS,
  EXAMPLE_STATES,
  evidenceOf,
  examplesAttrs,
  examplesClassName,
  examplesFor,
  examplesText,
  type ExamplesEvidence,
  type ExampleState,
} from "./examples.ts";

export {
  LEVELS,
  actionHrefOf,
  driftFor,
  driftText,
  entryFor,
  entryOf,
  explanationOf,
  levelOf,
  pagesOf,
  provenanceOf,
  reasonsOf,
  reviewerText,
  trustEvidenceFor,
  trustEvidenceOf,
  trustPanelViewOf,
  type ActionView,
  type DateRowView,
  type ExamplesRowView,
  type Provenance,
  type RevisionRowView,
  type TextRowView,
  type TrustEntry,
  type TrustEvidence,
  type TrustLevel,
  type TrustPanelProps,
  type TrustPanelView,
} from "./view-model.ts";

/** Class on the disclosure root; `style.css` styles it. */
export const CLASS = "trust-panel";

/** The page has one automatic panel; its id is the fragment the article's tested chip links to. */
export const PANEL_ID = "trust-panel";

/** Class on the visible chip, the `<summary>` of the disclosure. */
export const CHIP_CLASS = "trust-panel-chip";

/** Class on the chip's icon. It is decorative: the level text carries the meaning. */
export const ICON_CLASS = "trust-panel-icon";

/** Class on the chip's level text. */
export const LEVEL_CLASS = "trust-panel-level";

/** Class on the panel below the chip. */
export const BODY_CLASS = "trust-panel-body";

/** Class on the definition list that holds the rows. */
export const ROWS_CLASS = "trust-panel-rows";

/** Class on a row's label. */
export const LABEL_CLASS = "trust-panel-label";

/** Class on a row's value. */
export const VALUE_CLASS = "trust-panel-value";

/** Class on the "why this level" heading. */
export const REASONS_LABEL_CLASS = "trust-panel-reasons-label";

/** Class on the list of reasons. */
export const REASONS_CLASS = "trust-panel-reasons";

/** Class on the row of action links. */
export const ACTIONS_CLASS = "trust-panel-actions";

/** Class on an action link. */
export const ACTION_CLASS = "trust-panel-action";

/** Lucide icons for each state. The shapes differ, so colour is never the only signal. */
export const ICONS: Readonly<Record<TrustLevel, IconNode>> = {
  verified: CircleCheckBig,
  partial: CircleDashed,
  unreviewed: Minus,
  unknown: CircleQuestionMark,
};

/** The chip's icon; it is decorative, so the level text carries the meaning. */
function icon(level: TrustLevel) {
  return lucideIcon({ node: ICONS[level], class: ICON_CLASS });
}

/** The disclosure's summary: the decorative icon and the localised level text. */
function chip(level: TrustLevel, text: string) {
  return h("summary", { class: CHIP_CLASS }, icon(level), h("span", { class: LEVEL_CLASS }, text));
}

/** One row of the panel: a label and its value, with optional machine-readable attributes on the value. */
function row(label: string, value: ComponentChildren, className: string, attrs: Record<string, string | number> = {}) {
  return [
    h("dt", { class: LABEL_CLASS }, label),
    h("dd", { class: `${VALUE_CLASS} ${className}`, ...attrs }, value),
  ];
}

/** One provenance date row: its label, the full ISO value, and the page's calendar text. */
function dateRow(date: DateRowView, className: string) {
  return [
    h("dt", { class: LABEL_CLASS }, date.label),
    h(
      "dd",
      { class: `${VALUE_CLASS} ${className}` },
      h("time", { datetime: date.iso, title: date.exact, "aria-label": date.exact }, date.text),
    ),
  ];
}

/**
 * A trust chip next to the page title that opens a native `<details>` panel with the page's examples,
 * drift, last reviewer, and why it has its level. The chip and the panel work without JavaScript; the
 * island only adds Escape-to-close and returns focus to the summary.
 *
 * Every selection — evidence, provenance dates, drift, reviewer, and actions — is made by the pure
 * view model (`view-model.ts`); this file only draws its result and never reads the site contracts.
 * The entry comes from `site.data.trust`, keyed by `page.url`, or from the directive's props for a manual
 * panel. A page with no entry renders nothing, so missing evidence never becomes a `verified` claim. An
 * entry that is present but unreadable (not a record, or no known level) renders `unknown` with
 * `data-trust-evidence="invalid"`, its non-claiming explanation, and no rows, provenance, or actions,
 * so a malformed record is reported instead of disappearing. Every state explains itself in the panel:
 * the entry's reasons, or the state's definition when it records none. Examples and drift come from
 * `site.data.examples` and `site.data.drift`; the examples row keeps partial, unrun, failed,
 * unreadable, and absent evidence visibly and structurally distinct, in the tested-chip contract's
 * states (see `examples.ts`), and example evidence never changes the declared level. The action
 * links come from `theme.options.trust`. The published report supplies a build digest when present,
 * and Mizzen's inline reviewer data can supply an exact review date. The doc layout places the panel
 * under the title. The panel reads reason messages from the engine and also accepts
 * strings from hand-written `_data/trust.yml`.
 */
export const renderTrustPanel: Component<TrustPanelProps> = ({ props, page, site }) => {
  const view = trustPanelViewOf(props, page, site);
  if (view.state === "absent") return null;

  if (view.state === "invalid") {
    return h(
      "details",
      {
        id: PANEL_ID,
        class: `${CLASS} ${CLASS}-unknown`,
        "data-trust-panel": "",
        "data-trust-level": "unknown",
        "data-trust-evidence": "invalid",
      },
      chip("unknown", view.chip),
      h(
        "div",
        { class: BODY_CLASS },
        h("p", { class: REASONS_LABEL_CLASS }, view.reasonsLabel),
        h("ul", { class: REASONS_CLASS }, view.reasons.map((reason) => h("li", null, reason))),
      ),
    );
  }

  const provenance = view.provenance;
  return h(
    "details",
    {
      id: PANEL_ID,
      class: `${CLASS} ${CLASS}-${view.level}`,
      "data-trust-panel": "",
      "data-trust-level": view.level,
      ...(provenance.buildId === undefined ? {} : { "data-trust-build": provenance.buildId }),
      ...(provenance.reviewedAt === undefined ? {} : { "data-trust-reviewed": provenance.reviewedAt }),
      ...(provenance.reviewedCommit === undefined ? {} : { "data-trust-reviewed-commit": provenance.reviewedCommit }),
    },
    chip(view.level, view.chip),
    h(
      "div",
      { class: BODY_CLASS },
      h(
        "dl",
        { class: ROWS_CLASS },
        ...(view.signalRows === undefined
          ? [
              ...row(view.examples.label, view.examples.text, view.examples.className, view.examples.attrs),
              ...row(view.drift.label, view.drift.text, "trust-panel-drift"),
            ]
          : view.signalRows.flatMap(({ label, text }) => row(label, text, "trust-panel-signal"))),
        ...(view.reviewed === undefined ? [] : dateRow(view.reviewed, "trust-panel-reviewed")),
        ...(view.revision === undefined
          ? []
          : row(
              view.revision.label,
              h(
                "a",
                { class: "trust-panel-revision", href: view.revision.href },
                h("code", null, view.revision.commit.slice(0, 7)),
              ),
              "trust-panel-revision-cell",
              { title: view.revision.commit },
            )),
        ...row(view.reviewer.label, view.reviewer.text, "trust-panel-reviewer"),
      ),
      h("p", { class: REASONS_LABEL_CLASS }, view.reasonsLabel),
      h("ul", { class: REASONS_CLASS }, view.reasons.map((reason) => h("li", null, reason))),
      view.actions.length === 0
        ? null
        : h(
            "div",
            { class: ACTIONS_CLASS },
            ...view.actions.map((action) => h("a", { class: ACTION_CLASS, href: action.href }, action.label)),
          ),
    ),
  );
};
