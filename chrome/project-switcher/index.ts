import { h } from "preact";
import type { Chrome, Site } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

/** Class on the navigation landmark. */
export const NAV_CLASS = "project-switcher";

/** Class on the native disclosure that holds the list. */
export const DETAILS_CLASS = "project-switcher-details";

/** Class on the disclosure control. */
export const SUMMARY_CLASS = "project-switcher-summary";

/** Class on the visible label inside the summary. */
export const LABEL_CLASS = "project-switcher-label";

/** Class on the decorative disclosure marker. */
export const MARKER_CLASS = "project-switcher-marker";

/** Class on the list of projects. */
export const LIST_CLASS = "project-switcher-list";

/** Class on one project's item. */
export const ITEM_CLASS = "project-switcher-item";

/** Class on one project's link. */
export const LINK_CLASS = "project-switcher-link";

/** Class added to the current project's link, beside {@link LINK_CLASS}. */
export const CURRENT_CLASS = "project-switcher-current";

/** The i18n key with the accessible name of the navigation landmark, distinct from the sidebar's. */
export const NAV_LABEL_KEY = "project_navigation";

/** The i18n key with the label of the control. */
export const LABEL_KEY = "projects";

/** True only for an absolute `https://` address; a path, protocol-relative, or other scheme is not external. */
export function isExternalProjectUrl(url: string): boolean {
  return /^https:\/\//i.test(url);
}

/** One project the switcher links to, with only the name and address the network input holds. */
export interface ProjectLink {
  /** The project's id in the network file. */
  readonly id: string;
  /** The label shown for the project. */
  readonly title: string;
  /** The project's home: an absolute `https://` address as given, otherwise its own base path. */
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
    url: isExternalProjectUrl(project.path) ? project.path : `/${project.path}/`,
    current: project.current,
  }));
}

/**
 * The project switcher: a native `<details>` whose list links each project's home, with the current project
 * marked by `aria-current`. Every name and address comes from `Site.network`; a site without a network, or
 * with one project, renders nothing. The disclosure works with no script; `island.ts` adds Escape, the
 * arrow keys, and the two closing rules.
 */
const projectSwitcher: Chrome = ({ site, page }) => {
  const projects = projectLinks(site);
  if (projects.length === 0) return null;

  return h(
    "nav",
    { class: NAV_CLASS, "aria-label": t(page.lang, NAV_LABEL_KEY) },
    h(
      "details",
      { class: DETAILS_CLASS, "data-project-switcher": "" },
      h(
        "summary",
        { class: SUMMARY_CLASS },
        h("span", { class: LABEL_CLASS }, t(page.lang, LABEL_KEY)),
        h("span", { class: MARKER_CLASS, "aria-hidden": "true" }, "▾"),
      ),
      h(
        "ul",
        { class: LIST_CLASS },
        ...projects.map((project) => {
          const external = isExternalProjectUrl(project.url);
          return h(
            "li",
            { class: ITEM_CLASS },
            h(
              "a",
              {
                class: project.current ? `${LINK_CLASS} ${CURRENT_CLASS}` : LINK_CLASS,
                href: project.url,
                rel: external ? "noopener noreferrer" : undefined,
                target: external ? "_blank" : undefined,
                "aria-current": project.current ? "true" : undefined,
              },
              h("bdi", null, project.title),
            ),
          );
        }),
      ),
    ),
  );
};

export default projectSwitcher;
