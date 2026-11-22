import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Heading, Island, Layout, LayoutProps, RecordProps } from "@velella/mizzen/contracts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import toc from "../chrome/toc/index.ts";
import cards from "../components/cards/index.ts";
import galleryFilters, { type GalleryFacet } from "../components/gallery-filters/index.ts";
import {
  actionOf, DATE_FROM_PARAM, DATE_THROUGH_PARAM, searchOf, selectedOf, sortOf, type GallerySort,
} from "../components/gallery-filters/island.ts";
import { formatCount } from "../components/reading-time/index.ts";
import { addCardOf } from "../components/gallery-card/add-card.ts";
import { patternOf, t } from "../i18n/index.ts";
import { isPublicField, publicFieldsOf } from "../src/public-fields.ts";
import { latestReportOf, reportRunCard } from "../src/report-archive.ts";
import { baseOf } from "../src/url.ts";
import { pageHtml } from "../src/article-html.ts";
import { cardOf, groupsOf } from "./shared/record-list.ts";
import { articleShell, titleFromBody } from "./shared/index.ts";

/* A gallery page names no directive, so the engine does not ship its island. The island reads only
   the links and cards in the page, and the links work on their own.
   shortcut: the island path is the engine's convention; revisit when a layout can declare a client. */
const FILTER_ISLAND = "assets/theme/islands/components/gallery-filters/client.js";

/** Every option the gallery reads, in the order the docs page lists them. */
export const GALLERY_OPTIONS = [
  "list.collection",
  "collection.search.filters",
  "collection.search.sort",
  "theme.options.gallery.addCard",
  "reportArchive.latest",
] as const;

/** The configured fields as a list, ignoring a malformed value. */
function fieldsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((field): field is string => typeof field === "string" && field.trim() !== "") : [];
}

/** One field's values: an array gives one value per item, a scalar gives one, and empty gives none. */
function valuesOf(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return [...new Set(value.flatMap((item) => valuesOf(item)))];
  if (typeof value !== "object") return [String(value)];
  return [];
}

