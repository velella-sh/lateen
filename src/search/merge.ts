import type { SiteNetwork } from "@velella/mizzen/contracts";

/** One heading Pagefind lists for a page, and the id its fragment points at. */
export interface PagefindAnchor {
  readonly id?: string | undefined;
  readonly text?: string | undefined;
}

/** One subsection Pagefind computed for a page; its URL carries the heading fragment. */
export interface PagefindSubResult {
  readonly url?: string | undefined;
  readonly title?: string | undefined;
}

/** The Pagefind keys that name a result's subsections, when the index supplies them. */
export interface HeadingSource {
  readonly sub_results?: readonly PagefindSubResult[] | undefined;
  readonly anchors?: readonly PagefindAnchor[] | undefined;
}

/** One search result after a project's index returned it, with the score and project the merge needs. */
export interface SearchResult extends HeadingSource {
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
  /** The result's language tag, when the index carries one. */
  readonly lang?: string;
  /** The site version the result belongs to, when the index carries one. */
  readonly version?: string;
  /** The index's score; higher ranks first. */
  readonly score: number;
}

/** A URL's decoded fragment, without the `#`; undefined when it has none. */
function fragmentOf(url: string): string | undefined {
  const hash = url.indexOf("#");
  if (hash === -1) return undefined;
  const fragment = url.slice(hash + 1);
  if (fragment === "") return undefined;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/**
 * The real heading text for the fragment a result's URL already carries: the matching Pagefind
 * `sub_results` title first, then the matching `anchors` text. A URL without a fragment, or one the
 * index has no heading for, gives undefined: a fragment is never invented.
 */
export function resultHeading(url: string, source?: HeadingSource | undefined): string | undefined {
  const fragment = fragmentOf(url);
  if (fragment === undefined) return undefined;

  for (const sub of source?.sub_results ?? []) {
    const title = sub.title?.trim();
    if (sub.url !== undefined && fragmentOf(sub.url) === fragment && title !== undefined && title !== "") {
      return title;
    }
  }
  for (const anchor of source?.anchors ?? []) {
    const text = anchor.text?.trim();
    if (anchor.id === fragment && text !== undefined && text !== "") return text;
  }
  return undefined;
}

/**
 * The section path a result's URL sits under: its parent directory, without the page's own segment.
 * `/guide/install/` gives `/guide/`; a page at the root gives an empty string. The URL is the index's
 * own metadata, so the path is never a guessed label.
 */
export function sectionPath(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url, "https://lateen.invalid").pathname;
  } catch {
    return "";
  }
  const segments = pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  // The last segment is the page itself; what is left is the section it sits in.
  segments.pop();
  return segments.length === 0 ? "" : `/${segments.join("/")}/`;
}

/**
 * Each result's section path, in the order given. Every path reads empty when no result has one or
 * when all results share the same one: the path is only there to tell results apart.
 */
export function sectionPaths(urls: readonly string[]): readonly string[] {
  const paths = urls.map(sectionPath);
  const first = paths[0] ?? "";
  return paths.every((path) => path === first) ? paths.map(() => "") : paths;
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
