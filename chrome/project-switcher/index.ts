import { h } from "preact";
import type { Chrome, Site } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

/** Class on the navigation landmark. */
export const NAV_CLASS = "project-switcher";

/** Class on the list of projects. */
export const LIST_CLASS = "project-switcher-list";

/** Class on one project's item. */
export const ITEM_CLASS = "project-switcher-item";

/** Class on one project's link. */
export const LINK_CLASS = "project-switcher-link";

/** Class added to the current project's link, beside {@link LINK_CLASS}. */
export const CURRENT_CLASS = "project-switcher-current";

/** One project the switcher links to, with only the name and address the network input holds. */
export interface ProjectLink {
  /** The project's id in the network file. */
  readonly id: string;
  /** The label shown for the project. */
  readonly title: string;
  /** The project's home, at its own base path. */
  readonly url: string;
  /** Whether this entry is the project being rendered. */
  readonly current: boolean;
}

/**
 * The network's projects as links to each project's home, in the network file's order. The theme adds no
 * filter: Mizzen leaves out projects that are not public before the site reaches it. A site without a
 * network, or with fewer than two projects, has nothing to switch to.
 */
export function projectLinks(site: Site): readonly ProjectLink[] {
  const projects = site.network?.projects ?? [];
  if (projects.length < 2) return [];

  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    url: `/${project.path}/`,
    current: project.current,
  }));
}

/**
 * The project switcher: one link per project in the site's network, each to that project's home, with the
 * current project marked by `aria-current`. Every name and address comes from `Site.network`; a site
 * without a network, or with one project, renders nothing. The links are plain anchors, so the switcher
 * needs no script.
 */
const projectSwitcher: Chrome = ({ site, page }) => {
  const projects = projectLinks(site);
  if (projects.length === 0) return null;

  return h(
    "nav",
    { class: NAV_CLASS, "aria-label": t(page.lang, "site_navigation") },
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

export default projectSwitcher;
