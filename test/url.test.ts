// The one address serializer the list and compare islands share: it rewrites only the query names a
// caller names, keeps every other parameter and the fragment, encodes values once, repeats a filter
// in order, and returns the address in the form it came in.

import assert from "node:assert/strict";
import { test } from "node:test";
import { withParams } from "../src/url.ts";

test("other parameters and the fragment stay, in place", () => {
  assert.equal(
    withParams("https://example.test/gallery/?lang=fa&filter.status=done#grid", {
      "filter.status": "draft",
      sort: "title",
      order: "asc",
    }),
    "https://example.test/gallery/?lang=fa&filter.status=draft&sort=title&order=asc#grid",
  );
});

test("values are encoded once and read back unchanged", () => {
  const url = withParams("?lang=fa", { q: "a b&c", records: "a,b", "filter.topic": "کتاب" });
  assert.equal(url, "?lang=fa&q=a+b%26c&records=a%2Cb&filter.topic=%DA%A9%D8%AA%D8%A7%D8%A8");
  const params = new URLSearchParams(url);
  assert.equal(params.get("q"), "a b&c");
  assert.equal(params.get("records"), "a,b");
  assert.equal(params.get("filter.topic"), "کتاب");
});

test("a repeated filter keeps its values in order and replaces what was there", () => {
  const url = withParams("?filter.shelf=old&lang=fa", { "filter.shelf": ["history", "fiction"] });
  assert.equal(url, "?lang=fa&filter.shelf=history&filter.shelf=fiction");
  assert.deepEqual(new URLSearchParams(url).getAll("filter.shelf"), ["history", "fiction"]);
});

test("a null value removes the parameter, and the last one leaves a bare query", () => {
  assert.equal(withParams("?q=x&sort=title", { q: null }), "?sort=title");
  assert.equal(withParams("?q=x", { q: null }), "");
});

test("drop removes every name it matches before the changes apply", () => {
  const url = withParams(
    "?q=x&filter.a=1&filter.b=2&lang=fa",
    { q: "y" },
    (name) => name === "q" || name.startsWith("filter."),
  );
  assert.equal(url, "?lang=fa&q=y");
});

test("a root-relative address stays relative and keeps its path", () => {
  assert.equal(withParams("/books/?q=x#top", { sort: "title" }), "/books/?q=x&sort=title#top");
  assert.equal(withParams("/gallery/"), "/gallery/");
});

test("a query-only address stays query-only, and an empty one stays empty", () => {
  assert.equal(withParams("?lang=fa", { records: "a,b" }), "?lang=fa&records=a%2Cb");
  assert.equal(withParams("", { records: "a" }), "?records=a");
  assert.equal(withParams(""), "");
});
