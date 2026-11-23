import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps, PreparedReport, ReportFinding, ReportPagination, ReportRun, ReportSeries, ReportSeverity } from "@velella/mizzen/contracts";
import { formatNumber } from "../../src/report.ts";
import chartData from "../../components/chart-data/index.ts";
import { renderLineChart } from "../../components/line-chart/index.ts";
import status from "../../components/status/index.ts";
import table from "../../components/table/index.ts";

const severityLabels: Record<ReportSeverity, string> = {
  error: "Error", warning: "Warning", info: "Information", unknown: "Unknown",
};
const severityTones = { error: "negative", warning: "caution", info: "info", unknown: "neutral" } as const;

function reportTable(caption: string, headings: readonly string[], rows: readonly ComponentChildren[][]) {
  return table({
    caption,
    children: [
      h("thead", null, h("tr", null, headings.map((heading) => h("th", { scope: "col", key: heading }, heading)))),
      h("tbody", null, rows.map(([first, ...rest], index) =>
        h("tr", { key: index }, h("th", { scope: "row" }, first), rest.map((value) => h("td", null, value))))),
    ],
  });
}

function evidence(links: readonly string[] | undefined) {
  if (links === undefined || links.length === 0) return null;
  return h("ul", null, links.map((href, index) =>
    h("li", { key: index }, h("a", { href }, links.length === 1 ? "View evidence" : `View evidence ${index + 1}`))));
}

function findingSummary(finding: ReportFinding | undefined): ComponentChildren {
  if (finding === undefined) return "Absent";
  const location = finding.location;
  return [
    h("p", null, finding.message),
    finding.rule === undefined ? null : h("code", null, finding.rule),
    location === undefined ? null : h("p", null, [
      location.path, location.line === undefined ? "" : `:${location.line}`, location.column === undefined ? "" : `:${location.column}`,
    ]),
    evidence(finding.evidence),
  ];
}

function severity(finding: ReportFinding | undefined, { site, page, renderComponent }: LayoutProps): ComponentChildren {
  if (finding === undefined) return "Absent";
  return [
    status({ inline: false, renderComponent, props: { tone: severityTones[finding.severity], label: severityLabels[finding.severity] }, site, page, html: "" }) as ComponentChildren,
    finding.originalSeverity === undefined ? null : h("span", null, ` (${finding.originalSeverity})`),
  ];
}

function pagination({ page, pages, previous, next }: ReportPagination) {
  if (pages < 2) return null;
  return h("nav", { "aria-label": "Report pages" },
    h("p", null, `Page ${page} of ${pages}`),
    h("ul", null, [
      previous === undefined ? null : h("li", null, h("a", { href: previous, rel: "prev" }, "Previous page")),
      next === undefined ? null : h("li", null, h("a", { href: next, rel: "next" }, "Next page")),
    ]),
  );
}

function runView(run: ReportRun, view: ReportPagination, props: LayoutProps) {
  const { lang } = props.page;
  return [
    h("p", null, `Coverage: ${run.coverage}.`),
    h("dl", null, [
      h("dt", null, "Producer"), h("dd", null, run.toolVersion === undefined ? run.tool : `${run.tool} ${run.toolVersion}`),
      h("dt", null, "Scope"), h("dd", null, run.scope),
      run.date === undefined ? null : [h("dt", null, "Recorded"), h("dd", null, h("time", { dateTime: run.date }, run.date))],
      run.revision === undefined ? null : [h("dt", null, "Revision"), h("dd", null, h("code", null, run.revision))],
    ]),
    evidence(run.evidence),
    h("h2", null, "Findings"),
    run.findings.length === 0
      ? h("p", null, run.coverage === "complete" ? "No findings in this run." : "This run has no recorded findings and its coverage is incomplete.")
      : reportTable("Recorded findings", ["Severity", "Finding"], run.findings.slice(view.start, view.end)
        .map((finding) => [severity(finding, props), findingSummary(finding)])),
    pagination(view),
    view.page === 1 && run.checks.length > 0
      ? reportTable("Check outcomes", ["Check", "Outcome", "Detail"], run.checks.map(({ id, status, detail }) => [id, status, detail ?? "—"]))
      : null,
    view.page === 1 && run.metrics.length > 0
      ? reportTable("Measurements", ["Metric", "Value", "Unit", "Limit"], run.metrics.map(({ id, value, unit, limit }) =>
        [id, formatNumber(lang, value), unit, limit === undefined ? "—" : formatNumber(lang, limit)]))
      : null,
  ];
}

