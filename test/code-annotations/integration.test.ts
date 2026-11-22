import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, before, test } from "node:test";
import { blockId } from "../../components/code/index.ts";
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

const stablePage = page.replace('title: Notes', 'title: Stable').replace("\n\n", `

## A renamed heading {#renamed}

<!-- {#answer-fence} -->
`);
const blockLock = JSON.stringify({
  version: 1,
  pages: { "stable.md": { renamed: 6 } },
  blocks: { renamed: { file: "stable.md", fingerprint: "old", anchor: "older-heading" } },
});

before(() => {
  site = build("integration", process.env, {
    "notes.md": page,
    "stable.md": stablePage,
    "blocks.lock.json": blockLock,
  });
});

after(() => rmSync(site.out, { recursive: true, force: true }));

test("a plain fence with meta renders its title, highlighted and numbered lines", () => {
  const doc = site.document("/notes/");
  assert.equal(textOf(doc.querySelector(".code-title")), "answer.ts");
  assert.equal(all(doc, "pre.code .highlighted").length, 1, "the {3} range highlights one line");
  assert.deepEqual(
    all(doc, "pre.code .line[data-line]").map((line) => line.getAttribute("data-line")),
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


test("the block's id, line anchors and annotations survive edits above a fence", () => {
  const moved = build("integration", process.env, {
    "stable.md": stablePage.replace("<!-- {#answer-fence} -->", "New introduction.\n\n<!-- {#answer-fence} -->"),
    "blocks.lock.json": blockLock,
  });
  const before = site.document("/stable/");
  const after = moved.document("/stable/");
  const first = before.querySelector("pre[data-block=answer-fence]");
  const second = after.querySelector("pre[data-block=answer-fence]");
  assert.ok(first && second);
  assert.notEqual(first.getAttribute("data-src"), second.getAttribute("data-src"));
  for (const pre of [first, second]) {
    assert.equal(pre.id, "code-answer-fence");
    const document = pre.ownerDocument;
    const legacyId = blockId(pre.getAttribute("data-src") ?? "");
    assert.ok(document.getElementById(legacyId), "the location-based block fragment remains an alias");
    assert.ok(document.getElementById(`${legacyId}-L2`), "the location-based line fragment remains an alias");
    assert.ok(document.getElementById(`${legacyId}-line-2`), "the location-based annotation fragment remains an alias");
    assert.equal(pre.querySelector(".line-link")?.getAttribute("href"), "#code-answer-fence-L1");
    assert.equal(document.querySelector(".code-annotations-link")?.getAttribute("href"), "#code-answer-fence-line-2");
  }
});

test("Markdown heading permalinks preserve the engine's previous anchor", () => {
  const document = site.document("/stable/");
  const heading = document.querySelector("h2#renamed");
  assert.equal(heading?.querySelector(".heading-anchor")?.getAttribute("href"), "#renamed");
  assert.equal(heading?.querySelector(".heading-anchor")?.getAttribute("aria-label"), "Link to this heading: A renamed heading");
  assert.ok(heading?.querySelector("#older-heading"), "the older fragment still targets the heading");
});
