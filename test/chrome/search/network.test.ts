import assert from "node:assert/strict";
import { test } from "node:test";
import type { SiteNetwork } from "@velella/mizzen/contracts";
import { searchNetwork } from "../../../chrome/search/network.ts";
import { type PagefindApi, type SearchHit } from "../../../chrome/search/loader.ts";

const network: SiteNetwork = {
  current: "alpha",
  lock: "hash",
  projects: [
    { id: "alpha", path: "alpha", title: "Alpha Docs", current: true, search: "find-alpha" },
    { id: "beta", path: "beta", title: "Beta Docs", current: false, search: "find-beta" },
    { id: "gamma", path: "gamma", title: "Gamma Docs", current: false },
  ],
};

test("network Pagefind ranks lazy hits, reuses canonical URLs, and isolates failed indexes", async () => {
  const requests: string[] = [];
  const failed: string[] = [];
  const updates: Array<{ hits: readonly SearchHit[]; complete: boolean }> = [];
  let recordsRead = 0;
  const api = (url: string): PagefindApi => ({
    async search(term) {
      assert.equal(term, "install");
      return { results: [{ score: 8, async data() {
        recordsRead += 1;
        return { url, excerpt: "install on this project" };
      } }] };
    },
  });

  await searchNetwork("install", {
    base: "/alpha",
    network,
    async current() { return api("/alpha#install"); },
    async loadList(url) {
      requests.push(url);
      return {
        others: [
          { id: "beta", title: "Beta Docs", index: "/beta/find-beta" },
          { id: "gamma", title: "Gamma Docs", index: "/gamma/pagefind" },
        ],
      };
    },
    async load(url) {
      requests.push(url);
      if (url === "/gamma/pagefind/pagefind.js") throw new Error("offline");
      return api("/guide/install/");
    },
    failed(project) { if (project !== undefined) failed.push(project.title); },
    show(hits, complete) { updates.push({ hits, complete }); },
  });

  assert.deepEqual(requests, ["/alpha/pagefind-network.json", "/beta/find-beta/pagefind.js", "/gamma/pagefind/pagefind.js"]);
  assert.deepEqual(failed, ["Gamma Docs"]);
  assert.equal(updates[0]?.hits.length, 1);
  assert.equal(updates[0]?.complete, false);
  const final = updates.at(-1)!;
  assert.equal(final.complete, true);
  assert.equal(recordsRead, 0);
  const records = await Promise.all(final.hits.map((hit) => hit.data()));
  assert.deepEqual(records.map(({ url, projectLabel }) => [url, projectLabel]), [
    ["/alpha#install", "Alpha Docs"],
    ["/beta/guide/install/", "Beta Docs"],
  ]);
});

test("network Pagefind can show other projects even when the current index fails", async () => {
  const failed: Array<string | undefined> = [];
  let complete = false;
  let found = 0;
  await searchNetwork("install", {
    base: "/alpha",
    network,
    async current() { throw new Error("offline"); },
    async loadList() {
      return { others: [{ id: "beta", title: "Beta Docs", index: "/beta/find-beta" }] };
    },
    async load() {
      return { search: async () => ({ results: [{ data: async () => ({ url: "/install/", excerpt: "" }) }] }) };
    },
    show(hits, done) { found = hits.length; complete = done; },
    failed(project) { failed.push(project?.id); },
  });

  assert.deepEqual(failed, ["alpha"]);
  assert.equal(found, 1);
  assert.equal(complete, true);
});

test("network facets pass the same filters to each index for a filter-only query", async () => {
  const query = { filters: { region: "north" } };
  const calls: unknown[] = [];
  const api: PagefindApi = {
    async search(term, options) {
      calls.push([term, options]);
      return { results: [] };
    },
  };
  await searchNetwork("", {
    base: "/alpha",
    network,
    query,
    current: async () => api,
    loadList: async () => ({ others: [{ id: "beta", title: "Beta Docs", index: "/beta/find-beta" }] }),
    load: async () => api,
    show() {},
    failed: () => assert.fail("the filter-only query is valid"),
  });
  assert.deepEqual(calls, [[null, query], [null, query]]);
});
