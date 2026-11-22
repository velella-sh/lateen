// The command palette's payload guards, tested against `chrome/search/palette.ts` directly: malformed
// JSON, wrong field types, unknown actions, and unsafe URLs each keep their fallback behavior.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIONS_LABEL, optionList } from "../../../chrome/search/options.ts";
import { filterActions, isPaletteRun, matchesAction, parsePalette } from "../../../chrome/search/palette.ts";

const ids = (text: string): readonly string[] => parsePalette(text).actions.map((action) => action.id);

test("malformed JSON falls back to an empty palette under the fallback label", () => {
  for (const text of ["not json", "{", '{"label":', "[object Object]"]) {
    assert.deepEqual(parsePalette(text), { label: ACTIONS_LABEL, actions: [] });
  }
  assert.equal(parsePalette("not json", "Actions fr").label, "Actions fr");
});

test("missing or blank payload text falls back to an empty palette", () => {
  for (const text of [null, "", "   "]) {
    assert.deepEqual(parsePalette(text), { label: ACTIONS_LABEL, actions: [] });
  }
});

test("JSON that is not an object falls back to an empty palette", () => {
  for (const value of [null, 42, '"text"', true]) {
    assert.deepEqual(parsePalette(JSON.stringify(value)), { label: ACTIONS_LABEL, actions: [] });
  }
});

test("a label of the wrong type or empty falls back; a real one is kept", () => {
  for (const label of [42, null, "", { nested: true }]) {
    assert.equal(parsePalette(JSON.stringify({ label, actions: [] })).label, ACTIONS_LABEL);
  }
  assert.equal(parsePalette(JSON.stringify({ label: "Actions fr", actions: [] })).label, "Actions fr");
});

test("actions of the wrong type fall back to an empty list", () => {
  for (const actions of [null, 42, "copy", {}]) {
    assert.deepEqual(parsePalette(JSON.stringify({ actions })).actions, []);
  }
});

test("entries that are not actions are dropped, one by one", () => {
  const text = JSON.stringify({ actions: [null, 42, "copy", [], { id: "ok", label: "Ok" }] });
  assert.deepEqual(ids(text), ["ok"]);
});

test("an action needs a non-empty string id and label", () => {
  for (const id of [undefined, null, 42, ""]) {
    assert.deepEqual(ids(JSON.stringify({ actions: [{ id, label: "Ok" }] })), []);
  }
  for (const label of [undefined, null, 42, ""]) {
    assert.deepEqual(ids(JSON.stringify({ actions: [{ id: "ok", label }] })), []);
  }
});

test("a hint must be a string when present; an action without a run is kept", () => {
  assert.deepEqual(ids(JSON.stringify({ actions: [{ id: "ok", label: "Ok", hint: 42 }] })), []);
  assert.deepEqual(ids(JSON.stringify({ actions: [{ id: "ok", label: "Ok", hint: "Switch" }] })), ["ok"]);
  assert.deepEqual(ids(JSON.stringify({ actions: [{ id: "ok", label: "Ok" }] })), ["ok"]);
});

test("an unknown action kind is dropped, and so is a run that is not an object", () => {
  for (const run of [{ kind: "run-script", url: "javascript:alert(1)" }, { kind: "eval" }, null, 42, "source"]) {
    assert.deepEqual(ids(JSON.stringify({ actions: [{ id: "bad", label: "Bad", run }] })), []);
  }
});

test("each known kind keeps its own field guard", () => {
  assert.equal(isPaletteRun({ kind: "theme", choice: "light" }), true);
  assert.equal(isPaletteRun({ kind: "theme", choice: "sepia" }), false);
  assert.equal(isPaletteRun({ kind: "theme" }), false);
  assert.equal(isPaletteRun({ kind: "copy", url: "/guide/install.md" }), true);
  assert.equal(isPaletteRun({ kind: "copy", url: "" }), false);
  assert.equal(isPaletteRun({ kind: "copy", url: 42 }), false);
  assert.equal(isPaletteRun({ kind: "copy" }), false);
  assert.equal(isPaletteRun({ kind: "section", id: "install" }), true);
  assert.equal(isPaletteRun({ kind: "section", id: "" }), false);
  assert.equal(isPaletteRun({ kind: "section" }), false);
  assert.equal(isPaletteRun({ kind: "source" }), true);
  assert.equal(isPaletteRun(null), false);
});

test("a payload mixing valid and invalid actions keeps only the valid ones, in order", () => {
  const text = JSON.stringify({
    label: "Actions",
    actions: [
      { id: "theme-dark", label: "Dark", run: { kind: "theme", choice: "dark" } },
      { id: "bad-run", label: "Bad", run: { kind: "run-script", url: "javascript:alert(1)" } },
      { id: "copy", label: "Copy", run: { kind: "copy", url: "/guide/install.md" } },
      { id: "", label: "No id" },
      { id: "section", label: "Jump", run: { kind: "section", id: "install" } },
    ],
  });
  assert.deepEqual(ids(text), ["theme-dark", "copy", "section"]);
});

test("unsafe index URLs keep their fallback: the row renders without a link", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
    const row = optionList([{ url, excerpt: "" }], []).rows[0];
    assert.equal(row?.href, undefined);
    assert.equal(row?.record?.url, url);
  }
});

test("filtering keeps the original order and matches labels and whole hint words", () => {
  const actions = [
    { id: "theme-dark", label: "Dark", hint: "Switch the theme" },
    { id: "copy", label: "Copy page", hint: "Markdown" },
  ];
  assert.deepEqual(filterActions(actions, "").map((action) => action.id), ["theme-dark", "copy"]);
  assert.deepEqual(filterActions(actions, "dark").map((action) => action.id), ["theme-dark"]);
  assert.deepEqual(filterActions(actions, "theme").map((action) => action.id), ["theme-dark"]);
  // A single letter inside a hint word is not a whole-word match.
  assert.deepEqual(filterActions(actions, "ark").map((action) => action.id), ["theme-dark"]);
  assert.deepEqual(filterActions(actions, "arkdown").map((action) => action.id), []);
});