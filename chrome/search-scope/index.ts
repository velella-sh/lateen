import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

/** Class on the fieldset that holds the two choices. */
export const SCOPE_CLASS = "search-scope";

/** Class on the fieldset's legend. */
export const LEGEND_CLASS = "search-scope-legend";

/** Class on one labelled radio. */
export const OPTION_CLASS = "search-scope-option";

/** Class on one radio input. */
export const INPUT_CLASS = "search-scope-input";

/** The query parameter the engine's `SEARCH_SCOPE` contract names. */
export const SCOPE_PARAMETER = "scope";

/** The value that searches this project's index only, the engine's default. */
export const SCOPE_PROJECT = "project";

/** The value that also searches the other public projects' indexes. */
export const SCOPE_ALL = "all";

/**
 * The search scope control: two radio choices beside the search box, named `scope` and carrying the
 * engine's `project` and `all` values, so an ordinary form submission writes the choice to the results
 * address and works without a script. A site without a network, or with one project, has no other
 * index to add and renders nothing.
 */
const searchScope: Chrome = ({ site, page }) => {
  const projects = site.network?.projects.length ?? 0;
  if (projects < 2) return null;

  const lang = page.lang;
  return h(
    "fieldset",
    { class: SCOPE_CLASS },
    h("legend", { class: LEGEND_CLASS }, t(lang, "search_scope")),
    h(
      "label",
      { class: OPTION_CLASS },
      h("input", {
        class: INPUT_CLASS,
        type: "radio",
        name: SCOPE_PARAMETER,
        value: SCOPE_PROJECT,
        checked: true,
      }),
      h("span", null, t(lang, "search_scope_project")),
    ),
    h(
      "label",
      { class: OPTION_CLASS },
      h("input", {
        class: INPUT_CLASS,
        type: "radio",
        name: SCOPE_PARAMETER,
        value: SCOPE_ALL,
      }),
      h("span", null, t(lang, "search_scope_all")),
    ),
  );
};

export default searchScope;
