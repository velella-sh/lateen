import assert from "node:assert/strict";
import { test } from "node:test";
import { hrefOf, pageWith, props, render } from "./helpers.ts";

const gitlab = { url: "https://gitlab.com/group/repo" };

test("template, labels and title prefix on GitHub", () => {
  const url = hrefOf(
    render(props(pageWith(), undefined, { reportIssue: { template: "docs.md", labels: ["docs", "needs triage"], titlePrefix: "[docs]" } })),
  );
  assert.equal(url.searchParams.get("template"), "docs.md");
  assert.equal(url.searchParams.get("labels"), "docs,needs triage");
  assert.equal(url.searchParams.get("title"), "[docs] Install");
});

test("GitLab takes the template as issuable_template and no labels", () => {
  const url = hrefOf(render(props(pageWith(), gitlab, { reportIssue: { template: "Bug", labels: ["x"] } })));
  assert.equal(url.searchParams.get("issuable_template"), "Bug");
  assert.equal(url.searchParams.has("labels"), false);
});

test("a custom tracker url is filled in one pass with encoded values", () => {
  const page = pageWith({ title: "A & {body}", lang: "fa" });
  const html = render(
    props(page, { url: "https://git.example.org/x" }, {
      reportIssue: { url: "https://tracker.example/new?t={title}&u={url}&l={lang}&v={version}&z={nope}" },
    }),
  );
  const url = hrefOf(html);
  assert.equal(url.host, "tracker.example");
  assert.equal(url.searchParams.get("t"), "A & {body}");
  assert.equal(url.searchParams.get("u"), "/example/guide/install/");
  assert.equal(url.searchParams.get("l"), "fa");
  assert.equal(url.searchParams.get("v"), "2.1");
  assert.equal(url.searchParams.get("z"), "{nope}");
});

test("a custom url works without a repository", () => {
  assert.notEqual(render(props(pageWith(), null, { reportIssue: { url: "https://t.example/?t={title}" } })), "");
});

test("an unsafe scheme is not linked", () => {
  for (const url of ["http://t.example/?t={title}", "javascript:alert({title})", "ftp://t.example/{title}", "{title}"]) {
    assert.equal(render(props(pageWith(), undefined, { reportIssue: { url } })), "", url);
  }
});

test("false turns the unit off", () => {
  assert.equal(render(props(pageWith(), undefined, { reportIssue: false })), "");
});

test("unusable option values fall back to defaults", () => {
  const url = hrefOf(render(props(pageWith(), undefined, { reportIssue: { template: 3, labels: "x", titlePrefix: "" } })));
  assert.equal(url.searchParams.get("title"), "Install");
  assert.equal(url.searchParams.has("template"), false);
});
