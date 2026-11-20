import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createIndexLoader,
  indexUrl,
  type PagefindApi,
} from "../chrome/search/loader.ts";

test("the index URL follows the site base, with no double slash at the root", () => {
  assert.equal(indexUrl(""), "/pagefind/pagefind.js");
  assert.equal(indexUrl("/"), "/pagefind/pagefind.js");
  assert.equal(indexUrl("/example"), "/example/pagefind/pagefind.js");
  assert.equal(indexUrl("/example/"), "/example/pagefind/pagefind.js");
});

/** A load function the test settles by hand, recording every request it receives. */
function controllable() {
  const calls: Array<{
    url: string;
    resolve: (api: PagefindApi) => void;
    reject: (error: unknown) => void;
  }> = [];
  const load = (url: string): Promise<PagefindApi> =>
    new Promise<PagefindApi>((resolve, reject) => {
      calls.push({ url, resolve, reject });
    });
  return { calls, load };
}

const apiOf = (): PagefindApi => ({ search: () => Promise.resolve({ results: [] }) });

test("no index request occurs before the first load call", () => {
  const { calls, load } = controllable();
  const index = createIndexLoader(load);

  assert.equal(calls.length, 0, "creating the loader fetches nothing");
  assert.equal(index.api, undefined);
  assert.equal(index.loading, false);
});

test("concurrent loads share one request and one promise", async () => {
  const { calls, load } = controllable();
  const index = createIndexLoader(load);

  const first = index.load("/pagefind/pagefind.js");
  const second = index.load("/pagefind/pagefind.js");
  assert.equal(calls.length, 1, "the second caller joins the in-flight load");
  assert.equal(first, second, "both callers hold the very same promise");
  assert.equal(index.loading, true);
  assert.equal(index.api, undefined);

  const api = apiOf();
  calls[0]!.resolve(api);
  assert.equal(await first, api);
  assert.equal(await second, api);
  assert.equal(index.loading, false);
  assert.equal(index.api, api);

  assert.equal(await index.load("/pagefind/pagefind.js"), api, "a loaded index resolves at once");
  assert.equal(calls.length, 1, "and is never fetched again");
});

test("a rejected load can be retried, and the retry's success is remembered", async () => {
  const { calls, load } = controllable();
  const index = createIndexLoader(load);

  const failed = index.load("/pagefind/pagefind.js");
  calls[0]!.reject(new Error("offline"));
  await assert.rejects(failed, /offline/);
  assert.equal(index.loading, false, "the failure clears the in-flight load");
  assert.equal(index.api, undefined);

  const retried = index.load("/pagefind/pagefind.js");
  assert.equal(calls.length, 2, "the next call starts a fresh request");
  const api = apiOf();
  calls[1]!.resolve(api);
  assert.equal(await retried, api);
  assert.equal(index.api, api);
});

test("every concurrent caller sees the same rejection, and one retry serves them all", async () => {
  const { calls, load } = controllable();
  const index = createIndexLoader(load);

  const first = index.load("/pagefind/pagefind.js");
  const second = index.load("/pagefind/pagefind.js");
  calls[0]!.reject(new Error("offline"));
  await assert.rejects(first, /offline/);
  await assert.rejects(second, /offline/);
  assert.equal(calls.length, 1, "a shared failure is still one request");

  const retry = index.load("/pagefind/pagefind.js");
  const api = apiOf();
  calls[1]!.resolve(api);
  assert.equal(await retry, api);
  assert.equal(calls.length, 2);
});

test("the url reaches the load function unchanged", async () => {
  const { calls, load } = controllable();
  const index = createIndexLoader(load);

  const pending = index.load("/example/pagefind/pagefind.js");
  assert.equal(calls[0]!.url, "/example/pagefind/pagefind.js");
  calls[0]!.resolve(apiOf());
  await pending;
});