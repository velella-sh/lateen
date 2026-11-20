import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import { askAgentSection } from "../chrome/ask-agent/index.ts";
import searchScope from "../chrome/search-scope/index.ts";
import shell, { footer as shellFooter, isCurrentSection, sectionLinks } from "../chrome/shell/index.ts";
import { patternOf, t } from "../i18n/index.ts";
import { safeHrefSource } from "../src/url.ts";
import base from "./base.ts";

/** Id of the query field, which its label points to. */
export const SEARCH_RESULTS_INPUT_ID = "search-results-input";

/** Most results shown at once; Pagefind ranks them and the top of the list is what a reader wants. */
export const RESULT_LIMIT = 20;

/** The control that reveals the next page of results. */
export const MORE_CLASS = "search-results-more";

/** A value safe to put inside the inline module script: `<` cannot close the tag early. */
export function scriptValue(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * The page's client code. It reads `q` from the address, loads the Pagefind index from `base`,
 * searches, announces the real count in the status region, and builds result links and excerpts from
 * text nodes. The show-more control appends the next page of hits without clearing the list and
 * focuses its first result. Pagefind's excerpts carry only its own `<mark>` emphasis, so the excerpt
 * is parsed in an inert `<template>` and only text and `<mark>` elements are copied into the page.
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
    emptyScope: patternOf(lang, "search_results_empty_scope"),
    scopeProject: t(lang, "search_scope_project"),
    scopeAll: t(lang, "search_scope_all"),
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
const more = document.querySelector("[data-search-more]");
const scopeLink = document.querySelector("[data-search-scope-change]");
const query = new URLSearchParams(location.search).get("q") || "";
const storage = (() => {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
})();
const scope = new URLSearchParams(location.search).get("scope") === "all" ? "all" : "project";
let hits = [];
let shown = 0;
let pending = false;
if (input) input.value = query;

/* link-path:start The link guard is the theme's shared rule, so the results page cannot drift from the dialog. */
const SAFE_HREF = new RegExp(${scriptValue(safeHrefSource(undefined, true))}, "i");
function safeHref(url) {
  return typeof url === "string" && SAFE_HREF.test(url) ? url : undefined;
}
/* link-path:end */

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

/* more-path:start The paging path is a self-contained block the layout's tests extract and run;
   it reads only its arguments. */
/** The next page of hits after the ones already shown; the last page may be shorter. */
function nextBatch(hits, shown, limit) {
  return hits.slice(shown, shown + limit);
}

/** Whether a hit remains after the ones already shown. */
function hasMore(hits, shown) {
  return shown < hits.length;
}

/** Focus the first new result's link, or the control when that result has no link. */
function focusAfterAppend(items, control) {
  const first = items.length === 0 ? undefined : items[0].querySelector("a");
  if (first) first.focus();
  else if (control) control.focus();
}
/* more-path:end */

/* return-path:start The return path is a self-contained block the layout's tests extract and run;
   it reads only its arguments. */
const RETURN_KEY = "lateen:search-results-return";

/** Remembers the query and the result address a reader followed. */
function rememberResult(storage, query, url) {
  try {
    storage.setItem(RETURN_KEY, JSON.stringify({ query, url }));
  } catch {}
}

/** The result address followed for this query, or undefined. */
function rememberedResult(storage, query) {
  try {
    const stored = JSON.parse(storage.getItem(RETURN_KEY) || "null");
    return stored && stored.query === query && typeof stored.url === "string" ? stored.url : undefined;
  } catch {
    return undefined;
  }
}

/** Marks the remembered result in the list; never moves focus. */
function markResult(list, url) {
  if (!list || url === undefined) return;
  for (const link of list.querySelectorAll("a.search-results-link")) {
    if (link.getAttribute("href") === url) link.setAttribute("aria-current", "true");
  }
}
/* return-path:end */

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

/** One result as a list item, with its section path when that path tells it apart. */
function itemOf(record, path) {
  const href = safeHref(record.url);
  const link = document.createElement(href === undefined ? "span" : "a");
  link.className = "search-results-link";
  if (href !== undefined) link.setAttribute("href", href);
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
  return item;
}

/** The items of one batch, with the section paths computed across that batch. */
function itemsOf(records) {
  const paths = sectionPaths(records.map((record) => record.url));
  return records.map((record, index) => itemOf(record, paths[index]));
}

function render(records) {
  if (!list) return;
  list.replaceChildren(...itemsOf(records));
  markResult(list, rememberedResult(storage, query));
}

/** Appends the next batch without clearing the list and moves focus to its first result. */
function append(records) {
  if (!list) return;
  const items = itemsOf(records);
  list.append(...items);
  const remaining = hasMore(hits, shown);
  if (more) more.hidden = !remaining;
  focusAfterAppend(items, remaining ? more : undefined);
}

if (status && list && query.trim() !== "") {
  status.textContent = messages.loading;
  if (more) more.hidden = true;
  import(base.replace(/\\/$/, "") + "/pagefind/pagefind.js")
    .then((api) => api.search(query))
    .then((page) => {
      hits = page.results;
      return Promise.all(nextBatch(hits, 0, ${RESULT_LIMIT}).map((hit) => hit.data()));
    })
    .then((records) => {
      shown = records.length;
      render(records);
      if (more) more.hidden = !hasMore(hits, shown);
      const empty = hits.length === 0;
      status.textContent = empty
        ? messages.emptyScope
            .replace("{query}", () => query)
            .replace("{scope}", () => (scope === "all" ? messages.scopeAll : messages.scopeProject))
        : hits.length === 1
          ? messages.one
          : countMessage(hits.length);
      if (scopeLink) {
        scopeLink.hidden = !empty;
        if (empty) {
          const url = new URL(location.href);
          url.searchParams.set("q", query);
          url.searchParams.set("scope", scope === "all" ? "project" : "all");
          scopeLink.setAttribute("href", url.pathname + url.search);
          scopeLink.textContent = scope === "all" ? messages.scopeProject : messages.scopeAll;
        }
      }
    })
    .catch(() => {
      status.textContent = messages.failed;
    });

  if (more) {
    more.addEventListener("click", () => {
      if (pending || !hasMore(hits, shown)) return;
      pending = true;
      const batch = nextBatch(hits, shown, ${RESULT_LIMIT});
      Promise.all(batch.map((hit) => hit.data()))
        .then((records) => {
          pending = false;
          shown += batch.length;
          append(records);
        })
        .catch(() => {
          pending = false;
          status.textContent = messages.failed;
          more.focus();
        });
    });
  }

  list.addEventListener("click", (event) => {
    const link = event.target && event.target.closest ? event.target.closest("a.search-results-link") : null;
    if (link && link.getAttribute("href")) rememberResult(storage, query, link.getAttribute("href"));
  });
  addEventListener("pageshow", () => markResult(list, rememberedResult(storage, query)));
}`;
}

/**
 * The no-JavaScript fallback under the note: links to the site's browsable sections from the engine
 * navigation model, in its order and with its labels. Nothing when the site defines no navigation.
 */
function noJsSections(props: LayoutProps): ComponentChildren {
  const base = props.site.config.base;
  const links = sectionLinks(props.site);
  if (links.length === 0) return null;
  return h(
    "nav",
    { class: "search-results-sections", "aria-label": "Sections" },
    h(
      "ul",
      { class: "search-results-sections-list" },
      links.map((item) =>
        h(
          "li",
          null,
          h(
            "a",
            { href: item.url, ...(isCurrentSection(item.url, props.page.url, base) ? { "aria-current": "page" } : {}) },
            item.title,
          ),
        ),
      ),
    ),
  );
}

/**
 * The search results content: the page title, a labelled GET form that submits to this page, the
 * status region, the result list, the show-more control, and the no-JavaScript note with browsable
 * section links. The form works on its own; the inline module fills the list when the reader has
 * JavaScript and the query is in the address.
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
    h("a", { class: "search-results-scope-change", "data-search-scope-change": "", hidden: true }),
    h(
      "noscript",
      null,
      h("p", { class: "search-results-nojs" }, t(lang, "search_results_js")),
      noJsSections(props),
    ),
    h("ol", { class: "search-results-list", "data-search-results": "" }),
    h(
      "button",
      { class: MORE_CLASS, type: "button", "data-search-more": "", hidden: true },
      t(lang, "search_results_more"),
    ),
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
