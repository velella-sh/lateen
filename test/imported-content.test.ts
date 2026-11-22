import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "./integration-helpers.ts";

const material = [
  ["note", "note"], ["info", "note"], ["abstract", "important"], ["success", "tip"],
  ["question", "important"], ["failure", "caution"], ["bug", "caution"], ["example", "note"], ["quote", "note"],
] as const;

const fixture = build("page-tools", process.env, {
  "mkdocs.md": [
    "---\ntitle: MkDocs\n---",
    ...material.map(([type], index) =>
      `:::${type}{title="Imported ${type}" collapsible${index % 2 === 1 ? " open" : ""}}\nText for ${type}.\n:::`),
    ":::quote\nAn untitled Material quote.\n:::",
    ':::callout{type=unknown}\nFallback.\n:::',
  ].join("\n\n"),
  "docusaurus.md": [
    "---\ntitle: Docusaurus\n---",
    ":::::tabs",
    ':::tab{label="Bash"}\nRun Bash.\n:::',
    ':::tab{label="PowerShell"}\nRun PowerShell.\n:::',
    ":::::",
    ":::tip[Write it once]\nSave the token.\n:::",
  ].join("\n\n"),
  "starlight.md": [
    "---\ntitle: Starlight\n---",
    "1. Build the site.\n2. Publish the site.",
    "```text\nsite/\n  guides/\n```",
    "[Deployment guide](/vitepress/) — Deploy the site.",
  ].join("\n\n"),
  "vitepress.md": [
    "---\ntitle: VitePress\n---",
    ":::tip[Run the doctor first]\nCheck the configuration.\n:::",
    ':::details{title="Deployment notes"}\nCheck the deployment.\n:::',
    '::badge{text="Beta"}',
  ].join("\n\n"),
});

test("Material callouts preserve titles, bodies, icons, and their initial disclosure state", () => {
  const html = fixture.document("/mkdocs/");
  const callouts = [...html.querySelectorAll<HTMLDetailsElement>("details.callout")];
  assert.equal(callouts.length, material.length);
  for (const [index, [type, variant]] of material.entries()) {
    const callout = callouts[index]!;
    assert.ok(callout.classList.contains(`callout-${variant}`), type);
    assert.equal(callout.open, index % 2 === 1, type);
    assert.equal(callout.querySelector("summary")?.textContent, `Imported ${type}`);
    assert.ok(callout.querySelector("summary .callout-icon"));
    assert.equal(callout.querySelector(".callout-body")?.textContent?.trim(), `Text for ${type}.`);
  }
  assert.equal(html.querySelector("div.callout-note .callout-body blockquote")?.textContent?.trim(), "An untitled Material quote.");
  assert.equal([...html.querySelectorAll("div.callout-note .callout-body")].at(-1)?.textContent?.trim(), "Fallback.");
});

test("Docusaurus, Starlight and VitePress output stays readable", () => {
  const docusaurus = fixture.document("/docusaurus/");
  assert.deepEqual([...docusaurus.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent), ["Bash", "PowerShell"]);
  assert.equal(docusaurus.querySelector(".callout-tip .callout-title")?.textContent, "Write it once");
  const starlight = fixture.document("/starlight/");
  assert.equal(starlight.querySelectorAll(".doc-body ol li").length, 2);
  assert.match(starlight.querySelector(".doc-body pre")?.textContent ?? "", /site\/\s+guides\//);
  assert.match(starlight.querySelector('.doc-body a[href="/vitepress/"]')?.textContent ?? "", /Deployment guide/);
  const vitepress = fixture.document("/vitepress/");
  assert.equal(vitepress.querySelector(".callout-tip .callout-title")?.textContent, "Run the doctor first");
  assert.equal(vitepress.querySelector("details.details > summary")?.textContent, "Deployment notes");
  assert.match(vitepress.querySelector(".badge")?.textContent ?? "", /Beta/);
});
