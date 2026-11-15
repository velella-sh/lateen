import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import a11yReport from "../components/a11y-report/index.ts";
import { pageIn, render, siteWith, text } from "./report-test-helpers.ts";

const REPORT = {
  tool: "lateen/a11y-report",
  version: 1,
  commit: "de29199",
  tools: { node: "v24.0.0", playwright: "1.65.0", axe: "4.14.0", chromium: "140.0.0" },
  rules: ["wcag2a", "wcag2aa"],
  matrix: [
    { case: "docs home", layout: "home", lang: "en", theme: "light" },
    { case: "docs home", layout: "home", lang: "en", theme: "dark" },
  ],
  findings: [
    {
      case: "docs home",
      theme: "light",
      rule: "color-contrast",
      impact: "moderate",
      target: ".eyebrow",
      help: "Contrast",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.14/color-contrast",
    },
  ],
  known: [{ case: "*", theme: "dark", rule: "region", target: "main" }],
  journeys: [{ name: "search the site", theme: "light", result: "pass" }],
  summary: { states: 2, findings: { minor: 0, moderate: 1, serious: 0, critical: 0 }, journeys: { pass: 1, fail: 0, skip: 0 } },
};

function renderReport(props: Record<string, string>, data: Readonly<Record<string, unknown>> = { "accessibility-report": REPORT }, lang = "en") {
  return render(
    a11yReport({
      props,
      site: siteWith(data),
      page: pageIn(lang),
      html: "",
    } as unknown as ComponentProps<Record<string, string>>),
  );
}

test("a missing report is a visible note, not an empty table", () => {
  const doc = renderReport({}, {});
  const note = doc.querySelector(".report-missing");
  assert.equal(note?.getAttribute("role"), "note");
  assert.match(text(doc), /no accessibility-report report/);
});

test("a report whose header this unit did not write is treated as missing", () => {
  const doc = renderReport({ from: "other" }, { other: { tool: "something-else", version: 1, commit: "de29199" } });
  assert.ok(doc.querySelector(".report-missing"));
  assert.equal(doc.querySelector("table"), null);
});

test("the summary names the commit, its link, the tools, and the page states", () => {
  const doc = renderReport({});
  assert.match(text(doc), /audited 2 page states/);
  assert.equal(doc.querySelector(".a11y-report-commit a")?.getAttribute("href"), "https://github.com/velella-sh/lateen/commit/de29199");
  assert.match(text(doc), /node v24\.0\.0 · playwright 1\.65\.0 · axe 4\.14\.0/);
  assert.match(text(doc), /wcag2a, wcag2aa/);
});

test("every impact is counted, including the moderate finding the gate does not fail on", () => {
  const doc = renderReport({});
  const tables = [...doc.querySelectorAll("table")];
  const impactRows = [...(tables[1]?.querySelectorAll("tbody tr") ?? [])].map((row) => [...row.querySelectorAll("td")].map((cell) => text(cell)));
  assert.deepEqual(impactRows, [
    ["critical", "0"],
    ["serious", "0"],
    ["moderate", "1"],
    ["minor", "0"],
  ]);
  assert.match(text(doc), /color-contrast/);
  assert.match(text(doc), /\.eyebrow/);
});

test("a known finding is open by name, and * means every page", () => {
  const doc = renderReport({});
  assert.match(text(doc), /Known findings that are still open/);
  assert.match(text(doc), /Every page/);
  assert.match(text(doc), /region/);
});

test("a clean report says so in words instead of leaving a blank table", () => {
  const clean = {
    ...REPORT,
    findings: [],
    known: [],
    summary: { ...REPORT.summary, findings: { minor: 0, moderate: 0, serious: 0, critical: 0 } },
  };
  const doc = renderReport({}, { "accessibility-report": clean });
  assert.match(text(doc), /No finding was reported/);
  assert.match(text(doc), /No known finding is open/);
});

test("the rules, targets, and commit stay left to right inside a right-to-left page", () => {
  const doc = renderReport({}, undefined, "fa");
  assert.equal(doc.querySelector(".a11y-report-commit a")?.getAttribute("dir"), "ltr");
  assert.ok([...doc.querySelectorAll("code")].some((code) => code.getAttribute("dir") === "ltr" && text(code) === "color-contrast"));
  assert.match(text(doc), /گزارش دسترس‌پذیری/);
});

test("an unsafe help URL is shown as plain text, never as a link", () => {
  const unsafe = {
    ...REPORT,
    findings: [{ ...REPORT.findings[0], helpUrl: "javascript:alert(1)" }],
  };
  const doc = renderReport({}, { "accessibility-report": unsafe });
  const rule = [...doc.querySelectorAll("code")].find((code) => text(code) === "color-contrast");
  assert.ok(rule);
  assert.equal(rule?.querySelector("a"), null);
});
