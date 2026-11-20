import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { build } from "./integration-helpers.ts";

const page = `---
title: Multi
---

First[^a] and second[^a] and third[^b].

[^a]: Alpha note.
[^b]: Beta note.
`;

test("each reference to a footnote gets a distinct id and its own return link", () => {
  const site = build("integration", process.env, { "multi.md": page });
  try {
    const document = new JSDOM(site.html("/multi/")).window.document;

    const references = [...document.querySelectorAll('[data-footnote-ref][href="#user-content-fn-a"]')];
    assert.deepEqual(
      references.map((reference) => reference.id),
      ["user-content-fnref-a", "user-content-fnref-a-2"],
      "two references to one note keep distinct ids",
    );
    assert.ok(references.every((reference) => reference.getAttribute("href") === "#user-content-fn-a"));

    const note = document.getElementById("user-content-fn-a");
    assert.ok(note, "the shared note exists");
    const backrefs = [...note.querySelectorAll("[data-footnote-backref]")];
    assert.equal(backrefs.length, 2, "one return link per reference");
    assert.deepEqual(
      backrefs.map((backref) => backref.getAttribute("href")),
      references.map((reference) => `#${reference.id}`),
      "each return link names the exact reference it came from",
    );

    const labels = backrefs.map((backref) => backref.getAttribute("aria-label") ?? "");
    assert.ok(labels.every((label) => label.trim() !== ""), "every return link has a name");
    assert.equal(new Set(labels).size, labels.length, "the two names differ");
    assert.match(labels[1] ?? "", /reference 1-2/, "the second name includes the reference number and occurrence");

    const secondNote = document.getElementById("user-content-fn-b");
    assert.ok(secondNote);
    const secondBackrefs = [...secondNote.querySelectorAll("[data-footnote-backref]")];
    assert.equal(secondBackrefs.length, 1);
    const secondLabel = secondBackrefs[0]?.getAttribute("aria-label") ?? "";
    assert.notEqual(secondLabel, "");
    assert.ok(!labels.includes(secondLabel), "the second note has its own distinct name");
  } finally {
    rmSync(site.out, { recursive: true, force: true });
  }
});
