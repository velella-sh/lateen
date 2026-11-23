import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import { t } from "../i18n/index.ts";
import { withBase } from "./url.ts";

/**
 * Raw JSON is written by collection-json, and CSV and checksums by collection-csv. `inline` draws
 * the group for the Page tools panel: a label instead of a heading, so the panel adds no entry to
 * the page's outline.
 */
export function collectionDownloads({ page, site, record, list }: LayoutProps, options: { readonly inline?: boolean } = {}): ComponentChildren {
  const name = record?.collection ?? list?.collection;
  if (name === undefined || !Object.hasOwn(site.collections, name)) return null;
  const collection = site.config.collections?.[name];
  if (collection === undefined || collection.raw === false) return null;

  const { outputs, base } = site.config;
  const files = [];
  if (outputs?.["collection-json"] !== false) files.push({ suffix: "raw.json", label: t(page.lang, "download_json") });
  if (outputs?.["collection-csv"] !== false) {
    files.push({ suffix: "csv", label: t(page.lang, "download_csv") }, { suffix: "sha256", label: t(page.lang, "download_checksums") });
  }
  if (files.length === 0) return null;

  const id = "collection-downloads";
  return h(
    "section",
    { "aria-labelledby": id },
    options.inline === true
      ? h("p", { id, class: "page-tools-heading" }, t(page.lang, "download_data"))
      : h("h2", { id }, t(page.lang, "download_data")),
    h("ul", null, files.map(({ suffix, label }) => {
      const filename = `${name}.${suffix}`;
      return h(
        "li",
        null,
        label,
        " ",
        h("a", { href: withBase(base, `/data/${encodeURIComponent(name)}.${suffix}`), download: true }, h("bdi", { dir: "ltr" }, filename)),
      );
    })),
  );
}
