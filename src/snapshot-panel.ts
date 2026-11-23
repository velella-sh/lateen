import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import { KEY_CLASS, LIST_CLASS, LONG_VALUE_CLASS, VALUE_CLASS } from "../components/key-value/index.ts";
import { t } from "../i18n/index.ts";
import { formatField } from "./fields.ts";
import { publicFieldsOf } from "./public-fields.ts";

/** Provenance is shown only for a collection with a recorded snapshot. */
export function snapshotPanel({ page, site, record, list }: LayoutProps): ComponentChildren {
  const name = record?.collection ?? list?.collection;
  if (name === undefined) return null;
  const snapshot = site.collections[name]?.snapshot;
  if (snapshot === undefined) return null;

  const { lang } = page;
  const schema = snapshot.schema;
  const fields = Object.entries(schema?.fields ?? {});
  // Project scalar markers so a nested allowance cannot expose a whole field's constraints.
  const publicFields = publicFieldsOf(site, name, Object.fromEntries(fields.map(([field]) => [field, true])));
  const schemaFields = fields
    .filter(([field]) => Object.hasOwn(publicFields, field))
    .sort(([left], [right]) => left.localeCompare(right, "en"));
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
    schemaFields.length === 0 ? null : h(
      "details",
      { class: "snapshot-schema-fields field-list-more" },
      h("summary", null, t(lang, "snapshot_schema_fields")),
      h("dl", { class: LIST_CLASS }, schemaFields.map(([field, spec]) => h(
        Fragment,
        { key: field },
        h("dt", { class: KEY_CLASS }, h("bdi", null, field)),
        h(
          "dd",
          { class: `${VALUE_CLASS} ${LONG_VALUE_CLASS}` },
          h("bdi", null, spec.type ?? t(lang, "snapshot_schema_type_unspecified")),
          " · ",
          t(lang, spec.required ? "required" : "snapshot_schema_optional"),
          spec.enum === undefined ? null : h(
            Fragment,
            null,
            " · ",
            t(lang, "snapshot_schema_allowed_values"),
            " ",
            h("bdi", { dir: "ltr" }, JSON.stringify(spec.enum)),
          ),
        ),
      ))),
    ),
  );
}
