import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import { KEY_CLASS, LIST_CLASS, LONG_VALUE_CLASS, VALUE_CLASS } from "../components/key-value/index.ts";
import { t } from "../i18n/index.ts";
import { formatField } from "./fields.ts";

/** Provenance is shown only for a collection with a recorded snapshot. */
export function snapshotPanel({ page, site, record, list }: LayoutProps): ComponentChildren {
  const name = record?.collection ?? list?.collection;
  const snapshot = name === undefined ? undefined : site.collections[name]?.snapshot;
  if (snapshot === undefined) return null;

  const { lang } = page;
  const schema = snapshot.schema;
  const entries: readonly [string, ComponentChildren][] = [
    [t(lang, "snapshot_source"), snapshot.source],
    [t(lang, "snapshot_ref"), snapshot.ref],
    [t(lang, "snapshot_captured_at"), snapshot.capturedAt === undefined
      ? undefined
      : formatField(snapshot.capturedAt, "date", lang, site.config)],
    [t(lang, "snapshot_tool"), snapshot.tool],
    [t(lang, "snapshot_tool_version"), snapshot.toolVersion],
    [t(lang, "snapshot_schema"), schema === undefined ? undefined : `${schema.file} (${schema.version})`],
  ];

  return h(
    "details",
    { class: "details snapshot-panel" },
    h("summary", null, t(lang, "snapshot_panel")),
    h("dl", { class: LIST_CLASS }, entries.map(([label, value]) => value === undefined ? null : h(
      Fragment,
      null,
      h("dt", { class: KEY_CLASS }, label),
      h("dd", { class: `${VALUE_CLASS} ${LONG_VALUE_CLASS}` }, h("bdi", null, value)),
    ))),
  );
}
