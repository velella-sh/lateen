import assert from "node:assert/strict";
import { test } from "node:test";
import type { Page, Site } from "@velella/mizzen/contracts";
import { stringsOf } from "../i18n/index.ts";
import { trustPanelViewOf } from "../components/trust-panel/view-model.ts";
import type { TrustPanelProps } from "../components/trust-panel/index.ts";

/** A site with the data, theme options, repository, and base the view model reads. */
function siteOf(
  data: Record<string, unknown>,
  options: Record<string, unknown> = {},
  base = "",
  repository?: Record<string, unknown>,
): Site {
  return { config: { base, theme: { options }, ...(repository === undefined ? {} : { repository }) }, pages: [], nav: {}, data } as unknown as Site;
}

/** A page with the fields the view model reads. */
function pageOf(overrides: Partial<Page> = {}): Page {
  return {
    url: "/guide/install/",
    source: { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 },
    frontMatter: {},
    title: "Install",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    ...overrides,
  };
}

/** The default page's URL, the key every data shape uses. */
const URL = "/guide/install/";

test("no entry names absent evidence, so the panel renders nothing", () => {
  assert.deepEqual(trustPanelViewOf({}, pageOf(), siteOf({})), { state: "absent" });
  assert.deepEqual(trustPanelViewOf({}, pageOf(), undefined), { state: "absent" });
  assert.deepEqual(trustPanelViewOf({}, pageOf(), siteOf({ trust: { "/other/": { level: "verified" } } })), {
    state: "absent",
  });
});

test("an unreadable entry names invalid unknown evidence and inherits no sibling claims", () => {
  const data = {
    trust: {
      [URL]: { level: "bogus", reasons: ["All passed."], lastReviewer: "Ada", buildId: "build-9", generatedAt: "2026-03-06" },
    },
    examples: { [URL]: { passed: 3, failed: 0, total: 3 } },
    drift: { [URL]: [] },
    build: { id: "build-9", generatedAt: "2026-03-06" },
    reviewers: { [URL]: { date: "2026-03-04", commit: "abcdef1" } },
  };
  const options = { trust: { contextPackUrl: "https://example.com/context?page={url}" } };
  const view = trustPanelViewOf({}, pageOf(), siteOf(data, options, "", { url: "https://github.com/example/docs" }));
  assert.deepEqual(view, {
    state: "invalid",
    chip: "Trust: Unknown",
    reasonsLabel: "Why this level",
    reasons: [stringsOf("en").trust_why_unknown],
  });
});

test("a manual panel with an unreadable level names the same invalid view", () => {
  const view = trustPanelViewOf({ level: "sort-of-okay", reasons: "claim" }, pageOf(), siteOf({}));
  assert.deepEqual(view, {
    state: "invalid",
    chip: "Trust: Unknown",
    reasonsLabel: "Why this level",
    reasons: [stringsOf("en").trust_why_unknown],
  });
});

test("a full entry selects every row, date, revision, and action", () => {
  const data = {
    trust: {
      [URL]: {
        level: "verified",
        reasons: ["All examples passed.", "No drift."],
        lastReviewer: "Ada",
        buildId: "build-42",
        generatedAt: "2026-03-06",
        reviewedAt: "2026-03-04",
        reviewedCommit: "ABCDEF1234567890",
      },
    },
    examples: { [URL]: { passed: 3, failed: 0, total: 3 } },
    drift: { [URL]: [] },
    build: { id: "build-42", asOf: "2026-03-06" },
  };
  const options = {
    trust: {
      contextPackUrl: "https://example.com/context?page={url}&build={build}",
      suggestEditUrl: "/edit/{source}",
    },
  };
  const view = trustPanelViewOf({}, pageOf(), siteOf(data, options, "/docs", { url: "https://github.com/example/docs" }));
  assert.deepEqual(view, {
    state: "valid",
    level: "verified",
    chip: "Trust: Verified",
    provenance: {
      buildId: "build-42",
      generatedAt: "2026-03-06",
      reviewedAt: "2026-03-04",
      reviewedCommit: "abcdef1234567890",
    },
    examples: {
      label: "Examples",
      text: "3 of 3 examples passed",
      className: "trust-panel-examples trust-panel-examples-passed",
      attrs: {
        "data-trust-examples": "passed",
        "data-trust-examples-passed": 3,
        "data-trust-examples-failed": 0,
        "data-trust-examples-total": 3,
      },
    },
    drift: { label: "Drift", text: "No drift findings" },
    generated: { label: "Updated", iso: "2026-03-06", text: "6 March 2026", exact: "6 March 2026" },
    reviewed: { label: "Reviewed", iso: "2026-03-04", text: "4 March 2026", exact: "4 March 2026" },
    revision: {
      label: "Reviewed revision",
      href: "https://github.com/example/docs/commit/abcdef1234567890",
      commit: "abcdef1234567890",
    },
    reviewer: { label: "Last reviewer", text: "Reviewed by Ada" },
    reasonsLabel: "Why this level",
    reasons: ["All examples passed.", "No drift."],
    actions: [
      { href: "https://example.com/context?page=/guide/install/&build=build-42", label: "Copy context pack" },
      { href: "/docs/edit/guide/install.md", label: "Suggest an edit" },
    ],
  });
});

