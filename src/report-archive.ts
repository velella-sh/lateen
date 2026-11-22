import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps, Page, RecordProps } from "@velella/mizzen/contracts";
import { CARD_CLASS } from "../components/cards/index.ts";
import { t } from "../i18n/index.ts";
import { calendarDate, configuredCalendar } from "./dates.ts";
import { formatField } from "./fields.ts";
import { isRecord, textOf } from "./guards.ts";
import { publicFieldsOf } from "./public-fields.ts";
import { commitUrlOf } from "./repository.ts";
import { safeHref, withBase } from "./url.ts";

/** A run's public source fields, as published by the report archive recipe. */
function runOf(props: LayoutProps, record: RecordProps) {
  const fields = publicFieldsOf(props.site, record.collection, record.fields);
  const value = textOf(fields.date);
  const commit = textOf(fields.commit);
  const date = value === undefined ? undefined : calendarDate(value, props.page.lang, configuredCalendar(props.site.config));
  return date === undefined || date.datetime.length !== 10 || commit === undefined
    ? undefined
    : { date, commit, fields };
}

/** The latest list defines the current run, including when the gallery is filtered or paginated. */
export function latestReportOf(props: LayoutProps, collection: string): Page | undefined {
  const { site, page } = props;
  const archive = isRecord(page.frontMatter.reportArchive) ? page.frontMatter.reportArchive : undefined;
  const configured = safeHref(archive?.latest);
  return site.pages.find((candidate) => {
    const list = candidate.list;
    const first = list?.records[0];
    if (candidate.lang !== page.lang || list?.collection !== collection || list.pagination.page !== 1 || first === undefined) return false;
    const matches = configured === undefined
      ? /\/latest\/?$/.test(candidate.url)
      : candidate.url === withBase(site.config.base, configured);
    return matches && runOf(props, first) !== undefined;
  });
}

/** The stable latest URL is also available to older archived records. */
export function reportArchiveNotice(props: LayoutProps): ComponentChildren {
  const { record, page } = props;
  if (record === undefined || page.record?.view !== undefined || runOf(props, record) === undefined) return null;
  const gallery = props.site.pages.find((candidate) =>
    candidate.lang === page.lang && candidate.frontMatter.layout === "gallery" &&
    candidate.list?.collection === record.collection && isRecord(candidate.frontMatter.reportArchive),
  );
  const latest = latestReportOf(gallery === undefined ? props : { ...props, page: gallery }, record.collection);
  return latest === undefined || latest.url === page.url ? null : h(
    "p",
    { class: "report-archive-notice", role: "note" },
    h("a", { href: latest.url }, t(page.lang, "report_archive_view_latest")),
  );
}

/** Only data stored with the run can describe its pinned inputs across rebuilds. */
function pinnedInputs(inputs: unknown, props: LayoutProps): ComponentChildren {
  if (!isRecord(inputs)) return null;
  const schema = isRecord(inputs.schema) ? inputs.schema : undefined;
  const schemaFile = textOf(schema?.file);
  const schemaVersion = textOf(schema?.version);
  const entries = [
    ["snapshot_source", textOf(inputs.source)],
    ["snapshot_ref", textOf(inputs.ref)],
    ["snapshot_captured_at", textOf(inputs.capturedAt)],
    ["snapshot_tool", textOf(inputs.tool)],
    ["snapshot_tool_version", textOf(inputs.toolVersion)],
    ["snapshot_schema", schemaFile === undefined ? undefined : [schemaFile, schemaVersion].filter(Boolean).join(" · ")],
  ] as const;
  const rows = entries.flatMap(([label, value]) => value === undefined
    ? []
    : [h("dt", null, t(props.page.lang, label)), h("dd", null, h("bdi", null, value))]);
  return rows.length === 0 ? null : h(
    "details",
    { class: "details report-run-inputs" },
    h("summary", null, t(props.page.lang, "report_archive_inputs")),
    h("dl", null, rows),
  );
}

/** A report card links to the archived run and its commit as separate actions. */
export function reportRunCard(
  props: LayoutProps,
  record: RecordProps,
  latestId: string,
  inputs: unknown,
) {
  const run = runOf(props, record);
  if (run === undefined) return undefined;
  const { date, commit, fields } = run;
  const lang = props.page.lang;
  const repository = props.site.config.repository;
  const commitUrl = repository === undefined ? undefined : commitUrlOf(repository, commit);
  const name = textOf(fields.title) ?? record.id;
  const href = safeHref(record.url);
  const revision = h("code", { dir: "ltr", title: commit }, commit.slice(0, 7));
  return {
    date: date.datetime,
    card: h(
      "div",
      { class: `${CARD_CLASS} report-run` },
      href === undefined
        ? h("span", { class: "card-title" }, name)
        : h("a", { class: "card-title", href, "data-report-run-link": "" }, name),
      record.id === latestId ? h("span", { class: "version-badge" }, t(lang, "report_archive_latest")) : null,
      h("time", { datetime: date.datetime }, date.text),
      h(
        "div",
        { class: "report-run-commit" },
        t(lang, "a11y_report_commit"),
        " ",
        commitUrl === undefined ? revision : h("a", { href: commitUrl }, revision),
      ),
      fields.status === undefined ? null : formatField(fields.status, "status", lang, props.site.config),
      pinnedInputs(fields.inputs ?? inputs, props),
    ),
  };
}
