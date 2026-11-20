import type { ChromeProps } from "@velella/mizzen/contracts";
import { mobileSelector } from "../mobile-selectors/index.ts";
import { isExternalProjectUrl, projectLinks } from "./index.ts";
import { t } from "../../i18n/index.ts";

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

/** Extra class hooks the project unit keeps beside the shared mobile-selector classes. */
const PROJECT_CLASSES = {
  details: MOBILE_CLASS,
  summary: MOBILE_SUMMARY_CLASS,
  list: MOBILE_LIST_CLASS,
  item: MOBILE_ITEM_CLASS,
  link: MOBILE_LINK_CLASS,
  current: MOBILE_CURRENT_CLASS,
} as const;

/**
 * The "Projects" group at the top of the mobile navigation drawer: the shared mobile selector with the
 * same projects, in the same order and with the same current mark as the header switcher, because both
 * read {@link projectLinks}. It starts collapsed and adds no heading or landmark of its own. A site
 * without a network, or with one project, renders nothing.
 */
export function mobileProjects({ site, page }: ChromeProps) {
  const projects = projectLinks(site);
  if (projects.length === 0) return null;

  return mobileSelector({
    key: "projects",
    label: t(page.lang, "projects"),
    items: projects.map((project) => ({
      text: project.title,
      href: project.url,
      current: project.current,
      external: isExternalProjectUrl(project.url),
    })),
    classes: PROJECT_CLASSES,
    attrs: { "data-project-switcher-mobile": "" },
  });
}
