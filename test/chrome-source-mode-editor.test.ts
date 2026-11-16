import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { h } from "preact";
import { render } from "preact-render-to-string";
import type { ChromeProps } from "@velella/mizzen/contracts";
import { stamp, type SourceActions, type SourceBlock } from "../chrome/source-mode/client.ts";
import {
  acceptEditorTemplate,
  editorUrl,
  readFolder,
  saveFolder,
  SOURCE_FOLDER_KEY,
} from "../chrome/source-mode/editor.ts";
import sourceMode from "../chrome/source-mode/index.ts";

const TEMPLATE = "vscode://file/{path}:{line}:{column}";

function store(initial?: string) {
  const map = new Map<string, string>(initial === undefined ? [] : [[SOURCE_FOLDER_KEY, initial]]);
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

test("the template fills path, line and column from the stored folder", () => {
  assert.equal(
    editorUrl(TEMPLATE, "/Users/me/site/", "./docs/a b.md", 3, 5),
    "vscode://file//Users/me/site/docs/a%20b.md:3:5",
  );
  assert.equal(editorUrl("zed://file{path}:{line}", "C:\\work\\site", "a.md", 2, 1), "zed://fileC%3A/work/site/a.md:2");
});

test("the folder is stored once and read back; empty or refusing storage reads as unset", () => {
  const s = store();
  assert.equal(readFolder(s), undefined);
  assert.equal(saveFolder(s, "  /Users/me/site  "), true);
  assert.equal(s.map.get(SOURCE_FOLDER_KEY), "/Users/me/site");
  assert.equal(readFolder(s), "/Users/me/site");
  const throwing = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
  assert.equal(readFolder(throwing), undefined);
  assert.equal(saveFolder(throwing, "/x"), false);
});

test("without a folder there is no editor URL", () => {
  assert.equal(editorUrl(TEMPLATE, undefined, "a.md", 1, 1), undefined);
  assert.equal(editorUrl(TEMPLATE, "  ", "a.md", 1, 1), undefined);
});

test("a scheme outside the allowlist, or a template without {path}, is rejected", () => {
  for (const bad of ["javascript:alert(1)//{path}", "https://evil.example/{path}", "data:text/html,{path}", "file:///{path}", "{path}", "vscode://file/x"]) {
    assert.equal(acceptEditorTemplate(bad), undefined, bad);
    assert.equal(editorUrl(bad, "/x", "a.md", 1, 1), undefined, bad);
  }
  assert.equal(acceptEditorTemplate(`  ${TEMPLATE}`), TEMPLATE);
  assert.equal(acceptEditorTemplate(42), undefined);
});

test("the chrome carries the editor template and the folder button only for an accepted template", () => {
  const page = { lang: "en", dir: "ltr" };
  const out = (editor: unknown) =>
    render(h("div", null, sourceMode({ site: { config: { theme: { options: { sourceMode: { editor } } } } }, page } as unknown as ChromeProps) as never));
  const ok = out(TEMPLATE);
  assert.match(ok, /data-editor="vscode:\/\/file\/\{path\}/);
  assert.match(ok, /source-folder-button/);
  const rejected = out("javascript:{path}");
  assert.doesNotMatch(rejected, /data-editor|source-folder-button/);
});

test("the editor link stays hidden until the folder is set, then points at the file", () => {
  const dom = new JSDOM(`<body><p data-src="docs/a.md:3:2-3:20">Hello</p></body>`);
  const document = dom.window.document;
  const s = store();
  const actions: SourceActions = {
    editor: TEMPLATE,
    storage: s,
    messages: (name) => name,
    createElement: (tag) => document.createElement(tag) as never,
    copy: async () => true,
    announce: () => {},
  };
  const entries = stamp({
    blocks: [...document.querySelectorAll("[data-src]")] as unknown as SourceBlock[],
    createLabel: () => document.createElement("span") as never,
    actions,
  });
  const link = document.querySelector("a.source-label-editor") as HTMLAnchorElement;
  assert.equal(link.hidden, true, "no folder yet");
  assert.equal(link.getAttribute("href"), null);
  saveFolder(s, "/Users/me/site");
  entries[0]?.refresh();
  assert.equal(link.hidden, false);
  assert.equal(link.getAttribute("href"), "vscode://file//Users/me/site/docs/a.md:3:2");
});