/** The facets the collection declares, with the number of its records that hold each value. */
function facetsOf(props: LayoutProps, list: NonNullable<LayoutProps["list"]>): GalleryFacet[] {
  const collection = props.site.config.collections?.[list.collection];
  const records = props.site.collections[list.collection]?.records ?? list.records;
  const fields: Readonly<Record<string, unknown>>[] = records.map((record) => ({ ...publicFieldsOf(props.site, list.collection, record.fields), id: record.id }));
  return fieldsOf(collection?.search?.filters).flatMap((field) => {
    const counts = new Map<string, number>();
    for (const recordFields of fields) {
      for (const value of valuesOf(recordFields[field])) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const values = [...counts.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([value, count]) => ({ value, count }));
    return values.length === 0 ? [] : [{ field, values }];
  });
}

/** The sort fields the collection declares, first as the default. */
function sortFieldsOf(props: LayoutProps, list: NonNullable<LayoutProps["list"]>): string[] {
  return fieldsOf(props.site.config.collections?.[list.collection]?.search?.sort)
    .filter((field) => isPublicField(props.site, list.collection, field));
}

/** The values one card carries for filtering and sorting, as JSON for the island. */
function cardValues(record: RecordProps, fields: readonly string[]): string {
  const values: Record<string, string[]> = {};
  for (const field of fields) {
    const found = valuesOf(record.fields[field]);
    if (found.length > 0) values[field] = found;
  }
  return JSON.stringify(values);
}

/** One record as the list layout's card, wrapped with the values its filters read. */
function cardItem(
  props: LayoutProps,
  record: RecordProps,
  fields: readonly string[],
  latestId: string | undefined,
  inputs: unknown,
): ComponentChildren {
  const run = latestId === undefined ? undefined : reportRunCard(props, record, latestId, inputs);
  return h(
    "div",
    {
      class: "gallery-item",
      "data-gallery-item": "",
      "data-gallery-values": cardValues(record, fields),
      "data-gallery-date": run?.date,
    },
    run?.card ?? cardOf(props, record),
  );
}

/** True when the record holds every chosen filter value. */
function passes(record: RecordProps, selected: ReadonlyMap<string, string>): boolean {
  for (const [field, value] of selected) {
    if (!valuesOf(record.fields[field]).includes(value)) return false;
  }
  return true;
}

/** The records in the chosen sort, empty values last and equal values in the order they came. */
function sorted(records: readonly RecordProps[], sort: GallerySort | undefined, lang: string): readonly RecordProps[] {
  if (sort === undefined) return records;
  return records
    .map((record, index) => ({ record, index, value: valuesOf(record.fields[sort.field])[0] ?? "" }))
    .sort((a, b) => {
      if (a.value === "" && b.value === "") return a.index - b.index;
      if (a.value === "") return 1;
      if (b.value === "") return -1;
      const compare = a.value.localeCompare(b.value, lang, { numeric: true });
      return (sort.direction === "desc" ? -compare : compare) || a.index - b.index;
    })
    .map(({ record }) => record);
}

function reportDates(props: LayoutProps): ComponentChildren {
  const lang = props.page.lang;
  return h(
    "form",
    { class: "report-archive-dates", "data-gallery-dates": "", method: "get", action: actionOf(props.page.url), hidden: true },
    h("label", null, t(lang, "report_archive_from"), h("input", { type: "date", name: DATE_FROM_PARAM })),
    h("label", null, t(lang, "report_archive_through"), h("input", { type: "date", name: DATE_THROUGH_PARAM })),
    h("button", { type: "submit", class: "btn" }, t(lang, "report_archive_apply")),
  );
}

/**
 * The records as a gallery: one responsive grid of the list layout's cards, in the chosen order,
 * inside a section per group when the list groups them. The filters and sort links are ordinary
 * addresses, and the island only filters in place when it runs.
 */
function article(props: LayoutProps, latestId: string | undefined): ComponentChildren {
  const list = props.list;
  const groups = groupsOf(props);
  const add = addCardOf(props.site.config);
  const facets = list === undefined ? [] : facetsOf(props, list);
  const sorts = list === undefined ? [] : sortFieldsOf(props, list);
  const selected = selectedOf(searchOf(props.page.url));
  const facetFields = new Set(facets.map((facet) => facet.field));
  for (const field of [...selected.keys()]) if (!facetFields.has(field)) selected.delete(field);
  const sort = sortOf(searchOf(props.page.url), sorts);
  const filterFields = [...new Set([...facets.map((facet) => facet.field), ...sorts])];
  const shownRecords = groups.length > 0 ? groups.flatMap((group) => group.records) : list?.records ?? [];
  const visible = sorted(shownRecords.filter((record) => passes(record, selected)), sort, props.page.lang);
  const total = shownRecords.length;
  const shown = visible.length;
  const inputs = new Map(
    latestId === undefined || list === undefined ? [] : (props.site.collections[list.collection]?.records ?? []).map(
      (record) => [record.id, publicFieldsOf(props.site, list.collection, record.fields).inputs],
    ),
  );

  /** The cards for one group; the site's own card closes the last group, or the one grid. */
  const view = (records: readonly RecordProps[], last: boolean): ComponentChildren => {
    const items = sorted(records.filter((record) => passes(record, selected)), sort, props.page.lang).map((record) =>
      cardItem(props, record, filterFields, latestId, inputs.get(record.id)),
    );
    if (add !== undefined && last) items.push(add as never);
    return items.length === 0 ? null : (cards({ children: items }) as ComponentChildren);
  };

  const grid: ComponentChildren =
    groups.length > 0
      ? groups.map((group, index) =>
          h(
            "section",
            { class: "gallery-group" },
            h("h2", { id: group.id }, group.key),
            view(group.records, index === groups.length - 1),
          ),
        )
      : list === undefined
        ? null
        : view(list.records, true);

  const controls =
    facets.length === 0 && sorts.length === 0
      ? null
      : galleryFilters({ facets, sorts, url: props.page.url, selected, sort, lang: props.page.lang });

  const countPattern = patternOf(props.page.lang, "gallery_showing");
  const count =
    list === undefined
      ? null
      : h(
          "p",
          {
            class: "gallery-count",
            role: "status",
            "aria-live": "polite",
            tabindex: "-1",
            "data-gallery-count": countPattern,
          },
          t(props.page.lang, "gallery_showing", {
            n: formatCount(props.page.lang, shown),
            total: formatCount(props.page.lang, total),
          }),
        );
  const empty =
    list === undefined
      ? null
      : h(
          "p",
          { class: "gallery-empty", tabindex: "-1", hidden: shown > 0 },
          t(props.page.lang, "gallery_empty"),
        );

  return h(
    "article",
    { class: "gallery", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, props.page.title),
    h("div", { class: "gallery-intro", dangerouslySetInnerHTML: { __html: pageHtml(props.page.html, props.page.lang) } }),
    list === undefined ? null : h(
      "div",
      { class: "gallery-body", "data-gallery": "" },
      controls,
      latestId === undefined ? null : reportDates(props),
      count,
      empty,
      grid,
    ),
  );
}

/** The page's own headings plus one `h2` per group, on a copy so the page itself stays untouched. */
function tocFor(props: LayoutProps): LayoutProps {
  const groups = groupsOf(props);
  if (groups.length === 0) return props;
  const headings: Heading[] = [
    ...props.page.headings,
    ...groups.map((group) => ({ depth: 2 as const, id: group.id, text: group.key, pos: props.page.source })),
  ];
  return { ...props, page: { ...props.page, headings } };
}

/** True when the page has a collection whose filters or sort the gallery shows. */
function hasControls(props: LayoutProps): boolean {
  const list = props.list;
  if (list === undefined) return false;
  return facetsOf(props, list).length > 0 || sortFieldsOf(props, list).length > 0;
}

/**
 * The gallery page: the base shell and the article, with the navigation sidebar and any group
 * headings in the on-this-page list. A page that names this layout without list data renders its
 * title and body alone, like the list layout.
 */
const gallery: Layout = (props) => {
  const islands = props.islands as Island[];
  const collection = props.list?.collection;
  const latest = collection === undefined ? undefined : latestReportOf(props, collection);
  const latestId = latest?.list?.records[0]?.id;
  if (latestId !== undefined || hasControls(props)) {
    const filterIsland: Island = { name: "gallery-filters", src: `${baseOf(props.site)}/${FILTER_ISLAND}` };
    if (!islands.some((island) => island.src === filterIsland.src)) islands.push(filterIsland);
  }
  return articleShell(props, {
    base: { islands },
    main: article(props, latestId),
    aside: toc(tocFor(props)) as ComponentChildren,
  });
};

export default gallery;
