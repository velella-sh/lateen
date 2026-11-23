import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Island, LayoutProps } from "@velella/mizzen/contracts";
import collectionApiSchema from "../components/collection-api-schema/index.ts";
import { t } from "../i18n/index.ts";

/** Links to Mizzen's newest active API version for this collection, with a deprecated fallback. */
export function collectionApi({ page, site, record, list, islands, renderComponent }: LayoutProps): ComponentChildren {
  const api = site.config?.api;
  const name = record?.collection ?? list?.collection;
  if (api === undefined || name === undefined || site.config.outputs?.api === false) return null;
  if (!Object.hasOwn(site.collections, name)) return null;

  const collection = site.config.collections[name];
  const lifecycle = collection?.lifecycle;
  if (record !== undefined && lifecycle?.retired?.length && !lifecycle.machine) {
    // Layout fields can be localized and filtered. Mizzen uses the source field for lifecycle decisions.
    const source = site.collections[name]?.records.find(({ id }) => id === record.id);
    const value = source?.fields[lifecycle.field ?? "state"];
    const state = typeof value === "number" ? String(value) : value;
    if (typeof state === "string" && state !== "" && lifecycle.retired.includes(state)) return null;
  }

  const versions = [
    { version: api.version, collections: api.collections, deprecated: false },
    ...Object.entries(api.versions ?? {}).map(([version, entry]) => ({ version, ...entry })),
  ];
  const selected = versions
    .filter(({ collections }) => Object.hasOwn(collections, name))
    .sort((a, b) => Number(a.deprecated ?? false) - Number(b.deprecated ?? false)
      || Number(b.version.slice(1)) - Number(a.version.slice(1)))[0];
  if (selected === undefined) return null;

  const prefix = `${site.config.base.replace(/\/+$/, "")}/api/${selected.version}`;
  const segment = encodeURIComponent(name);
  const schema = record === undefined && collection?.schema !== undefined
    ? collectionApiSchema({
        inline: false, renderComponent,
        page,
        site,
        html: "",
        props: { index: `${prefix}/index.json`, schema: `${prefix}/schemas/${segment}.json` },
      }) as ComponentChildren
    : null;
  if (schema !== null) {
    // Mizzen writes the client modules named by the rendered layout.
    (islands as Island[]).push({
      name: "collection-api-schema",
      src: `${site.config.base}/assets/theme/islands/components/collection-api-schema/client.js`,
    });
  }
  const files = record === undefined
    ? [
        [`${segment}.json`, "data_api_json"],
        [`${segment}.ndjson`, "data_api_ndjson"],
        ["openapi.json", "data_api_openapi"],
      ] as const
    : [[`${segment}/${encodeURIComponent(record.id)}.json`, "data_api_record_json"]] as const;
  const id = "collection-api";
  return h(
    "section",
    { "aria-labelledby": id },
    h("h2", { id },
      t(page.lang, "data_api_heading", { version: selected.version }),
      selected.deprecated ? ` (${t(page.lang, "deprecated")})` : null,
    ),
    h("ul", null,
      files.map(([path, label]) => h("li", null, h("a", { href: `${prefix}/${path}` }, t(page.lang, label)))),
      schema,
    ),
  );
}
