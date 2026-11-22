/* The data explorer's DOM construction: the result count text, the filter checkboxes, and one table
 * row. These build elements from the model's values; they hold no selection or timing state. */

import { URL_COLUMN, type IndexRow } from "./index-loader.ts";
import { formatNumber, isEmptyCell, textOf, type Column, type ExplorerModel, type Facet } from "./state.ts";
import { withBase } from "../../src/url.ts";
import type { ExplorerDocument, ExplorerElement } from "./contract.ts";

/** The count pattern for the page language's plural category. */
export function countText(root: ExplorerElement, lang: string, count: number): string {
  let category = "other";
  try {
    category = new Intl.PluralRules(lang).select(count);
  } catch {
    // A language without plural rules keeps the `other` pattern.
  }
  const pattern =
    root.getAttribute(`data-explorer-count-${category}`) ?? root.getAttribute("data-explorer-count-other") ?? "";
  return pattern.replace("{n}", formatNumber(lang, count));
}

/** One drawn filter value: the checkbox and the count it shows. */
export interface FacetWidget {
  readonly field: string;
  readonly label: string;
  readonly raw: string;
  readonly input: ExplorerElement;
  readonly count: ExplorerElement;
}

/** Fills the filter box with one checkbox per value of every facet, and returns the controls it drew. */
export function drawFacets(
  doc: ExplorerDocument,
  box: ExplorerElement,
  facets: readonly Facet[],
  pattern: string,
  lang: string,
): FacetWidget[] {
  const widgets: FacetWidget[] = [];
  for (const facet of facets) {
    const fieldset = doc.createElement("fieldset");
    fieldset.setAttribute("class", "data-explorer-filter");
    const legend = doc.createElement("legend");
    legend.setAttribute("class", "data-explorer-filter-label");
    legend.textContent = pattern.replace("{column}", facet.label);
    fieldset.append(legend);

    for (const value of facet.values) {
      const option = doc.createElement("label");
      option.setAttribute("class", "data-explorer-filter-option");
      const input = doc.createElement("input");
      input.setAttribute("type", "checkbox");
      input.setAttribute("value", value.raw);
      input.checked = false;
      const name = doc.createElement("span");
      name.setAttribute("class", "data-explorer-filter-value");
      name.textContent = value.raw;
      const tally = doc.createElement("span");
      tally.setAttribute("class", "data-explorer-filter-count");
      tally.textContent = `(${formatNumber(lang, value.count)})`;
      option.append(input, name, tally);
      fieldset.append(option);
      widgets.push({ field: facet.field, label: facet.label, raw: value.raw, input, count: tally });
    }
    box.append(fieldset);
  }
  return widgets;
}

/** One body row for one index row, in the display columns' order. */
export function rowOf(
  doc: ExplorerDocument,
  row: IndexRow,
  columns: readonly Column[],
  index: ExplorerModel["index"],
  base: string,
  lang: string,
  noValue: string,
): ExplorerElement {
  const tr = doc.createElement("tr");
  const urlAt = index.columns.indexOf(URL_COLUMN);
  const url = urlAt < 0 ? "" : row[urlAt];

  columns.forEach((column, at) => {
    const position = index.columns.indexOf(column.field);
    const value = position < 0 ? undefined : row[position];
    const td = doc.createElement("td");
    td.setAttribute("class", "record-table-cell");
    td.setAttribute("data-kind", column.kind);

    if (isEmptyCell(value)) {
      const span = doc.createElement("span");
      span.setAttribute("class", "field-empty");
      span.textContent = noValue;
      td.append(span);
    } else {
      const text = textOf(value as Exclude<IndexRow[number], null | undefined>, column.kind, lang);
      td.setAttribute("data-value", String(value));
      if (at === 0 && typeof url === "string" && url !== "") {
        const link = doc.createElement("a");
        link.setAttribute("href", withBase(base, url));
        link.textContent = text;
        td.append(link);
      } else {
        td.textContent = text;
      }
    }
    tr.append(td);
  });
  return tr;
}
