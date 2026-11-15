import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import {
  IMPACTS,
  a11yReportOf,
  commitHref,
  formatNumber,
  safeHref,
  type A11yReport,
  type Impact,
} from "../../src/report.ts";

/** The Markdown directive this component handles: `::a11y-report{from=…}`. */
export const directive = "a11y-report";

/** Default key in `site.data` when the directive names no `from`. */
export const DEFAULT_FROM = "accessibility-report";

export const OPTIONS = ["from"] as const;

export const CLASS = "a11y-report";

export type A11yReportProps = {
  /** Dot-separated key in `site.data` that holds the report; defaults to `accessibility-report`. */
  readonly from?: string;
};

/** A table inside a keyboard-scrollable region, so a wide matrix does not force the page sideways. */
function table(label: string, head: readonly string[], rows: readonly (readonly unknown[])[]) {
  return h(
    "div",
    { class: `${CLASS}-scroll`, role: "region", "aria-label": label, tabIndex: 0 },
    h(
      "table",
      { class: `${CLASS}-table` },
      h("caption", { class: `${CLASS}-caption` }, label),
      h("thead", null, h("tr", null, ...head.map((text) => h("th", { scope: "col" }, text)))),
      h(
        "tbody",
        null,
        ...rows.map((cells) => h("tr", null, ...cells.map((cell) => h("td", null, cell as never)))),
      ),
    ),
  );
}

/** "light" and "dark" in the page language. */
const themeLabel = (lang: string, theme: string): string =>
  t(lang, theme === "dark" ? "theme_dark" : "theme_light");

/** The rule name, linked to axe's help page when the report carries one. */
function ruleCell(finding: A11yReport["findings"][number]) {
  const href = safeHref(finding.helpUrl);
  return h("code", { dir: "ltr" }, href === undefined ? finding.rule : h("a", { href }, finding.rule));
}

/**
 * The accessibility report of one commit: what the gate ran, every finding by impact, the baseline
 * findings that are still open, and the keyboard and no-JavaScript journeys with their result. It
 * reads `site.data` and shows a visible message when the report is absent, so a page never reads as
 * a clean pass just because the gate did not run. No score and no "conforms" claim: only what was
 * tested and what was found.
 */
const a11yReport: Component<A11yReportProps> = ({ props, site, page }) => {
  const from = typeof props.from === "string" && props.from.trim() !== "" ? props.from.trim() : DEFAULT_FROM;
  const report = a11yReportOf(site, from);
  const lang = page.lang;
  if (report === undefined) {
    return h(
      "p",
      { class: "report-missing", role: "note", "data-report": from },
      t(lang, "report_missing", { name: from }),
    );
  }

  const commit = commitHref(site.config, report.commit);
  const states = formatNumber(lang, report.summary.states);
  const impactRows = IMPACTS.map((impact: Impact) => [
    t(lang, `impact_${impact}`),
    formatNumber(lang, report.summary.findings[impact]),
  ]);

  return h(
    "section",
    { class: CLASS, "data-report": from },
    h("h2", null, t(lang, "a11y_report_title")),
    h(
      "p",
      { class: `${CLASS}-summary` },
      t(lang, "a11y_report_summary", { states }),
      " ",
      h(
        "span",
        { class: `${CLASS}-commit` },
        `${t(lang, "a11y_report_commit")}: `,
        commit === undefined ? h("code", { dir: "ltr" }, report.commit) : h("a", { href: commit, dir: "ltr" }, h("code", null, report.commit)),
      ),
    ),
    h(
      "p",
      { class: `${CLASS}-tools` },
      `${t(lang, "a11y_report_tools")}: `,
      report.tools.map((tool) => `${tool.name} ${tool.version}`).join(" · "),
    ),
    report.rules.length === 0
      ? null
      : h("p", { class: `${CLASS}-rules` }, `${t(lang, "a11y_report_rules")}: `, h("code", { dir: "ltr" }, report.rules.join(", "))),
    h("h3", null, t(lang, "a11y_report_matrix")),
    table(
      t(lang, "a11y_report_matrix"),
      [t(lang, "a11y_report_case"), t(lang, "a11y_report_layout"), t(lang, "language"), t(lang, "a11y_report_theme")],
      report.matrix.map((item) => [item.case, h("code", { dir: "ltr" }, item.layout), item.lang, themeLabel(lang, item.theme)]),
    ),
    h("h3", null, t(lang, "a11y_report_findings")),
    table(t(lang, "a11y_report_findings"), [t(lang, "a11y_report_finding_impact"), t(lang, "a11y_report_finding_count")], impactRows),
    report.findings.length === 0
      ? h("p", { class: `${CLASS}-none` }, t(lang, "a11y_report_findings_none"))
      : table(
          t(lang, "a11y_report_findings"),
          [
            t(lang, "a11y_report_case"),
            t(lang, "a11y_report_theme"),
            t(lang, "a11y_report_finding_impact"),
            t(lang, "a11y_report_rule"),
            t(lang, "a11y_report_target"),
            t(lang, "a11y_report_help"),
          ],
          report.findings.map((finding) => [
            finding.case,
            themeLabel(lang, finding.theme),
            t(lang, `impact_${finding.impact}`),
            ruleCell(finding),
            h("code", { dir: "ltr" }, finding.target),
            finding.help,
          ]),
        ),
    h("h3", null, t(lang, "a11y_report_known")),
    report.known.length === 0
      ? h("p", { class: `${CLASS}-none` }, t(lang, "a11y_report_known_none"))
      : table(
          t(lang, "a11y_report_known"),
          [t(lang, "a11y_report_case"), t(lang, "a11y_report_theme"), t(lang, "a11y_report_rule"), t(lang, "a11y_report_target")],
          report.known.map((known) => [
            known.case === "*" ? t(lang, "a11y_report_every_case") : known.case,
            themeLabel(lang, known.theme),
            h("code", { dir: "ltr" }, known.rule),
            h("code", { dir: "ltr" }, known.target),
          ]),
        ),
    report.journeys.length === 0
      ? null
      : [
          h("h3", null, t(lang, "a11y_report_journeys")),
          table(
            t(lang, "a11y_report_journeys"),
            [t(lang, "a11y_report_journey"), t(lang, "a11y_report_theme"), t(lang, "a11y_report_journey_result")],
            report.journeys.map((journey) => [
              journey.name,
              themeLabel(lang, journey.theme),
              journey.detail === undefined
                ? t(lang, `a11y_report_result_${journey.result}`)
                : `${t(lang, `a11y_report_result_${journey.result}`)}: ${journey.detail}`,
            ]),
          ),
        ],
  );
};

export default a11yReport;
