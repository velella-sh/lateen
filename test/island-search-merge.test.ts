import assert from "node:assert/strict";
import { test } from "node:test";
import { search, type ScopeEnv, type SearchIndex } from "../chrome/search-scope/island.ts";
import { mergeResults, readMergeList, type SearchResult } from "../src/search/merge.ts";
import { waitFor } from "./helpers/wait.ts";

function hit(project: string, title: string, score: number, current = false): SearchResult {
  return { project, current, title, url: `/${project}/${title}/`, excerpt: `${title} excerpt`, score };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function indexOf(results: readonly SearchResult[]): SearchIndex {
  return { search: async () => results };
}

const LIST = {
  version: 1,
  scope: { parameter: "scope", values: ["project", "all"], default: "project" },
  project: { id: "alpha", title: "Alpha", index: "/alpha/pagefind" },
  others: [
    { id: "beta", title: "Beta Docs", index: "/beta/pagefind" },
    { id: "gamma", title: "Gamma", index: "/gamma/pagefind" },
  ],
};

test("merges three indexes by score and keeps the current project first on a tie", () => {
  const merged = mergeResults([
    [hit("alpha", "Alpha install", 5, true), hit("alpha", "Alpha guide", 2, true)],
    [hit("beta", "Beta install", 9), hit("beta", "Beta guide", 5)],
    [hit("gamma", "Gamma install", 5)],
  ]);
  assert.deepEqual(
    merged.map((result) => result.title),
    ["Beta install", "Alpha install", "Beta guide", "Gamma install", "Alpha guide"],
  );
});

test("reads only the other public indexes the engine lists", () => {
  assert.deepEqual(readMergeList(LIST)?.others.map((project) => project.id), ["beta", "gamma"]);
  assert.equal(readMergeList(undefined), undefined);
  assert.equal(readMergeList({ others: "none" }), undefined);
  assert.deepEqual(
    readMergeList({ others: [{ id: "beta" }, { id: "gamma", title: "Gamma", index: "/gamma/pagefind" }] })?.others.map(
      (project) => project.id,
    ),
    ["gamma"],
  );
});

test("shows this project's results at once and adds each other index as it answers", async () => {
  const list = deferred<unknown>();
  const betaIndex = deferred<SearchIndex>();
  const gammaIndex = deferred<SearchIndex>();
  const shows: { titles: string[]; complete: boolean }[] = [];
  const announced: number[] = [];
  const loads: string[] = [];

  const env: ScopeEnv = {
    scope: "all",
    current: indexOf([hit("alpha", "Alpha install", 2, true)]),
    listUrl: "/pagefind-network.json",
    loadList: async (url) => {
      loads.push(url);
      return list.promise;
    },
    loadIndex: async (url) => {
      loads.push(url);
      return url.startsWith("/beta/") ? betaIndex.promise : gammaIndex.promise;
    },
    show: (results, complete) => shows.push({ titles: results.map((result) => result.title), complete }),
    announce: (count) => announced.push(count),
  };

  const run = search("install", env);
  await waitFor(() => shows.length === 1 && announced.length === 1 && loads.length === 1);
  assert.deepEqual(shows, [{ titles: ["Alpha install"], complete: false }]);
  assert.deepEqual(announced, [1]);
  assert.deepEqual(loads, ["/pagefind-network.json"]);

  list.resolve(LIST);
  await waitFor(() => loads.length === 3);
  assert.deepEqual(loads, ["/pagefind-network.json", "/beta/pagefind", "/gamma/pagefind"]);

  betaIndex.resolve(indexOf([hit("beta", "Beta install", 9)]));
  await waitFor(() => announced.at(-1) === 2);
  assert.deepEqual(shows.at(-1), { titles: ["Beta install", "Alpha install"], complete: false });
  assert.equal(announced.at(-1), 2);

  gammaIndex.resolve(indexOf([hit("gamma", "Gamma install", 5)]));
  await run;
  assert.deepEqual(shows.at(-1), { titles: ["Beta install", "Gamma install", "Alpha install"], complete: true });
  assert.equal(announced.at(-1), 3);
  assert.equal(shows.filter((show) => show.complete).length, 1);
});

test("a failed index is reported and never holds back the others", async () => {
  const failed: string[] = [];
  const shows: { titles: string[]; complete: boolean }[] = [];

  const env: ScopeEnv = {
    scope: "all",
    current: indexOf([hit("alpha", "Alpha install", 2, true)]),
    listUrl: "/pagefind-network.json",
    loadList: async () => LIST,
    loadIndex: async (url) => {
      if (url.startsWith("/gamma/")) throw new Error("index unavailable");
      return indexOf([hit("beta", "Beta install", 9)]);
    },
    show: (results, complete) => shows.push({ titles: results.map((result) => result.title), complete }),
    failed: (project) => failed.push(project.id),
  };

  await search("install", env);
  assert.deepEqual(failed, ["gamma"]);
  assert.deepEqual(shows.at(-1), { titles: ["Beta install", "Alpha install"], complete: true });
});

test("nothing beyond this project's index is read before the reader picks all", async () => {
  let loaded = 0;
  const env: ScopeEnv = {
    scope: "project",
    current: indexOf([hit("alpha", "Alpha install", 2, true)]),
    listUrl: "/pagefind-network.json",
    loadList: async () => {
      loaded += 1;
      return LIST;
    },
    loadIndex: async () => {
      loaded += 1;
      return indexOf([]);
    },
    show: () => {},
  };

  await search("install", env);
  assert.equal(loaded, 0);
});
