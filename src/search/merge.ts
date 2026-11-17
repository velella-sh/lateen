import type { SiteNetwork } from "@velella/mizzen/contracts";

/** One search result after a project's index returned it, with the score and project the merge needs. */
export interface SearchResult {
  /** The project's id in the network file. */
  readonly project: string;
  /** Whether the result came from the project being rendered. */
  readonly current: boolean;
  /** The result's title, from the index. */
  readonly title: string;
  /** The result's address, already under its project's base path. */
  readonly url: string;
  /** The excerpt the index returned. */
  readonly excerpt: string;
  /** The index's score; higher ranks first. */
  readonly score: number;
}

/** One other public project whose index the merge file lists. */
export interface OtherIndex {
  /** The project's id in the network file. */
  readonly id: string;
  /** The label shown beside its results. */
  readonly title: string;
  /** The folder that holds the project's search index. */
  readonly index: string;
}

/** The list of other indexes the engine writes; no content of another project is copied here. */
export interface MergeList {
  /** The public projects other than this one, in the network file's order. */
  readonly others: readonly OtherIndex[];
}

/** True for a plain object, never an array or `null`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-empty string, or undefined. */
function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Reads the engine's `pagefind-network.json`: its `others` list, with an id, a title, and an index
 * folder for each public project. Anything malformed is left out; a file with no usable entry gives
 * `undefined`, so the scope stays on this project alone.
 */
export function readMergeList(value: unknown): MergeList | undefined {
  if (!isRecord(value) || !Array.isArray(value.others)) return undefined;

  const others: OtherIndex[] = [];
  for (const item of value.others) {
    if (!isRecord(item)) continue;
    const id = textOf(item.id);
    const title = textOf(item.title);
    const index = textOf(item.index);
    if (id === undefined || title === undefined || index === undefined) continue;
    others.push({ id, title, index });
  }
  return { others };
}

/**
 * Merges each project's results into one list, highest score first. On an equal score the current
 * project's result stays first; the rest keep the order they arrived in, so the list never jumps
 * between an update that added no ordering information.
 */
export function mergeResults(groups: readonly (readonly SearchResult[])[]): readonly SearchResult[] {
  return groups
    .flatMap((group) => group)
    .map((result, order) => ({ result, order }))
    .sort(
      (a, b) =>
        b.result.score - a.result.score ||
        Number(b.result.current) - Number(a.result.current) ||
        a.order - b.order,
    )
    .map(({ result }) => result);
}

/** One other project whose index did not answer, as the island reports it. */
export interface FailedIndex {
  /** The project's id in the network file. */
  readonly id: string;
  /** The label the failure notice shows. */
  readonly title: string;
}

/** The network project a result came from, when the network still lists it. */
function projectOf(network: SiteNetwork | undefined, id: string): SiteNetwork["projects"][number] | undefined {
  return network?.projects.find((project) => project.id === id);
}

/**
 * The address of one result under its project's base path. The index gives a project-relative URL;
 * the network's `path` supplies the base, and a URL that already carries it is left alone. A project
 * the network no longer lists keeps the URL the index returned.
 */
export function resultHref(result: SearchResult, network: SiteNetwork | undefined): string {
  const project = projectOf(network, result.project);
  if (project === undefined) return result.url;
  const base = `/${project.path.replace(/^\/+|\/+$/g, "")}`;
  if (result.url === base || result.url.startsWith(`${base}/`)) return result.url;
  return `${base}${result.url.startsWith("/") ? result.url : `/${result.url}`}`;
}

/** The project label a result shows: only another project's results are labelled, never this one's. */
export function resultLabel(result: SearchResult, network: SiteNetwork | undefined): string | undefined {
  if (result.current) return undefined;
  return projectOf(network, result.project)?.title;
}
