import { h } from "preact";
import { formatCount } from "../reading-time/index.ts";
import { patternOf, t } from "../../i18n/index.ts";
import {
  actionOf,
  filterHref,
  sortHref,
  ORDER_PARAM,
  SORT_PARAM,
  type GallerySort,
  type SortDirection,
} from "./island.ts";

/** The root of the controls above the grid. */
export const FILTERS_CLASS = "gallery-filters";

/** One facet: a field and the values the collection holds. */
export interface GalleryFacet {
  readonly field: string;
  readonly values: readonly { readonly value: string; readonly count: number }[];
}

export type GalleryFiltersProps = {
  /** The facets to offer, in the order the collection declares them. */
  facets: readonly GalleryFacet[];
  /** The sort fields the collection declares, first as the default. */
  sorts: readonly string[];
  /** The page's address, which carries the current filters and sort. */
  url: string;
  /** The chosen value per filter field. */
  selected: ReadonlyMap<string, string>;
  /** The sort the grid is in. */
  sort?: GallerySort | undefined;
  /** The page's language. */
  lang: string;
};

/** A value as the reader sees it: booleans use the catalog's words. */
function labelOf(value: string, lang: string): string {
  if (value === "true") return t(lang, "field_true");
  if (value === "false") return t(lang, "field_false");
  return value;
}

/**
 * The filter and sort controls. Every choice is a normal link: the value's address when no script
 * runs, and the island only intercepts it to say the same thing in place. The chosen value carries
 * `aria-current`, and the reset button is a form submit so it still works without script; it clears
 * every filter while keeping the sort and is visible only while a filter is active.
 */
export default function galleryFilters({ facets, sorts, url, selected, sort, lang }: GalleryFiltersProps) {
  const reset =
    facets.length === 0
      ? null
      : h(
          "form",
          { class: "gallery-filter-reset", method: "get", action: actionOf(url) },
          sort === undefined
            ? null
            : [
                h("input", { type: "hidden", name: SORT_PARAM, value: sort.field }),
                h("input", { type: "hidden", name: ORDER_PARAM, value: sort.direction }),
              ],
          h(
            "button",
            {
              class: "gallery-filter-clear",
              type: "submit",
              "data-gallery-clear": "",
              hidden: selected.size === 0,
            },
            t(lang, "gallery_filter_clear"),
          ),
        );
  const shown = facets.filter((facet) => facet.values.length > 0);
  const filterNav =
    facets.length === 0
      ? null
      : h(
          "nav",
          { class: "gallery-facets", "aria-label": t(lang, "gallery_filters") },
          shown.map((facet) =>
            h(
              "fieldset",
              { class: "gallery-facet" },
              h("legend", null, facet.field),
              h(
                "ul",
                { class: "gallery-facet-values" },
                facet.values.map((entry) => {
                  const active = selected.get(facet.field) === entry.value;
                  return h(
                    "li",
                    null,
                    h(
                      "a",
                      {
                        class: active ? "gallery-filter-value gallery-filter-selected" : "gallery-filter-value",
                        href: filterHref(url, facet.field, entry.value),
                        "data-gallery-filter": facet.field,
                        "data-gallery-value": entry.value,
                        "aria-current": active ? "true" : undefined,
                      },
                      labelOf(entry.value, lang),
                      " (",
                      formatCount(lang, entry.count),
                      ")",
                    ),
                  );
                }),
              ),
            ),
          ),
          reset,
        );

  const sortNav =
    sorts.length === 0
      ? null
      : h(
          "nav",
          {
            class: "gallery-sort",
            "aria-label": t(lang, "gallery_sort"),
            "data-sort-label": patternOf(lang, "record_table_sort"),
            "data-sort-ascending": patternOf(lang, "record_table_sorted_ascending"),
            "data-sort-descending": patternOf(lang, "record_table_sorted_descending"),
          },
          h("span", { class: "gallery-sort-label" }, t(lang, "gallery_sort")),
          sorts.map((field) => {
            const active = sort?.field === field;
            const direction: SortDirection = active ? sort.direction : "asc";
            const arrow = active ? (direction === "asc" ? "↑" : "↓") : "";
            return h(
              "a",
              {
                class: active ? "gallery-sort-link gallery-sort-active" : "gallery-sort-link",
                href: sortHref(url, field, direction),
                "data-gallery-sort": field,
                "data-order": direction,
                "aria-current": active ? "true" : undefined,
                "aria-label": active
                  ? t(lang, direction === "asc" ? "record_table_sorted_ascending" : "record_table_sorted_descending", {
                      column: field,
                    })
                  : t(lang, "record_table_sort", { column: field }),
              },
              field,
              arrow === "" ? null : h("span", { class: "gallery-sort-arrow", "aria-hidden": "true" }, arrow),
            );
          }),
        );

  return h("div", { class: FILTERS_CLASS }, filterNav, sortNav);
}
