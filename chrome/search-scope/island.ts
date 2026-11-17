/*
 * Cross-project search island: the current project's index always runs first, so its results appear
 * at once. Only when the reader picks the `all` scope does it read the engine's merge file and load
 * the other public projects' indexes, adding their results as each one answers. One slow or failed
 * index never holds back the others, and nothing from another project is fetched before `all`.
 */

import { SCOPE_ALL } from "./index.ts";
import { mergeResults, readMergeList, type SearchResult } from "../../src/search/merge.ts";

/** One project's search index, as the island calls it. */
export interface SearchIndex {
  search(term: string): Promise<readonly SearchResult[]>;
}

/** Everything the island reads from the page and the network; tests pass fakes. */
export interface ScopeEnv {
  /** The chosen scope: `project` or `all`, from the engine's contract. */
  readonly scope: string;
  /** This project's index, already loaded and searchable without another request. */
  readonly current: SearchIndex;
  /** The address of the engine's merge file, `pagefind-network.json` at the site root. */
  readonly listUrl: string;
  /** Reads the merge file; only called for the `all` scope. */
  readonly loadList: (url: string) => Promise<unknown>;
  /** Loads one other project's index; only called for the `all` scope, after the merge file. */
  readonly loadIndex: (url: string) => Promise<SearchIndex>;
  /** Draws the merged list: `complete` is false while another index may still add results. */
  readonly show: (results: readonly SearchResult[], complete: boolean) => void;
  /** Announces the new count after each update. */
  readonly announce?: (count: number) => void;
  /** Reports one other project whose index did not answer. */
  readonly failed?: (project: { readonly id: string; readonly title: string }) => void;
}

/** The query the island runs, and the project whose results rank first on a tie. */
export async function search(term: string, env: ScopeEnv): Promise<void> {
  const own = await env.current.search(term);
  const loaded: (readonly SearchResult[])[] = [own];
  let merged = mergeResults(loaded);

  // The current project's results never wait for the network or for another index.
  env.show(merged, env.scope !== SCOPE_ALL);
  env.announce?.(merged.length);
  if (env.scope !== SCOPE_ALL) return;

  let list: ReturnType<typeof readMergeList>;
  try {
    list = readMergeList(await env.loadList(env.listUrl));
  } catch {
    list = undefined;
  }
  if (list === undefined || list.others.length === 0) {
    env.show(merged, true);
    return;
  }

  let done = 0;
  await Promise.all(
    list.others.map(async (project) => {
      try {
        const index = await env.loadIndex(project.index);
        const results = await index.search(term);
        loaded.push(results);
      } catch {
        env.failed?.(project);
      }
      done += 1;
      merged = mergeResults(loaded);
      env.show(merged, done === list.others.length);
      env.announce?.(merged.length);
    }),
  );
}
