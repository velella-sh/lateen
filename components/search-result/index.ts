import { h } from "preact";
import type { SiteNetwork } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { resultHeading, resultHref, resultLabel, type FailedIndex, type SearchResult } from "../../src/search/merge.ts";

/** Class on one result's item. */
export const RESULT_CLASS = "search-result";

/** Class on the project label an other-project result carries. */
export const PROJECT_CLASS = "search-result-project";

/** Class on the label that names a result's language when it is not the page's. */
export const LANGUAGE_CLASS = "search-result-language";

/** Class on the label that names a result's site version when it is not the page's. */
export const VERSION_CLASS = "search-result-version";

/** Class on the result's link. */
export const LINK_CLASS = "search-result-link";

/** Class on the section path that tells two same-titled results apart. */
export const PATH_CLASS = "search-result-path";

/** Class on the heading the result's fragment points at. */
export const HEADING_CLASS = "search-result-heading";

/** Class on the result's title. */
export const TITLE_CLASS = "search-result-title";

/** Class on the result's excerpt. */
export const EXCERPT_CLASS = "search-result-excerpt";

/** Class on the notice that one project's index failed. */
export const FAILURE_CLASS = "search-result-failure";

/** Class on the retry link in that notice. */
export const RETRY_CLASS = "search-result-retry";

/** One merged result, with its network and the project it came from. */
export interface SearchResultItemProps {
  readonly result: SearchResult;
  readonly network?: SiteNetwork | undefined;
  /** The result's disambiguating section path, already blank when no result needs one. */
  readonly path?: string | undefined;
  /** The page's language tag; a result in another language is labelled. */
  readonly lang?: string | undefined;
  /** The page's site version; a result from another version is labelled. */
  readonly version?: string | undefined;
}

/** A language tag in the form matching compares: trimmed, lower case, `_` read as `-`. */
function tagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, "-");
}

/** The language tag's name in `lang`, or the tag itself when the runtime has no name for it. */
export function languageName(tag: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/** The entities Pagefind escapes in an excerpt. */
const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  "#x27": "'",
};

/** Reads an excerpt fragment back to the text a reader should see. */
function excerptText(fragment: string): string {
  return fragment.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity);
}

/** The excerpt as text and its own `<mark>` matches; every other character stays text. */
function excerptChildren(excerpt: string) {
  const children: (string | ReturnType<typeof h>)[] = [];
  let marked = false;
  let last = 0;
  /** Appends one run, in a `mark` when Pagefind marked it. */
  const push = (fragment: string): void => {
    const text = excerptText(fragment);
    children.push(marked ? h("mark", null, text) : text);
  };
  for (const match of excerpt.matchAll(/<mark\b[^>]*>|<\/mark\s*>/gi)) {
    if (match.index > last) push(excerpt.slice(last, match.index));
    marked = !match[0].startsWith("</");
    last = match.index + match[0].length;
  }
  if (last < excerpt.length) push(excerpt.slice(last));
  return children;
}

/** The label that names a result's language, when it is not the page's. */
function languageLabel(result: SearchResult, lang: string | undefined): string | undefined {
  if (lang === undefined || result.lang === undefined || tagKey(result.lang) === tagKey(lang)) return undefined;
  return languageName(result.lang, lang);
}

/** The label that names a result's site version, when it is not the page's. */
function versionLabel(result: SearchResult, version: string | undefined): string | undefined {
  if (version === undefined || result.version === undefined) return undefined;
  const value = result.version.trim();
  return value === "" || value === version.trim() ? undefined : value;
}

/**
 * One search result: its project's title above a result from another project, and a link built from
 * the network's `path` so it lands under that project's base. A result from this project gets no
 * label, because the page around it already says where the reader is. A result from another
 * language or site version gets its real name in a muted label; the `bdi` keeps that name readable
 * in either direction.
 */
export function searchResult({ result, network, path, lang, version }: SearchResultItemProps) {
  const label = resultLabel(result, network);
  const language = languageLabel(result, lang);
  const resultVersion = versionLabel(result, version);
  const heading = resultHeading(result.url, result);
  return h(
    "li",
    { class: RESULT_CLASS },
    label === undefined ? null : h("span", { class: PROJECT_CLASS }, h("bdi", null, label)),
    language === undefined ? null : h("span", { class: LANGUAGE_CLASS }, h("bdi", null, language)),
    resultVersion === undefined ? null : h("span", { class: VERSION_CLASS }, h("bdi", null, resultVersion)),
    h(
      "a",
      { class: LINK_CLASS, href: resultHref(result, network) },
      path === undefined || path === "" ? null : h("span", { class: PATH_CLASS }, h("bdi", null, path)),
      h("span", { class: TITLE_CLASS }, result.title),
      heading === undefined ? null : h("span", { class: HEADING_CLASS }, h("bdi", null, heading)),
      h("span", { class: EXCERPT_CLASS }, excerptChildren(result.excerpt)),
    ),
  );
}

/** One project whose index did not answer, and where the reader can try again. */
export interface SearchFailureProps {
  readonly project: FailedIndex;
  /** The results address that retries the `all` scope. */
  readonly retryUrl: string;
  /** The page language. */
  readonly lang: string;
}

/**
 * The notice for a failed index: a message that names the project and a plain retry link, so the
 * reader can load the scope again without JavaScript.
 */
export function searchFailure({ project, retryUrl, lang }: SearchFailureProps) {
  return h(
    "p",
    { class: FAILURE_CLASS, role: "status" },
    h("span", null, t(lang, "search_project_failed", { project: project.title })),
    " ",
    h("a", { class: RETRY_CLASS, href: retryUrl }, t(lang, "search_retry")),
  );
}

export default searchResult;
