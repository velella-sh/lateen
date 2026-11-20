import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import { ArrowLeftRight, Diamond, Minus, Plus } from "lucide";
import type { IconNode } from "lucide";
import { patternOf, t } from "../../i18n/index.ts";
import { icon as lucideIcon } from "../../src/icon.ts";
import { instanceId } from "../../src/page-ids.ts";
import { idBase, versionDiffFor, type ChangeKind, type VersionChange, type VersionDiffProps } from "./changes.ts";

/** The Markdown directive this component handles: `::version-diff{from=v1 to=v2 changes='[...]'}`. */
export const directive = "version-diff";

// The pure normalization module stays importable from here, so the component's public contract is
// unchanged: `changes.ts` parses and pairs the evidence, this file only renders it.
export {
  DEFAULT_ID,
  KINDS,
  STATES,
  changeOf,
  changesOf,
  diffOf,
  idBase,
  kindOf,
  parseJson,
  versionDiffFor,
  type ChangeKind,
  type DiffState,
  type VersionChange,
  type VersionDiff,
  type VersionDiffProps,
} from "./changes.ts";

/** Class on text for assistive tech only: the "added" or "removed" word before an excerpt marker. */
export const SR_CLASS = "version-diff-sr";

/**
 * The icon before each kind's label. Each kind has its own shape, so the kinds differ by shape and
 * by the visible label, never by color alone.
 */
export const ICONS: Readonly<Record<ChangeKind, IconNode>> = {
  added: Plus,
  removed: Minus,
  changed: Diamond,
  moved: ArrowLeftRight,
};

/** The i18n key with each kind's visible label. */
export const LABEL_KEYS: Readonly<Record<ChangeKind, string>> = {
  added: "version_diff_added",
  removed: "version_diff_removed",
  changed: "version_diff_changed",
  moved: "version_diff_moved",
};

/** One kind's inline icon; the visible label beside it carries the meaning, so it is decorative. */
function icon(kind: ChangeKind) {
  return lucideIcon({ node: ICONS[kind], class: "version-diff-icon" });
}

/** A section of text from one side of the change, under its `Before` or `After` label and marker. */
function excerpt(side: "before" | "after", label: string, text: string, lang: string) {
  const added = side === "after";
  return h(
    "div",
    { class: `version-diff-${side}` },
    h(
      "span",
      { class: "version-diff-text-label" },
      h("span", { class: SR_CLASS }, `${t(lang, added ? "diff_added" : "diff_removed")} `),
      h("span", { class: "version-diff-marker", "aria-hidden": "true" }, added ? "+ " : "− "),
      label,
    ),
    h("p", { class: "version-diff-text", dir: "auto" }, text),
  );
}

/** One side of the comparison: its label and the version it names, both in text. */
function versionLabel(side: "base" | "target", label: string, version: string) {
  return h(
    "span",
    { class: `version-diff-version version-diff-${side}`, "data-version": version },
    h("span", { class: "version-diff-version-label" }, label, " "),
    h("bdi", { class: "version-diff-version-value", dir: "ltr" }, version),
  );
}

/** One change: its section heading, the kind in text and icon, positions, and the changed text. */
function changeItem(change: VersionChange, index: number, base: string, lang: string) {
  const parts = [
    h("h3", { class: "version-diff-item-title", id: `${base}-change-${index + 1}-title` }, change.title),
    h(
      "p",
      { class: `version-diff-kind version-diff-kind-${change.kind}` },
      icon(change.kind),
      h("span", { class: "version-diff-kind-label" }, t(lang, LABEL_KEYS[change.kind])),
    ),
  ];

  if (change.kind === "moved" && (change.from !== undefined || change.to !== undefined)) {
    parts.push(
      h(
        "p",
        { class: "version-diff-position" },
        change.from === undefined
          ? null
          : h(
              "span",
              { class: "version-diff-position-old" },
              t(lang, "version_diff_moved_from", { from: change.from }),
            ),
        change.to === undefined
          ? null
          : h(
              "span",
              { class: "version-diff-position-new" },
              t(lang, "version_diff_moved_to", { to: change.to }),
            ),
      ),
    );
  }

  if (change.before !== undefined) parts.push(excerpt("before", t(lang, "version_diff_before"), change.before, lang));
  if (change.after !== undefined) parts.push(excerpt("after", t(lang, "version_diff_after"), change.after, lang));

  return h(
    "li",
    {
      class: `version-diff-item version-diff-item-${change.kind}`,
      id: `${base}-change-${index + 1}`,
      "data-version-diff-item": "",
      "data-kind": change.kind,
      tabindex: -1,
    },
    parts,
  );
}