function comparisonView(report: PreparedReport, view: Extract<NonNullable<LayoutProps["page"]["reportView"]>, { kind: "comparison" }>, props: LayoutProps) {
  const comparison = report.comparisons.find(({ base, head }) => base === view.base && head === view.head);
  if (comparison === undefined) return null;
  const base = report.runs.find(({ id }) => id === comparison.base);
  const head = report.runs.find(({ id }) => id === comparison.head);
  return [
    h("ul", null, [
      h("li", null, h("a", { href: base?.url }, `Before: ${comparison.base}`)),
      h("li", null, h("a", { href: head?.url }, `After: ${comparison.head}`)),
    ]),
    comparison.state === "different-scope" ? h("p", null, "These runs have different tools or scopes.") : null,
    comparison.state === "incomplete" ? h("p", null, "At least one run has incomplete coverage. Finding changes cannot be determined.") : null,
    comparison.state === "comparable" && comparison.changes.length === 0 ? h("p", null, "Neither run recorded findings.") : null,
    comparison.changes.length === 0 ? null : reportTable("Finding comparison", ["Change", "Before", "After"],
      comparison.changes.slice(view.start, view.end).map(({ kind, before, after }) => [
        kind === "new" ? "New" : kind === "resolved" ? "Resolved" : kind === "changed" ? "Changed" : "Unchanged",
        before === undefined ? "Absent" : [severity(before, props), findingSummary(before)],
        after === undefined ? "Absent" : [severity(after, props), findingSummary(after)],
      ])),
    pagination(view),
  ];
}

function trend(series: readonly ReportSeries[], id: string, { page, site }: LayoutProps) {
  const first = series[0]!;
  const title = first.kind === "findings" ? "Findings by severity" : `${first.id} (${first.unit})`;
  const columns = series.map(({ kind, id }) => kind === "findings" ? severityLabels[id as ReportSeverity] : id);
  const rows = first.points.map(({ run, date }, index) => ({
    id: run,
    label: date === null ? `${run} (date unavailable)` : `${run} (${date})`,
    values: series.map(({ points }) => points[index]?.value ?? undefined),
  }));
  if (!rows.some(({ values }) => values.some((value) => value !== undefined))) {
    return chartData({ title, description: "No dated measurements are available for this series.", labelHeading: "Run and date", columns, rows, lang: page.lang });
  }
  const fields = columns.map((_, index) => `series-${index + 1}`);
  return renderLineChart(
    {
      from: "report-trend", category: "Run number", value: fields.join(","),
      title, id: `report-trend-${id}`,
    },
    rows.map(({ values }, index) => ({
      "Run number": index + 1,
      ...Object.fromEntries(fields.map((column, index) => [column, values[index] ?? null])),
    })),
    { site, page, data: { labelHeading: "Run and date", columns, rows } },
  );
}

function overview(report: PreparedReport, props: LayoutProps) {
  const groups = Map.groupBy(report.series, ({ tool, scope }) => JSON.stringify([tool, scope]));
  return [
    h("h2", null, "Runs"),
    h("ul", null, report.runs.map(({ url, id, date, coverage }) =>
      h("li", { key: url }, h("a", { href: url }, id),
        date === undefined ? null : [" ", h("time", { dateTime: date }, date)], ` (${coverage} coverage)`))),
    report.comparisons.length === 0 ? null : [
      h("h2", null, "Compare runs"),
      h("ul", null, report.comparisons.map(({ url, base, head }) =>
        h("li", { key: url }, h("a", { href: url }, `${base} to ${head}`)))),
    ],
    h("h2", null, "Trends"),
    ...[...groups.values()].map((series, group) => {
      const first = series[0]!;
      const findings = series.filter(({ kind }) => kind === "findings");
      const metrics = series.filter(({ kind }) => kind === "metric");
      return h("section", { key: group },
        h("h3", null, `${first.tool} · ${first.scope}`),
        ...[findings, ...metrics.map((metric) => [metric])].map((items, index) => trend(items, `${group}-${index}`, props)),
      );
    }),
  ];
}

/** Render a generated report view from the prepared Mizzen model. */
export default function reportViewer(props: LayoutProps) {
  const report = props.site.checkReport;
  const view = props.page.reportView;
  if (report === undefined || view === undefined) return null;
  const run = view.kind === "run" ? report.runs.find(({ id }) => id === view.id) : undefined;
  return h("div", { class: "report-viewer", "data-report-view": view.kind },
    h("p", null, [
      view.kind === "overview" ? null : [h("a", { href: report.url }, "All runs and trends"), " · "],
      h("a", { href: report.jsonUrl, type: "application/json" }, "Download report data (JSON)"),
    ]),
    view.kind === "overview" ? overview(report, props)
      : view.kind === "comparison" ? comparisonView(report, view, props)
        : run === undefined ? null : runView(run, view, props),
  );
}
