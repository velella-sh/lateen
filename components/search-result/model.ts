import type { SiteNetwork } from "@velella/mizzen/contracts";
import type { SearchResult } from "../../src/search/merge.ts";

/** The network project a result came from, when the network still lists it. */
function projectOf(network: SiteNetwork | undefined, id: string): SiteNetwork["projects"][number] | undefined {
  return network?.projects.find((project) => project.id === id);
}

/**
 * The address of one result under its project's base path. The index gives a project-relative URL;
 * the network's `path` supplies the base, and a URL that already carries it is left alone. A project
 * the network no longer lists keeps the URL the index returned.
 */
export function resultHref(result: Pick<SearchResult, "project" | "url">, network: SiteNetwork | undefined): string {
  const project = projectOf(network, result.project);
  if (project === undefined || /^https?:\/\//i.test(result.url)) return result.url;
  const base = `/${project.path.replace(/^\/+|\/+$/g, "")}`;
  const path = result.url.split(/[?#]/, 1)[0];
  if (path === base || path?.startsWith(`${base}/`)) return result.url;
  return `${base}${result.url.startsWith("/") ? result.url : `/${result.url}`}`;
}

/** The title used to identify a network result's project. */
export function resultLabel(
  result: Pick<SearchResult, "project" | "current">,
  network: SiteNetwork | undefined,
  includeCurrent = false,
): string | undefined {
  if (result.current && !includeCurrent) return undefined;
  return projectOf(network, result.project)?.title;
}
