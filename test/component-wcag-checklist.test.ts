import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import wcagChecklist from "../components/wcag-checklist/index.ts";
import { pageIn, render, rows, siteWith, text } from "./report-test-helpers.ts";

const EVIDENCE = "https://github.com/velella-sh/lateen/blob/main/site/accessibility.md#release-candidate-qa-record";
const CHECKS = {
  criteria: [
    {
      id: "1.1.1",
      principle: "perceivable",
      name: "Non-text Content",
      level: "A",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      how: "automated",
      notes: "axe checks that a text alternative exists.",
    },
    {
      id: "1.3.2",
      principle: "perceivable",
      name: "Meaningful Sequence",
      level: "A",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html",
      how: "manual",
      notes: "A person follows the reading order.",
    },
    {
      id: "2.1.2",
      principle: "operable",
      name: "No Keyboard Trap",
      level: "A",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html",
      how: "manual",
      notes: "The drawer traps focus only while open.",
      checked: { date: "2026-11-14", version: "0.2.2", evidence: EVIDENCE },
    },
    {
      id: "1.2.1",
      principle: "perceivable",
      name: "Audio-only and Video-only (Prerecorded)",
      level: "A",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html",
      how: "not-applicable",
      notes: "The theme ships no prerecorded media.",
    },
  ],
};

function renderChecklist(props: Record<string, string>, data: Readonly<Record<string, unknown>> = { wcag: CHECKS }, lang = "en") {
  return render(
    wcagChecklist({
      props,
      site: siteWith(data),
      page: pageIn(lang),
      html: "",
    } as unknown as ComponentProps<Record<string, string>>),
  );
}

test("a missing checklist is a visible note", () => {
  const doc = renderChecklist({}, {});
  assert.equal(doc.querySelector(".report-missing")?.getAttribute("role"), "note");
  assert.match(text(doc), /no wcag report/);
});

test("criteria are grouped by principle, in specification order", () => {
  const doc = renderChecklist({});
  const headings = [...doc.querySelectorAll("h3")].map((heading) => text(heading));
  assert.deepEqual(headings, ["Perceivable", "Operable"]);
  assert.equal(doc.querySelectorAll("table").length, 2);
  assert.deepEqual(
    rows(doc.querySelectorAll("table")[0] as unknown as Document).map((row) => row[0]),
    ["1.1.1 Non-text Content", "1.3.2 Meaningful Sequence", "1.2.1 Audio-only and Video-only (Prerecorded)"],
  );
});

test("the criterion number and name link to the W3C's page", () => {
  const doc = renderChecklist({});
  const link = doc.querySelector("table a");
  assert.equal(link?.getAttribute("href"), "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html");
  assert.equal(text(link), "1.1.1 Non-text Content");
});

test("every way of checking is named in words", () => {
  const doc = renderChecklist({});
  const values = rows(doc).map((row) => row[2]);
  assert.deepEqual(values, ["automated", "manual", "not applicable", "manual"]);
});

test("a manual check reads not recorded until its evidence exists", () => {
  const doc = renderChecklist({});
  const result = rows(doc).map((row) => row[4]);
  assert.deepEqual(result, ["", "not recorded yet", "", "2026-11-14 · 0.2.2 · evidence"]);
  assert.equal([...doc.querySelectorAll("td a")].at(-1)?.getAttribute("href"), EVIDENCE);
});

test("a criterion with an unsafe URL is left out instead of linked", () => {
  const unsafe = { criteria: [{ ...CHECKS.criteria[0], id: "9.9.9", url: "javascript:alert(1)" }, CHECKS.criteria[1]] };
  const doc = renderChecklist({}, { wcag: unsafe });
  assert.equal(doc.querySelector("td a")?.getAttribute("href"), "https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html");
  assert.doesNotMatch(text(doc), /9\.9\.9/);
});

test("the checklist heading and summary are in the page language", () => {
  const doc = renderChecklist({}, undefined, "ar");
  assert.match(text(doc), /قائمة WCAG 2\.2/);
  assert.match(text(doc), /معيارًا/);
});
