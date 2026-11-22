import type { NetworkProject, SiteNetwork } from "@velella/mizzen/contracts";
import { fetchJson } from "../../src/fetch.ts";
import { resultHref, resultLabel } from "../../components/search-result/model.ts";
import type { FailedIndex } from "../../src/search/merge.ts";
import { search, type SearchIndex } from "../search-scope/island.ts";
import { indexUrl, loadIndex, type PagefindApi, type SearchHit } from "./loader.ts";
import { fillMessage, type SearchMessages } from "./messages.ts";
import { safeHref, type SearchRecord } from "./options.ts";
import { RESULT_LIMIT, type SearchDialog } from "./types.ts";

interface RankedHit extends SearchHit {
  readonly score: number;
  readonly current: boolean;
}

interface NetworkSearchOptions {
  readonly base: string;
  readonly network: SiteNetwork;
  readonly current: () => Promise<PagefindApi>;
  readonly load?: (url: string) => Promise<PagefindApi>;
  readonly loadList?: (url: string) => Promise<unknown>;
  readonly show: (hits: readonly SearchHit[], complete: boolean) => void;
  readonly failed: (project?: FailedIndex) => void;
}

/** Searches the live project indexes and leaves Pagefind's result data lazy for paging. */
export function searchNetwork(term: string, options: NetworkSearchOptions): Promise<void> {
  const { base, network, current, load = loadIndex, show, failed } = options;
  const currentProject = network.projects.find((project) => project.id === network.current);
  const others = new Map(network.projects.filter((project) => !project.current)
    .map((project) => [indexUrl(`/${project.path}`, project.search), project]));
  const loadList = options.loadList ?? ((url) => fetchJson((address) => globalThis.fetch(address), url));

  const index = (get: () => Promise<PagefindApi>, project?: NetworkProject): SearchIndex<RankedHit> => ({
    async search(query) {
      const api = await get();
      const { results } = await api.search(query);
      const identity = { project: project?.id ?? network.current, current: project?.current ?? true };
      const projectLabel = resultLabel(identity, network, true);
      return results.map((hit) => ({
        score: hit.score ?? 0,
        current: identity.current,
        async data() {
          const record = await hit.data();
          const url = safeHref(record.url);
          return {
            ...record,
            url: url === undefined ? record.url : resultHref({ ...identity, url }, network),
            projectLabel,
          };
        },
      }));
    },
  });

  return search(term, {
    scope: "all",
    current: index(current, currentProject),
    currentProject,
    listUrl: `${base.replace(/\/$/, "")}/pagefind-network.json`,
    loadList,
    async loadIndex(folder) {
      const url = `${folder.replace(/\/$/, "")}/pagefind.js`;
      const project = others.get(url);
      if (project === undefined) throw new Error(`Unknown search index: ${folder}`);
      return index(() => load(url), project);
    },
    show,
    failed,
    manifestFailed: failed,
  });
}

interface DialogSearchOptions extends Omit<NetworkSearchOptions, "show" | "failed"> {
  readonly valid: () => boolean;
  readonly dialog: Pick<SearchDialog, "getAttribute">;
  readonly messages: SearchMessages;
  readonly showRecords: (records: readonly SearchRecord[], notices: string) => void;
}

/** Materializes only the visible dialog rows, allowing each completed index to update the list. */
export async function searchNetworkDialog(term: string, options: DialogSearchOptions): Promise<void> {
  const notices: string[] = [];
  const { failed } = options.messages;
  const failurePattern = options.dialog.getAttribute("data-search-project-failed") ?? failed;
  let revision = 0;
  let drawing = Promise.resolve();
  await searchNetwork(term, {
    ...options,
    failed: (project) => {
      notices.push(project === undefined
        ? failed
        : fillMessage(failurePattern, { project: project.title }));
    },
    show(hits, complete) {
      if (!options.valid() || (!complete && hits.length === 0)) return;
      const update = ++revision;
      drawing = Promise.all(hits.slice(0, RESULT_LIMIT).map((hit) => hit.data())).then(
        (records) => {
          if (options.valid() && update === revision) options.showRecords(records, notices.join(" "));
        },
        () => {
          if (options.valid() && update === revision) options.showRecords([], failed);
        },
      );
    },
  });
  await drawing;
}
