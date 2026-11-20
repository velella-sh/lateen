import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHUNK_CONCURRENCY,
  createIndexLoader,
  type CollectionIndex,
  type IndexEnv,
  type IndexField,
} from "../components/data-explorer/index-loader.ts";

/** A field that records its focus listeners; `focus()` runs them as the browser would. */
class FakeField implements IndexField {
  ownerDocument: { activeElement?: unknown } | null = { activeElement: null };
  private readonly listeners: (() => void)[] = [];

  addEventListener(_type: "focus", listener: () => void): void {
    this.listeners.push(listener);
  }

  focus(): void {
    for (const listener of this.listeners) listener();
  }
}

/** Flushes the loader's promise chain, which a focus event starts without returning it. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type Files = Readonly<Record<string, string>>;

/** A fake fetch over `files` that also reports the requests and how many ran at once. */
function environment(files: Files) {
  const calls: { url: string; signal: AbortSignal }[] = [];
  let inFlight = 0;
  let peak = 0;
  const env: IndexEnv = {
    async fetchJson(url, signal) {
      calls.push({ url, signal });
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        await Promise.resolve();
        const body = files[url];
        if (body === undefined) throw new Error(`no file at ${url}`);
        return JSON.parse(body) as unknown;
      } finally {
        inFlight -= 1;
      }
    },
  };
  return { env, calls, peak: () => peak };
}

const head = (collection: string, columns: string[], rest: Record<string, unknown>): string =>
  JSON.stringify({ collection, columns, ...rest });

const book = (title: string, url: string): readonly (string | number | boolean | null)[] => [title, url];

test("nothing is fetched on page load, and a single file is the whole index", async () => {
  const field = new FakeField();
  const body = head("books", ["title", "url"], { rows: [book("Book 1", "/books/b1/"), book("Book 2", "/books/b2/")] });
  const { env, calls } = environment({ "/data/books.index.json": body });
  const ready: CollectionIndex[] = [];
  let failed = false;
  const loader = createIndexLoader({ field, base: "", collection: "books" }, env, {
    ready: (index) => ready.push(index),
    failed: () => {
      failed = true;
    },
  });

  assert.equal(calls.length, 0, "the page load makes no request");
  field.focus();
  await tick();
  assert.deepEqual(calls.map((call) => call.url), ["/data/books.index.json"]);
  assert.deepEqual(ready, [
    { columns: ["title", "url"], rows: [book("Book 1", "/books/b1/"), book("Book 2", "/books/b2/")] },
  ]);
  assert.equal(failed, false);
  assert.deepEqual(loader.index, ready[0]);

  field.focus();
  await tick();
  assert.equal(calls.length, 1, "a second focus uses the rows already in memory");
});

test("a field that already has focus when the loader starts loads at once", async () => {
  const field = new FakeField();
  field.ownerDocument = { activeElement: field };
  const { env, calls } = environment({
    "/data/books.index.json": head("books", ["title", "url"], { rows: [book("Book 1", "/books/b1/")] }),
  });
  const ready: CollectionIndex[] = [];
  createIndexLoader({ field, base: "", collection: "books" }, env, {
    ready: (index) => ready.push(index),
    failed: () => assert.fail("the index is valid"),
  });

  await tick();
  assert.equal(calls.length, 1);
  assert.equal(ready.length, 1);
});

test("chunks load in the listed order, four at a time, under the site base", async () => {
  const columns = ["title", "url"];
  const paths = Array.from({ length: 6 }, (_, at) => `data/books.index.${at + 1}.json`);
  const files: Record<string, string> = {
    "/alpha/data/books.index.json": head("books", columns, { chunks: paths }),
  };
  paths.forEach((path, at) => {
    files[`/alpha/${path}`] = head("books", columns, {
      rows: [book(`Book ${at + 1}`, `/alpha/books/${at + 1}/`)],
    });
  });

  const field = new FakeField();
  const { env, calls, peak } = environment(files);
  const ready: CollectionIndex[] = [];
  createIndexLoader({ field, base: "/alpha", collection: "books" }, env, {
    ready: (index) => ready.push(index),
    failed: () => assert.fail("every file is valid"),
  });

  field.focus();
  await tick();
  assert.deepEqual(
    calls.map((call) => call.url),
    ["/alpha/data/books.index.json", ...paths.map((path) => `/alpha/${path}`)],
  );
  assert.equal(peak(), CHUNK_CONCURRENCY, "no more than four chunks request at once");
  assert.deepEqual(ready, [
    {
      columns,
      rows: paths.map((_, at) => book(`Book ${at + 1}`, `/alpha/books/${at + 1}/`)),
    },
  ]);
});

