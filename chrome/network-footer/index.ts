import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { projectLinks } from "../project-switcher/index.ts";

/** Class on the footer block. */
export const FOOTER_CLASS = "network-footer";

/** Class on the one-line label above the list. */
export const LABEL_CLASS = "network-footer-label";

/** Class on the list of projects. */
export const LIST_CLASS = "network-footer-list";

/** Class on one project's item. */
export const ITEM_CLASS = "network-footer-item";

/** Class on one project's link. */
export const LINK_CLASS = "network-footer-link";

/** Class added to the current project's link, beside {@link LINK_CLASS}. */
export const CURRENT_CLASS = "network-footer-current";

/**
 * The network footer: a labelled list of every project in the site's network, in the same order and with
 * the same names and addresses as the header switcher, because both read {@link projectLinks}. A site
 * without a network, or with one project, renders nothing.
 */
const networkFooter: Chrome = ({ site, page }) => {
  const projects = projectLinks(site);
  if (projects.length === 0) return null;

  return h(
    "div",
    { class: FOOTER_CLASS },
    h("p", { class: LABEL_CLASS }, t(page.lang, "projects")),
    h(
      "ul",
      { class: LIST_CLASS },
      ...projects.map((project) =>
        h(
          "li",
          { class: ITEM_CLASS },
          h(
            "a",
            {
              class: project.current ? `${LINK_CLASS} ${CURRENT_CLASS}` : LINK_CLASS,
              href: project.url,
              "aria-current": project.current ? "true" : undefined,
            },
            h("bdi", null, project.title),
          ),
        ),
      ),
    ),
  );
};

export default networkFooter;
