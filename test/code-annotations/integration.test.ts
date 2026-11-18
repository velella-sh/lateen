import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, before, test } from "node:test";
import { all, build, textOf, type BuiltSite } from "../integration-helpers.ts";

let site: BuiltSite;

const page = `---
title: Notes
layout: doc
---

\`\`\`ts title="answer.ts" {3} showLineNumbers annotations={2: The first note | 3-4: A range with a pipe}
const a = 1;
const b = 2;
const c = 3;
const d = 4;
\`\`\`
`;

before(() => {
  site = build("integration", process.env, { "notes.md": page });
});

after(() => rmSync(site.out, { recursive: true, force: true }));

test("a plain fence with meta renders its title, highlighted and numbered lines", () => {
  const doc = site.document("/notes/");
  assert.equal(textOf(doc.querySelector(".code-title")), "answer.ts");
  assert.equal(all(doc, "pre.code .highlighted").length, 1, "the {3} range highlights one line");
  assert.deepEqual(
    all(doc, "pre.code [data-line]").map((line) => line.getAttribute("data-line")),
    ["1", "2", "3", "4"],
  );
});

test("annotations sit outside the pre and link to line ids in the code", () => {
  const doc = site.document("/notes/");
  const pre = doc.querySelector("pre.code");
  assert.ok(pre);
  assert.equal(pre.querySelector("details"), null, "the notes never enter the code block");

  const notes = doc.querySelector("details.code-annotations");
  assert.ok(notes);
  assert.equal(textOf(notes.querySelector("summary")), "Annotations (2)");
  const links = all(notes, "a.code-annotations-link");
  assert.deepEqual(links.map((link) => textOf(link)), ["Line 2", "Lines 3–4"]);

  for (const link of links) {
    const id = link.getAttribute("href")?.slice(1) ?? "";
    assert.ok(id !== "" && doc.getElementById(id), `the link target #${id} exists`);
  }
  assert.deepEqual(
    all(notes, ".code-annotations-text").map((item) => textOf(item)),
    ["The first note", "A range with a pipe"],
  );
});

test("the Markdown twin keeps the fence meta verbatim", () => {
  const twin = site.file("notes/index.md");
  assert.match(twin, /annotations=\{2: The first note \| 3-4: A range with a pipe\}/);
  assert.match(twin, /title="answer.ts"/);
});