/**
 * A section-by-section diff between two versions of a page. Every change says what it is with a
 * visible label and its own icon shape, not color alone, and shows the section's heading; moved
 * changes also show their old and new position. The header names the base and target versions in
 * text, and each changed excerpt carries a `−` or `+` as real text, so copying or printing the diff
 * keeps the added and removed markers. The diff is an ordered list with a heading, so without
 * JavaScript it reads top to bottom as written.
 *
 * An explicit empty comparison still renders its heading and both versions, with a zero-change
 * message and `data-diff-state="unchanged"`. Malformed evidence renders as `unavailable` instead of
 * disappearing, so it cannot be read as a verified empty diff; only input that was never written
 * renders nothing. Partially readable evidence — usable changes beside dropped ones, in either the
 * listed or the grouped shape — renders `data-diff-state="incomplete"` with the list, the accurate
 * `data-changes-usable` and `data-changes-dropped` counts, and a visible note naming the comparison
 * partial, so it is never presented as complete. `client.ts` is the island: it reveals Previous and
 * Next buttons and a change count, and the arrow keys, Home, and End move between changes with one
 * change in the tab order at a time. The wording comes from `i18n/*.json` in the page's language,
 * and the stylesheet uses logical properties only.
 */
const versionDiff: Component<VersionDiffProps> = ({ props, page }) => {
  const diff = versionDiffFor(props, page.frontMatter);
  if (diff === undefined) return null;

  const base = instanceId(page, idBase(props.id));
  const titleId = `${base}-title`;
  const listId = `${base}-list`;
  const noteId = `${base}-note`;
  const total = diff.changes.length;
  const readable = diff.state === "changes" || diff.state === "incomplete";
  const { from, to } = diff;

  return h(
    "section",
    {
      class: "version-diff",
      "data-version-diff": base,
      "data-diff-state": diff.state,
      ...(from === undefined ? {} : { "data-version-from": from }),
      ...(to === undefined ? {} : { "data-version-to": to }),
      ...(readable
        ? { "data-changes-usable": String(total), "data-changes-dropped": String(diff.dropped) }
        : {}),
      "aria-labelledby": titleId,
      ...(diff.state === "incomplete" ? { "aria-describedby": noteId } : {}),
    },
    h(
      "header",
      { class: "version-diff-header" },
      h(
        "div",
        { class: "version-diff-heading" },
        h(
          "h2",
          { class: "version-diff-title", id: titleId },
          from !== undefined && to !== undefined
            ? t(page.lang, "version_diff_title", { from, to })
            : t(page.lang, "diff"),
        ),
        from === undefined && to === undefined
          ? null
          : h(
              "p",
              { class: "version-diff-versions" },
              from === undefined ? null : versionLabel("base", t(page.lang, "version_diff_base"), from),
              from !== undefined && to !== undefined ? " " : null,
              to === undefined ? null : versionLabel("target", t(page.lang, "version_diff_target"), to),
            ),
      ),
      !readable
        ? null
        : h(
            "div",
            {
              class: "version-diff-controls",
              role: "group",
              "aria-label": t(page.lang, "version_diff_group"),
              "data-version-diff-controls": "",
              hidden: true,
            },
            h(
              "button",
              {
                type: "button",
                class: "version-diff-previous",
                "data-version-diff-previous": "",
                "aria-controls": listId,
              },
              t(page.lang, "version_diff_previous"),
            ),
            h(
              "p",
              {
                class: "version-diff-count",
                "data-version-diff-count": "",
                "data-template": patternOf(page.lang, "version_diff_count"),
                "data-total": String(total),
                "aria-live": "polite",
                "aria-atomic": "true",
              },
              t(page.lang, "version_diff_count", { current: 1, total }),
            ),
            h(
              "button",
              {
                type: "button",
                class: "version-diff-next",
                "data-version-diff-next": "",
                "aria-controls": listId,
              },
              t(page.lang, "version_diff_next"),
            ),
          ),
    ),
    diff.state === "incomplete"
      ? h(
          "p",
          {
            class: "version-diff-note",
            id: noteId,
            "data-version-diff-note": "",
            "data-changes-usable": String(total),
            "data-changes-dropped": String(diff.dropped),
          },
          h("span", { class: "version-diff-note-label" }, t(page.lang, "partial")),
          " ",
          t(page.lang, "version_diff_incomplete", { usable: total, dropped: diff.dropped }),
        )
      : null,
    readable
      ? h(
          "ol",
          { class: "version-diff-list", id: listId, "data-version-diff-list": "" },
          diff.changes.map((change, index) => changeItem(change, index, base, page.lang)),
        )
      : h(
          "p",
          { class: `version-diff-state version-diff-${diff.state}` },
          diff.state === "unchanged"
            ? t(page.lang, "version_diff_count", { current: 0, total: 0 })
            : t(page.lang, "drift_state_unavailable"),
        ),
  );
};

export default versionDiff;