test("missing and partial evidence keep the rows honest and omit provenance members", () => {
  const options = { trust: { contextPackUrl: "https://example.com/context?build={build}" } };
  const view = trustPanelViewOf({}, pageOf(), siteOf({ trust: { [URL]: { level: "partial" } } }, options));
  assert.deepEqual(view, {
    state: "valid",
    level: "partial",
    chip: "Trust: Partial",
    provenance: {},
    examples: {
      label: "Examples",
      text: "Not recorded",
      className: "trust-panel-examples trust-panel-examples-absent",
      attrs: { "data-trust-examples": "absent" },
    },
    drift: { label: "Drift", text: "Not recorded" },
    reviewer: { label: "Last reviewer", text: "No reviewer recorded" },
    reasonsLabel: "Why this level",
    reasons: [stringsOf("en").trust_why_partial],
    actions: [],
  });
});

test("the directive's props win over the site data", () => {
  const data = { trust: { [URL]: { level: "verified", reasons: ["Recorded."], lastReviewer: "Ada" } } };
  const props: TrustPanelProps = { level: "unreviewed", reasons: "Manual|Second", lastReviewer: "Grace" };
  const view = trustPanelViewOf(props, pageOf(), siteOf(data));
  assert.equal(view.state, "valid");
  if (view.state !== "valid") return;
  assert.equal(view.level, "unreviewed");
  assert.deepEqual(view.reasons, ["Manual", "Second"]);
  assert.deepEqual(view.reviewer, { label: "Last reviewer", text: "Reviewed by Grace" });
});

test("every label and text follows the page language, dates in its calendar", () => {
  const fa = stringsOf("fa");
  const data = { trust: { [URL]: { level: "verified", generatedAt: "2026-03-06" } } };
  const view = trustPanelViewOf({}, pageOf({ lang: "fa" }), siteOf(data));
  assert.equal(view.state, "valid");
  if (view.state !== "valid") return;
  assert.equal(view.chip, fa.trust_chip!.replace("{level}", fa.trust_level_verified!));
  assert.equal(view.examples.label, fa.trust_examples);
  assert.equal(view.examples.text, fa.trust_not_recorded);
  assert.equal(view.drift.label, fa.trust_drift);
  assert.equal(view.reviewer.label, fa.trust_reviewer);
  assert.equal(view.reviewer.text, fa.trust_reviewer_none);
  assert.equal(view.reasonsLabel, fa.trust_reasons);
  assert.deepEqual(view.reasons, [fa.trust_why_verified]);
  assert.deepEqual(view.generated, { label: fa.updated, iso: "2026-03-06", text: "۶ مارس ۲۰۲۶", exact: "۶ مارس ۲۰۲۶" });
});

test("a written date-time keeps its exact value beside the localised day", () => {
  const data = {
    trust: { [URL]: { level: "verified", generatedAt: "2026-03-06T10:30:00Z" } },
    build: { asOf: "2026-03-06" },
  };
  const view = trustPanelViewOf({}, pageOf(), siteOf(data));
  assert.equal(view.state, "valid");
  if (view.state !== "valid") return;
  assert.deepEqual(view.generated, {
    label: "Updated",
    iso: "2026-03-06T10:30:00Z",
    text: "6 March 2026",
    exact: "2026-03-06T10:30:00Z",
  });
});

