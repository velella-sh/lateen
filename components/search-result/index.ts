import { h } from "preact";
import type { SiteNetwork } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { resultHref, resultLabel, type FailedIndex, type SearchResult } from "../../src/search/merge.ts";

/** Class on one result's item. */
export const RESULT_CLASS = "search-result";

/** Class on the project label an other-project result carries. */
export const PROJECT_CLASS = "search-result-project";

/** Class on the result's link. */
export const LINK_CLASS = "search-result-link";

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
}

/**
 * One search result: its project's title above a result from another project, and a link built from
 * the network's `path` so it lands under that project's base. A result from this project gets no
 * label, because the page around it already says where the reader is.
 */
export function searchResult({ result, network }: SearchResultItemProps) {
  const label = resultLabel(result, network);
  return h(
    "li",
    { class: RESULT_CLASS },
    label === undefined ? null : h("span", { class: PROJECT_CLASS }, h("bdi", null, label)),
    h(
      "a",
      { class: LINK_CLASS, href: resultHref(result, network) },
      h("span", { class: TITLE_CLASS }, result.title),
      h("span", { class: EXCERPT_CLASS }, result.excerpt),
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
