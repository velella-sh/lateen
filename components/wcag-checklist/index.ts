import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { formatNumber, safeHref, wcagChecksOf, type Principle, type WcagCheck } from "../../src/report.ts";

/** The Markdown directive this component handles: `::wcag-checklist{from=…}`. */
export const directive = "wcag-checklist";

/** Default key in `site.data` when the directive names no `from`. */
export const DEFAULT_FROM = "wcag";

export const OPTIONS = ["from"] as const;

export const CLASS = "wcag-checklist";

export type WcagChecklistProps = {
  /** Dot-separated key in `site.data` that holds the criteria; defaults to `wcag`. */
  readonly from?: string;
};

/** The principles in specification order; the first digit of a criterion's number names its principle. */
export const PRINCIPLES: readonly Principle[] = ["perceivable", "operable", "understandable", "robust"];

/** The criteria of one principle, in the order the data lists them. */
export function byPrinciple(checks: readonly WcagCheck[], principle: Principle): readonly WcagCheck[] {
  return checks.filter((check) => check.principle === principle);
}

/** The count of each way of checking. */
export function howCounts(checks: readonly WcagCheck[]): Readonly<Record<WcagCheck["how"], number>> {
  return {
    automated: checks.filter((check) => check.how === "automated").length,
    manual: checks.filter((check) => check.how === "manual").length,
    "not-applicable": checks.filter((check) => check.how === "not-applicable").length,
  };
}

/** The recorded check, its evidence linked; or a plain "not recorded yet" for a manual check. */
function checkedCell(lang: string, check: WcagCheck): ComponentChildren {
  if (check.checked !== undefined) {
    const evidence = safeHref(check.checked.evidence);
    return [
      h("time", { datetime: check.checked.date, dir: "ltr" }, check.checked.date),
      ` · ${check.checked.version} · `,
      evidence === undefined ? t(lang, "wcag_evidence") : h("a", { href: evidence }, t(lang, "wcag_evidence")),
    ];
  }
  return check.how === "manual" ? t(lang, "wcag_not_recorded") : "";
}

/**
 * Every WCAG 2.2 level A and AA criterion, grouped by principle, with how it is checked and the
 * evidence behind a manual check. The criterion numbers and names link to the W3C's Understanding
 * page; the criterion text itself is never copied here. A manual check with no recorded date,
 * version, and evidence reads "not recorded yet", so the list never claims a check that did not
 * happen. It reads `site.data` and shows a visible message when the checklist is absent.
 */
const wcagChecklist: Component<WcagChecklistProps> = ({ props, site, page }) => {
  const from = typeof props.from === "string" && props.from.trim() !== "" ? props.from.trim() : DEFAULT_FROM;
  const checks = wcagChecksOf(site, from);
  const lang = page.lang;
  if (checks === undefined) {
    return h(
      "p",
      { class: "report-missing", role: "note", "data-report": from },
      t(lang, "report_missing", { name: from }),
    );
  }

  const counts = howCounts(checks);
  return h(
    "section",
    { class: CLASS, "data-report": from },
    h("h2", null, t(lang, "wcag_title")),
    h(
      "p",
      { class: `${CLASS}-summary` },
      t(lang, "wcag_summary", {
        total: formatNumber(lang, checks.length),
        automated: formatNumber(lang, counts.automated),
        manual: formatNumber(lang, counts.manual),
        na: formatNumber(lang, counts["not-applicable"]),
      }),
    ),
    ...PRINCIPLES.flatMap((principle) => {
      const rows = byPrinciple(checks, principle);
      if (rows.length === 0) return [];
      const label = t(lang, `wcag_principle_${principle}`);
      return [
        h("h3", null, label),
        h(
          "div",
          { class: `${CLASS}-scroll`, role: "region", "aria-label": label, tabIndex: 0 },
          h(
            "table",
            { class: `${CLASS}-table` },
            h("caption", { class: `${CLASS}-caption` }, label),
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                h("th", { scope: "col" }, t(lang, "wcag_criterion")),
                h("th", { scope: "col" }, t(lang, "wcag_level")),
                h("th", { scope: "col" }, t(lang, "wcag_how")),
                h("th", { scope: "col" }, t(lang, "wcag_notes")),
                h("th", { scope: "col" }, t(lang, "wcag_checked")),
              ),
            ),
            h(
              "tbody",
              null,
              ...rows.map((check) => {
                const recorded = checkedCell(lang, check);
                return h(
                  "tr",
                  null,
                  h(
                    "td",
                    null,
                    safeHref(check.url) === undefined
                      ? [h("code", { dir: "ltr" }, check.id), " ", check.name]
                      : h("a", { href: safeHref(check.url) as string }, h("code", { dir: "ltr" }, check.id), " ", check.name),
                  ),
                  h("td", null, check.level),
                  h("td", null, t(lang, `wcag_how_${check.how.replace("-", "_")}`)),
                  h("td", null, check.notes),
                  h("td", null, recorded),
                );
              }),
            ),
          ),
        ),
      ];
    }),
  );
};

export default wcagChecklist;