test("future provenance and stale builds are left out of the view", () => {
  const stale = {
    trust: { [URL]: { level: "verified", buildId: "build-41", generatedAt: "2026-03-05", reviewedAt: "2026-03-07" } },
    build: { id: "build-42", asOf: "2026-03-06" },
  };
  const staleView = trustPanelViewOf({}, pageOf(), siteOf(stale));
  assert.equal(staleView.state, "valid");
  if (staleView.state !== "valid") return;
  assert.deepEqual(staleView.provenance, {});
  assert.equal(staleView.generated, undefined);
  assert.equal(staleView.reviewed, undefined);

  const afterGeneration = {
    trust: { [URL]: { level: "verified", generatedAt: "2026-03-04", reviewedAt: "2026-03-05" } },
    build: { asOf: "2026-03-06" },
  };
  const lateView = trustPanelViewOf({}, pageOf(), siteOf(afterGeneration));
  assert.equal(lateView.state, "valid");
  if (lateView.state !== "valid") return;
  assert.deepEqual(lateView.provenance, { generatedAt: "2026-03-04" });
  assert.equal(lateView.reviewed, undefined);
});

test("action links carry the base and drop unsafe or unfilled values", () => {
  const options = {
    trust: { contextPackUrl: "javascript:alert(1)", suggestEditUrl: "/edit/{source}" },
  };
  const view = trustPanelViewOf({}, pageOf(), siteOf({ trust: { [URL]: { level: "unknown" } } }, options, "/docs"));
  assert.equal(view.state, "valid");
  if (view.state !== "valid") return;
  assert.deepEqual(view.actions, [{ href: "/docs/edit/guide/install.md", label: "Suggest an edit" }]);

  const unfilled = { trust: { contextPackUrl: "https://example.com/context?reviewed={reviewed}" } };
  const none = trustPanelViewOf({}, pageOf(), siteOf({ trust: { [URL]: { level: "unknown" } } }, unfilled));
  assert.equal(none.state, "valid");
  if (none.state !== "valid") return;
  assert.deepEqual(none.actions, []);
});

test("a revision needs a commit and a supported repository", () => {
  const data = {
    trust: { [URL]: { level: "verified" } },
    reviewers: { [URL]: { date: "2026-03-04", commit: "abcdef1" } },
  };
  const gitlab = trustPanelViewOf({}, pageOf(), siteOf(data, {}, "", { url: "https://gitlab.com/example/docs" }));
  assert.equal(gitlab.state, "valid");
  if (gitlab.state !== "valid") return;
  assert.deepEqual(gitlab.revision, {
    label: "Reviewed revision",
    href: "https://gitlab.com/example/docs/-/commit/abcdef1",
    commit: "abcdef1",
  });

  const otherForge = trustPanelViewOf({}, pageOf(), siteOf(data, {}, "", { url: "https://code.example.com/docs" }));
  assert.equal(otherForge.state, "valid");
  if (otherForge.state !== "valid") return;
  assert.equal(otherForge.revision, undefined);
  assert.equal(otherForge.provenance.reviewedCommit, "abcdef1");

  const noRepository = trustPanelViewOf({}, pageOf(), siteOf(data));
  assert.equal(noRepository.state, "valid");
  if (noRepository.state !== "valid") return;
  assert.equal(noRepository.revision, undefined);
});

test("the view model is pure: repeated calls agree and the inputs are untouched", () => {
  const data = {
    trust: { [URL]: { level: "verified", reasons: ["All passed."], generatedAt: "2026-03-06" } },
    examples: { [URL]: { passed: 2, failed: 0, total: 2 } },
    drift: { [URL]: ["one"] },
  };
  const props: TrustPanelProps = {};
  const page = pageOf();
  const site = siteOf(data, { trust: { suggestEditUrl: "/edit/{source}" } });
  const before = JSON.stringify({ props, page, site });
  const first = trustPanelViewOf(props, page, site);
  const second = trustPanelViewOf(props, page, site);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify({ props, page, site }), before);
});
test("engine reason messages and legacy strings appear in order", () => {
  const data = { trust: { [URL]: { level: "partial", reasons: [
    { code: "unrun", message: "  Examples have not been run.  " },
    "Reviewed by hand.",
    { code: "missing-message" },
  ] } } };
  const view = trustPanelViewOf({}, pageOf(), siteOf(data));
  assert.equal(view.state, "valid");
  assert.deepEqual(view.reasons, ["Examples have not been run.", "Reviewed by hand."]);
});
