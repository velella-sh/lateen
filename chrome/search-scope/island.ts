/*
 * Cross-project search island: the current project's index always runs first, so its results appear
 * at once. Only when the reader picks the `all` scope does it read the engine's merge file and load
 * the other public projects' indexes, adding their results as each one answers. One slow or failed
 * index never holds back the others, and nothing from another project is fetched before `all`.
 */

import { mergeResults, readMergeList, type FailedIndex, type SearchResult } from "../../src/search/merge.ts";

type Ranked = Pick<SearchResult, "score" | "current">;

/** One project's search index, as the island calls it. */
export interface SearchIndex<Result extends Ranked = SearchResult> {
  search(term: string): Promise<readonly Result[]>;
}

/** Everything the island reads from the page and the network; tests pass fakes. */
export interface ScopeEnv<Result extends Ranked = SearchResult> {
  /** The chosen scope: `project` or `all`, from the engine's contract. */
  readonly scope: string;
  /** This project's index, already loaded and searchable without another request. */
  readonly current: SearchIndex<Result>;
  readonly currentProject?: FailedIndex | undefined;
  /** The address of the engine's merge file, `pagefind-network.json` at the site root. */
  readonly listUrl: string;
  /** Reads the merge file; only called for the `all` scope. */
  readonly loadList: (url: string) => Promise<unknown>;
  /** Loads one other project's index; only called for the `all` scope, after the merge file. */
  readonly loadIndex: (url: string) => Promise<SearchIndex<Result>>;
  /** Draws the merged list: `complete` is false while another index may still add results. */
  readonly show: (results: readonly Result[], complete: boolean) => void;
  /** Announces the new count after each update. */
  readonly announce?: (count: number) => void;
  /** Reports a project whose index did not answer, or the unavailable network manifest. */
  readonly failed?: (project: FailedIndex) => void;
  readonly manifestFailed?: () => void;
}

/** The query the island runs, and the project whose results rank first on a tie. */
export async function search<Result extends Ranked>(term: string, env: ScopeEnv<Result>): Promise<void> {
  const own = await env.current.search(term).catch((error: unknown) => {
    if (env.scope !== "all" || env.currentProject === undefined) throw error;
    env.failed?.(env.currentProject);
    return [];
  });
  const loaded: (readonly Result[])[] = [own];

  const show = (complete: boolean): void => {
    const merged = mergeResults(loaded);
    env.show(merged, complete);
    env.announce?.(merged.length);
  };

  // The current project's results never wait for the network or for another index.
  show(env.scope !== "all");
  if (env.scope !== "all") return;

  const list = await env.loadList(env.listUrl).then(readMergeList).catch(() => undefined);
  if (list === undefined) env.manifestFailed?.();
  if (list === undefined || list.others.length === 0) {
    show(true);
    return;
  }

  let done = 0;
  await Promise.all(
    list.others.map(async (project, order) => {
      try {
        const index = await env.loadIndex(project.index);
        loaded[order + 1] = await index.search(term);
      } catch {
        env.failed?.(project);
      }
      done += 1;
      show(done === list.others.length);
    }),
  );
}
