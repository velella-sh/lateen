import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import { askAgentSection } from "../chrome/ask-agent/index.ts";
import searchScope from "../chrome/search-scope/index.ts";
import shell, { footer as shellFooter } from "../chrome/shell/index.ts";
import { patternOf, t } from "../i18n/index.ts";
import base from "./base.ts";

/** Id of the query field, which its label points to. */
export const SEARCH_RESULTS_INPUT_ID = "search-results-input";

/** Most results shown on the page; Pagefind ranks them and the top of the list is what a reader wants. */
export const RESULT_LIMIT = 20;

/** A value safe to put inside the inline module script: `<` cannot close the tag early. */
export function scriptValue(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * The page's client code. It reads `q` from the address, loads the Pagefind index from `base`,
 * searches, announces the count in the status region, and builds result links and excerpts from
 * text nodes. Pagefind's excerpts carry only its own `<mark>` emphasis, so the excerpt is parsed in
 * an inert `<template>` and only text and `<mark>` elements are copied into the page.
 *
 * The announcement uses the same mechanism as the search dialog (issue #108): every
 * `search_count_*` plural-category message is serialized, the browser picks the page language's
 * CLDR category with `Intl.PluralRules`, and the visible number follows the language's numbering
 * preferences through `Intl.NumberFormat`. The one-result count keeps `search_results_one`, whose
 * prose is written for exactly one result, and the empty, loading, and failure messages keep
 * their own wording.
 */
function clientScript(props: LayoutProps): string {
  const lang = props.page.lang;
  const messages = {
    empty: patternOf(lang, "search_results_empty"),
    failed: t(lang, "search_results_failed"),
    loading: t(lang, "search_results_loading"),
    one: t(lang, "search_results_one"),
    counts: {
      zero: patternOf(lang, "search_count_zero"),
      one: patternOf(lang, "search_count_one"),
      two: patternOf(lang, "search_count_two"),
      few: patternOf(lang, "search_count_few"),
      many: patternOf(lang, "search_count_many"),
      other: patternOf(lang, "search_count_other"),
    },
  };
  return `const base = ${scriptValue(props.site.config.base)};
const lang = ${scriptValue(lang)};
const messages = ${scriptValue(messages)};
const input = document.querySelector("[data-search-input]");
const status = document.querySelector("[data-search-status]");
const list = document.querySelector("[data-search-results]");
const query = new URLSearchParams(location.search).get("q") || "";
if (input) input.value = query;

function safeHref(url) {
  return url.startsWith("/") || url.startsWith("./") || url.startsWith("../") || /^https?:\\/\\//i.test(url) ? url : undefined;
}

/* heading-path:start The heading lookup is a self-contained block the layout's tests extract and
   run against real Pagefind records; it reads only its argument. */
/** A URL's decoded fragment, without the #; undefined when it has none. */
function fragmentOf(url) {
  const hash = url.indexOf("#");
  if (hash === -1) return undefined;
  const fragment = url.slice(hash + 1);
  if (fragment === "") return undefined;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/** The real heading text for the fragment the record's URL already carries, or undefined. */
function resultHeading(record) {
  const fragment = fragmentOf(record.url);
  if (fragment === undefined) return undefined;
  for (const sub of record.sub_results || []) {
    const title = typeof sub.title === "string" ? sub.title.trim() : "";
    if (sub.url !== undefined && fragmentOf(sub.url) === fragment && title !== "") return title;
  }
  for (const anchor of record.anchors || []) {
    const text = typeof anchor.text === "string" ? anchor.text.trim() : "";
    if (anchor.id === fragment && text !== "") return text;
  }
  return undefined;
}
/* heading-path:end */

/* section-path:start The section path is a self-contained block the layout's tests extract and run
   against the runtime's real URL parser; it reads only its argument. */
/** The page's parent directory: /guide/install/ gives /guide/, a root page an empty string. */
function sectionPath(url) {
  let pathname;
  try {
    pathname = new URL(url, "https://lateen.invalid").pathname;
  } catch {
    return "";
  }
  const segments = pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  segments.pop();
  return segments.length === 0 ? "" : "/" + segments.join("/") + "/";
}

/** Each result's path, all empty when no result has one or every result shares the same one. */
function sectionPaths(urls) {
  const paths = urls.map(sectionPath);
  const first = paths.length === 0 ? "" : paths[0];
  return paths.every((path) => path === first) ? paths.map(() => "") : paths;
}
/* section-path:end */

/* count-path:start The count path is a self-contained block the layout's tests extract and run
   against the runtime's real Intl data; it reads only the lang and messages declared above.
   Mirrors the search dialog's pluralCategory (issue 108) with locale number formatting. */
const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];

/** The CLDR plural category of count in the page language; a tag the runtime rejects reads other. */
function pluralCategory(count) {
  let category;
  try {
    category = new Intl.PluralRules(lang).select(Math.abs(Math.trunc(count)));
  } catch {
    return "other";
  }
  return PLURAL_CATEGORIES.includes(category) ? category : "other";
}

/** The count written the way the page language writes numbers; a tag the runtime rejects reads Western. */
function visibleNumber(count) {
  try {
    return new Intl.NumberFormat(lang).format(count);
  } catch {
    return String(count);
  }
}

/** The count message of the page language's plural category, with the n placeholder filled visibly. */
function countMessage(count) {
  const pattern = messages.counts[pluralCategory(count)] || messages.counts.other;
  return pattern.replace("{n}", () => visibleNumber(count));
}
/* count-path:end */

/** Copies text nodes and Pagefind's <mark> elements out of the inert excerpt template. */
function copyExcerpt(node, target) {
  for (const child of node.childNodes) {
    if (child.nodeType === 3) target.append(document.createTextNode(child.nodeValue));
    else if (child.nodeName === "MARK") {
      const mark = document.createElement("mark");
      copyExcerpt(child, mark);
      target.append(mark);
    } else copyExcerpt(child, target);
  }
}

function render(records) {
  if (!list) return;
  const items = [];
  const paths = sectionPaths(records.map((record) => record.url));
  for (const [index, record] of records.entries()) {
    const href = safeHref(record.url);
    const link = document.createElement(href === undefined ? "span" : "a");
    link.className = "search-results-link";
    if (href !== undefined) link.setAttribute("href", href);
    const path = paths[index];
    if (path !== "") {
      const breadcrumb = document.createElement("span");
      breadcrumb.className = "search-results-path";
      const bdi = document.createElement("bdi");
      bdi.textContent = path;
      breadcrumb.append(bdi);
      link.append(breadcrumb);
    }
    const title = document.createElement("span");
    title.className = "search-results-title";
    title.textContent = record.meta && record.meta.title ? record.meta.title : record.url;
    link.append(title);
    const headingText = resultHeading(record);
    if (headingText !== undefined) {
      const heading = document.createElement("span");
      heading.className = "search-results-heading";
      const bdi = document.createElement("bdi");
      bdi.textContent = headingText;
      heading.append(bdi);
      link.append(heading);
    }
    const excerpt = document.createElement("span");
    excerpt.className = "search-results-excerpt";
    const template = document.createElement("template");
    template.innerHTML = record.excerpt || "";
    copyExcerpt(template.content, excerpt);
    link.append(excerpt);
    const item = document.createElement("li");
    item.append(link);
    items.push(item);
  }
  list.replaceChildren(...items);
}

if (status && list && query.trim() !== "") {
  status.textContent = messages.loading;
  import(base.replace(/\\/$/, "") + "/pagefind/pagefind.js")
    .then((api) => api.search(query))
    .then((page) => Promise.all(page.results.slice(0, ${RESULT_LIMIT}).map((hit) => hit.data())))
    .then((records) => {
      render(records);
      status.textContent =
        records.length === 0
          ? messages.empty.replace("{query}", () => query)
          : records.length === 1
            ? messages.one
            : countMessage(records.length);
    })
    .catch(() => {
      status.textContent = messages.failed;
    });
}`;
}

/**
 * The search results content: the page title, a labelled GET form that submits to this page, the
 * status region, the result list, and the no-JavaScript note. The form works on its own; the
 * inline module fills the list when the reader has JavaScript and the query is in the address.
 */
function content(props: LayoutProps): ComponentChildren {
  const lang = props.page.lang;
  return h(
    "div",
    { class: "search-results", "data-search-page": "" },
    h("h1", { class: "search-results-title-page" }, props.page.title),
    h(
      "form",
      { class: "search-results-form", role: "search", action: props.page.url, method: "get", "data-search-form": "" },
      h("label", { class: "search-results-label", for: SEARCH_RESULTS_INPUT_ID }, t(lang, "search")),
      h("input", {
        class: "search-results-input",
        id: SEARCH_RESULTS_INPUT_ID,
        type: "search",
        name: "q",
        autocomplete: "off",
        "data-search-input": "",
      }),
      h("button", { class: "search-results-submit", type: "submit" }, t(lang, "search")),
      searchScope(props) as ComponentChildren,
    ),
    h("p", { class: "search-results-status", role: "status", "data-search-status": "" }, ""),
    h("noscript", null, h("p", { class: "search-results-nojs" }, t(lang, "search_results_js"))),
    h("ol", { class: "search-results-list", "data-search-results": "" }),
    askAgentSection(props) as ComponentChildren,
    h("script", { type: "module", dangerouslySetInnerHTML: { __html: clientScript(props) } }),
  );
}

/**
 * The search results page, a dedicated page usable without the dialog.
 *
 * It is named `search-results` rather than `search`: the engine-boundary gate reads every layout
 * name in this folder and rejects it inside `packages/engine/`, and the engine's search output uses
 * the word `search`. Renaming the layout keeps that gate honest about the boundary.
 */
const searchResults: Layout = (props) =>
  base({
    ...props,
    header: shell(props) as ComponentChildren,
    footer: shellFooter(props) as ComponentChildren,
    main: content(props),
  });

export default searchResults;
