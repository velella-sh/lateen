import assert from "node:assert/strict";
import { test } from "node:test";
import { clipTitle, encodePath, fitUrl, hostOf, issueUrl, oneLine, sourcePath, webRoot } from "../src/repository.ts";

test("hostOf detects GitHub, GitLab and others", () => {
  assert.equal(hostOf({ url: "https://github.com/a/b" }), "github");
  assert.equal(hostOf({ url: "https://gitlab.example.com/a/b" }), "gitlab");
  assert.equal(hostOf({ url: "https://git.example.org/a/b" }), undefined);
  assert.equal(hostOf({ url: "ftp://github.com/a" }), undefined);
  assert.equal(hostOf({ url: "not a url" }), undefined);
});

test("path and root helpers", () => {
  assert.equal(webRoot(" https://github.com/a/b// "), "https://github.com/a/b");
  assert.equal(sourcePath(".\\docs\\a.md"), "docs/a.md");
  assert.equal(sourcePath("/docs/a.md"), "docs/a.md");
  assert.equal(encodePath("a b/c#d"), "a%20b/c%23d");
  assert.equal(oneLine(" a\n b  "), "a b");
});

test("clipTitle keeps short titles and cuts long ones with an ellipsis", () => {
  assert.equal(clipTitle("short"), "short");
  const cut = clipTitle("x".repeat(300));
  assert.equal([...cut].length, 256);
  assert.ok(cut.endsWith("…"));
});

test("issueUrl shapes GitHub and GitLab and appends extra", () => {
  assert.equal(issueUrl("https://github.com/a/b", "github", "T", "B"), "https://github.com/a/b/issues/new?title=T&body=B");
  assert.equal(
    issueUrl("https://gitlab.com/a/b", "gitlab", "T", "B", "&x=1"),
    "https://gitlab.com/a/b/-/issues/new?issue[title]=T&issue[description]=B&x=1",
  );
});

test("fitUrl shortens the body to the limit and keeps extra", () => {
  const url = fitUrl("https://github.com/a/b", "github", "T", "é".repeat(5000), "&labels=x");
  assert.ok(url !== undefined && url.length <= 8000 && url.endsWith("&labels=x"));
  assert.equal(fitUrl("https://github.com/a/b", "github", "T".repeat(9000), "b"), undefined);
});
