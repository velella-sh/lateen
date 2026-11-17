import { h } from "preact";
import type { ChromeProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { projectLinks } from "./index.ts";

/** Class on the mobile group. */
export const MOBILE_CLASS = "project-switcher-mobile";

/** Class on the group's summary. */
export const MOBILE_SUMMARY_CLASS = "project-switcher-mobile-summary";

/** Class on the group's list. */
export const MOBILE_LIST_CLASS = "project-switcher-mobile-list";

/** Class on one project's item. */
export const MOBILE_ITEM_CLASS = "project-switcher-mobile-item";

/** Class on one project's link. */
export const MOBILE_LINK_CLASS = "project-switcher-mobile-link";

/** Class added to the current project's link, beside {@link MOBILE_LINK_CLASS}. */
export const MOBILE_CURRENT_CLASS = "project-switcher-mobile-current";

/**
 * The "Projects" group at the top of the mobile navigation drawer: a native disclosure with the same
 * projects, in the same order and with the same current mark as the header switcher, because both read
 * {@link projectLinks}. It starts collapsed, so its links are out of the tab order until the reader opens
 * it, and it adds no heading or landmark of its own. A site without a network, or with one project,
 * renders nothing.
 */
export function mobileProjects({ site, page }: ChromeProps) {
  const projects = projectLinks(site);
  if (projects.length === 0) return null;

  return h(
    "details",
    { class: MOBILE_CLASS, "data-project-switcher-mobile": "" },
    h(
      "summary",
      { class: MOBILE_SUMMARY_CLASS },
      h("span", null, t(page.lang, "projects")),
      h("span", { class: "project-switcher-mobile-marker", "aria-hidden": "true" }, "▾"),
    ),
    h(
      "ul",
      { class: MOBILE_LIST_CLASS },
      ...projects.map((project) =>
        h(
          "li",
          { class: MOBILE_ITEM_CLASS },
          h(
            "a",
            {
              class: project.current ? `${MOBILE_LINK_CLASS} ${MOBILE_CURRENT_CLASS}` : MOBILE_LINK_CLASS,
              href: project.url,
              "aria-current": project.current ? "true" : undefined,
            },
            h("bdi", null, project.title),
          ),
        ),
      ),
    ),
  );
}
