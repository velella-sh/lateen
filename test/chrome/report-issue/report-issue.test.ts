import assert from "node:assert/strict";
import { test } from "node:test";
import { t } from "../../../i18n/index.ts";
import { hrefOf, pageWith, props, render } from "./helpers.ts";

test("GitHub: opens a new issue with title and body filled", () => {
  const url = hrefOf(render());
  assert.equal(url.origin + url.pathname, "https://github.com/velella-sh/lateen/issues/new");
  assert.equal(url.searchParams.get("title"), "Install");
  const body = url.searchParams.get("body") ?? "";
  assert.match(body, /Page: \/example\/guide\/install\//);
  assert.match(body, /Source: docs\/guide\/install\.md/);
  assert.match(body, /Language: en/);
  assert.match(body, /Version: 2\.1/);
});

test("GitLab: uses the GitLab issue shape", () => {
  const url = hrefOf(render(props(pageWith(), { url: "https://gitlab.com/group/repo" })));
  assert.equal(url.pathname, "/group/repo/-/issues/new");
  assert.equal(url.searchParams.get("issue[title]"), "Install");
  assert.match(url.searchParams.get("issue[description]") ?? "", /Source: docs/);
});

test("renders nothing for an unknown host and for no repository", () => {
  assert.equal(render(props(pageWith(), { url: "https://git.example.org/team/repo" })), "");
  assert.equal(render(props(pageWith(), null)), "");
});

test("a long title is cut and the URL stays within the limit", () => {
  const long = "A".repeat(600);
  const href = hrefOf(render(props(pageWith({ title: long, frontMatter: {} }))));
  assert.ok([...(href.searchParams.get("title") ?? "")].length <= 256);
  assert.ok(href.href.length <= 8000);
  assert.doesNotMatch(href.search, /Version:/);
});

test("the label is translated in en, fa and ar", () => {
  for (const lang of ["en", "fa", "ar"]) {
    const html = render(props(pageWith({ lang, dir: lang === "en" ? "ltr" : "rtl" })));
    assert.ok(html.includes(t(lang, "report_issue")), lang);
    assert.ok(t(lang, "report_issue") !== "report_issue");
  }
  assert.notEqual(t("fa", "report_issue"), t("en", "report_issue"));
  assert.notEqual(t("ar", "report_issue"), t("fa", "report_issue"));
});

test("it is a plain link: no script, no form", () => {
  const html = render();
  assert.doesNotMatch(html, /<script|<form|<button/);
});
