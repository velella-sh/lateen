import assert from "node:assert/strict";
import { test } from "node:test";
import { FetchError, fetchJson, fetchText, isAbortError, type FetchResponse } from "../src/fetch.ts";

/** A response the boundary accepts, with the body the test gives it. */
const response = (body: string, status = 200): FetchResponse => ({
  ok: status >= 200 && status < 300,
  status,
  text: () => Promise.resolve(body),
});

test("a successful request resolves to the body text", async () => {
  const signal = new AbortController().signal;
  let seen: { url: string; signal?: AbortSignal } | undefined;
  const text = await fetchText((url, init) => {
    seen = { url, ...(init?.signal === undefined ? {} : { signal: init.signal }) };
    return Promise.resolve(response("hello"));
  }, "/page.md", signal);

  assert.equal(text, "hello");
  assert.deepEqual(seen, { url: "/page.md", signal });
});

test("an HTTP error rejects with the URL and status and never reads the body", async () => {
  let read = false;
  const failing: FetchResponse = {
    ok: false,
    status: 404,
    text: () => {
      read = true;
      return Promise.resolve("missing");
    },
  };

  await assert.rejects(fetchText(() => Promise.resolve(failing), "/missing.md"), (error: unknown) => {
    assert.ok(error instanceof FetchError);
    assert.equal(error.failure, "http");
    assert.equal(error.status, 404);
    assert.match(error.message, /\/missing\.md/);
    return true;
  });
  assert.equal(read, false, "a failed response's body is not read");
});

test("a missing fetch is a defined failure, not a crash", async () => {
  await assert.rejects(fetchText(undefined, "/page.md"), (error: unknown) => {
    assert.ok(error instanceof FetchError);
    assert.equal(error.failure, "unavailable");
    return true;
  });
});

test("an abort rejects with the browser's AbortError untouched", async () => {
  const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
  const signal = new AbortController().signal;

  await assert.rejects(fetchText(() => Promise.reject(aborted), "/page.md", signal), (error: unknown) => {
    assert.equal(error, aborted);
    return true;
  });
  assert.equal(isAbortError(aborted), true);
});

test("a network failure passes through and is not read as an abort", async () => {
  const offline = new Error("offline");

  await assert.rejects(fetchText(() => Promise.reject(offline), "/page.md"), (error: unknown) => {
    assert.equal(error, offline);
    return true;
  });
  assert.equal(isAbortError(offline), false);
  for (const value of [null, undefined, "AbortError", {}, { name: 1 }]) {
    assert.equal(isAbortError(value), false, `${String(value)} is not an abort`);
  }
});

test("JSON is parsed, and malformed or non-JSON content is one defined failure", async () => {
  assert.deepEqual(await fetchJson(() => Promise.resolve(response('{"rows":[1]}')), "/index.json"), { rows: [1] });
  assert.equal(await fetchJson(() => Promise.resolve(response("null")), "/index.json"), null);

  for (const body of ['{"rows":', "<!doctype html><p>not json</p>", ""]) {
    await assert.rejects(fetchJson(() => Promise.resolve(response(body)), "/index.json"), (error: unknown) => {
      assert.ok(error instanceof FetchError);
      assert.equal(error.failure, "parse");
      assert.match(error.message, /\/index\.json/);
      return true;
    });
  }
});