test("a failed load reports a retry that starts again from the head", async () => {
  const field = new FakeField();
  const calls: string[] = [];
  let offline = true;
  const body = head("books", ["title", "url"], { rows: [book("Book 1", "/books/b1/")] });
  const env: IndexEnv = {
    fetchJson(url) {
      calls.push(url);
      return offline ? Promise.reject(new Error("offline")) : Promise.resolve(JSON.parse(body) as unknown);
    },
  };
  const ready: CollectionIndex[] = [];
  let retry: (() => void) | undefined;
  createIndexLoader({ field, base: "", collection: "books" }, env, {
    ready: (index) => ready.push(index),
    failed: (again) => {
      retry = again;
    },
  });

  field.focus();
  await tick();
  assert.deepEqual(calls, ["/data/books.index.json"]);
  assert.equal(ready.length, 0);
  assert.ok(retry, "a failure carries a retry");

  offline = false;
  retry();
  await tick();
  assert.deepEqual(calls, ["/data/books.index.json", "/data/books.index.json"]);
  assert.deepEqual(ready, [{ columns: ["title", "url"], rows: [book("Book 1", "/books/b1/")] }]);
});

test("a chunk that disagrees with the head is a failure, not rows to skip", async () => {
  const headBody = head("books", ["title", "url"], { chunks: ["data/books.index.1.json"] });
  const chunk = head("books", ["author", "url"], { rows: [book("Armin", "/books/b1/")] });
  const field = new FakeField();
  const { env } = environment({
    "/data/books.index.json": headBody,
    "/data/books.index.1.json": chunk,
  });
  let failed = false;
  const ready: CollectionIndex[] = [];
  createIndexLoader({ field, base: "", collection: "books" }, env, {
    ready: (index) => ready.push(index),
    failed: () => {
      failed = true;
    },
  });

  field.focus();
  await tick();
  assert.equal(failed, true);
  assert.deepEqual(ready, []);
});

test("a newer load aborts the request in flight and the old rows are ignored", async () => {
  const field = new FakeField();
  interface Pending {
    readonly signal: AbortSignal;
    readonly resolve: (body: unknown) => void;
    readonly reject: (error: unknown) => void;
  }
  const pending: Pending[] = [];
  const env: IndexEnv = {
    fetchJson(_url, signal) {
      return new Promise<unknown>((resolve, reject) => pending.push({ signal, resolve, reject }));
    },
  };
  const ready: CollectionIndex[] = [];
  let failed = false;
  const loader = createIndexLoader({ field, base: "", collection: "books" }, env, {
    ready: (index) => ready.push(index),
    failed: () => {
      failed = true;
    },
  });

  field.focus();
  const first = pending[0]!;
  assert.equal(first.signal.aborted, false);

  const secondLoad = loader.load();
  const second = pending[1]!;
  assert.equal(first.signal.aborted, true, "the superseded request is aborted");
  assert.equal(second.signal.aborted, false);

  first.resolve(JSON.parse(head("books", ["title", "url"], { rows: [book("Old", "/books/old/")] })));
  second.resolve(JSON.parse(head("books", ["title", "url"], { rows: [book("New", "/books/new/")] })));
  await secondLoad;
  await tick();

  assert.equal(failed, false);
  assert.deepEqual(ready, [{ columns: ["title", "url"], rows: [book("New", "/books/new/")] }]);
});
