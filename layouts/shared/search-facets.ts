import { h } from "preact";
import type { LayoutProps, Site } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { isPublicField } from "../../src/public-fields.ts";
import { withBase } from "../../src/url.ts";

export interface SearchFacets {
  readonly url: string;
  readonly sorts: readonly string[];
}

/** Facets are published only for indexed records. Sort names come from public collection config. */
export function searchFacetsOf(site: Site): SearchFacets | undefined {
  if (site.config.search === false) return undefined;
  const collections = new Set<string>();
  for (const page of site.pages) {
    if (page.kind !== "doc" || page.frontMatter.search === false || page.record === undefined || page.record.view !== undefined) continue;
    collections.add(page.record.collection);
  }
  if (collections.size === 0) return undefined;
  const sorts = new Set<string>();
  for (const name of collections) {
    for (const field of site.config.collections?.[name]?.search?.sort ?? []) {
      if (isPublicField(site, name, field)) sorts.add(field);
    }
  }
  return { url: withBase(site.config.base, "/search-facets.json"), sorts: [...sorts].sort() };
}

/** The filter list is populated from the build's facets file. Sort fields are known at render time. */
export function searchFacetControls({ page }: LayoutProps, facets: SearchFacets) {
  const lang = page.lang;
  return h(
    "fieldset",
    { class: "search-facets", "data-search-facets": "", hidden: true },
    h("legend", null, t(lang, "gallery_filters")),
    h("div", { class: "search-facet-fields", "data-search-facet-fields": "" }),
    facets.sorts.length === 0 ? null : h(
      "div",
      { class: "search-facet-fields", "data-search-sort-fields": "" },
      h(
        "label",
        null,
        t(lang, "gallery_sort"),
        h("select", { name: "sort" },
          h("option", { value: "" }, t(lang, "search_sort_relevance")),
          ...facets.sorts.map((field) => h("option", { value: field }, field)),
        ),
      ),
      h(
        "label",
        null,
        t(lang, "search_sort_order"),
        h("select", { name: "order", disabled: true },
          h("option", { value: "asc" }, t(lang, "data_explorer_sort_ascending")),
          h("option", { value: "desc" }, t(lang, "data_explorer_sort_descending")),
        ),
      ),
    ),
  );
}

/** The faceted form is a native GET form. Keep its selected values and omit empty parameters. */
export function facetScript(facets: SearchFacets, messages: { any: string; collection: string }): string {
  const config = JSON.stringify({ ...facets, ...messages }).replace(/</g, "\\u003c");
  return `/* facet-path:start */
const facetConfig = ${config};
const params = new URLSearchParams(location.search);
const filterPrefix = "filter.";
const filters = Object.fromEntries([...params].flatMap(([name, value]) =>
  name.startsWith(filterPrefix) && name.length > filterPrefix.length && value !== ""
    ? [[name.slice(filterPrefix.length), value]]
    : []));
const sortField = params.get("sort");
const sortOrder = params.get("order") === "desc" ? "desc" : "asc";
const selectedSort = scope !== "all" && facetConfig.sorts.includes(sortField) ? sortField : undefined;
const searchOptions = { filters, ...(selectedSort ? { sort: { [selectedSort]: sortOrder } } : {}) };
const facetPanel = root?.querySelector("[data-search-facets]");
const filterList = facetPanel?.querySelector("[data-search-facet-fields]");
const sortFields = facetPanel?.querySelector("[data-search-sort-fields]");
const sort = facetPanel?.querySelector('select[name="sort"]');
const order = facetPanel?.querySelector('select[name="order"]');
const toggleSort = () => {
  const local = root?.querySelector('input[name="scope"]:checked')?.value !== "all";
  if (sortFields) sortFields.hidden = !local;
  if (sort) sort.disabled = !local;
  if (order) order.disabled = !local || !sort?.value;
  if (facetPanel) facetPanel.hidden = !filterList?.childElementCount && (!sort || !local);
};
if (sort) sort.value = selectedSort ?? "";
if (order) order.value = sortOrder;
toggleSort();
facetPanel?.closest("form")?.addEventListener("change", toggleSort);
facetPanel?.closest("form")?.addEventListener("formdata", (event) => {
  for (const [name, value] of [...event.formData]) {
    if ((name.startsWith(filterPrefix) || name === "sort") && value === "") event.formData.delete(name);
  }
});
if (filterList) fetch(facetConfig.url)
  .then((response) => response.ok ? response.json() : undefined)
  .then((file) => {
    if (file?.query?.filter !== "filter.{field}" || typeof file.filters !== "object" || file.filters === null) return;
    const number = new Intl.NumberFormat(lang);
    for (const [field, counts] of Object.entries(file.filters)) {
      if (!field || !counts || typeof counts !== "object" || Array.isArray(counts)) continue;
      const choices = Object.entries(counts).filter(([value, count]) =>
        value && Number.isSafeInteger(count) && count > 0);
      if (choices.length === 0) continue;
      const label = document.createElement("label");
      label.textContent = field === "collection" ? facetConfig.collection : field;
      const select = document.createElement("select");
      select.name = filterPrefix + field;
      const any = document.createElement("option");
      any.value = "";
      any.textContent = facetConfig.any;
      select.append(any);
      for (const [value, count] of choices) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value + " (" + number.format(count) + ")";
        select.append(option);
      }
      if (Object.hasOwn(filters, field)) {
        const selected = filters[field];
        if (!choices.some(([value]) => value === selected)) {
          const option = document.createElement("option");
          option.value = selected;
          option.textContent = selected;
          select.append(option);
        }
        select.value = selected;
      }
      label.append(select);
      filterList.append(label);
    }
    toggleSort();
  })
  .catch(() => {});
/* facet-path:end */`;
}
