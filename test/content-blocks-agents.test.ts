// What an agent reads (#1221): the Markdown twin of a page and its text content. A callout keeps its kind
// and title, code keeps its language and every line, a figure keeps its alt text and caption, and a state
// keeps its message. Nothing is only in a color, an icon, or a script.
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { build, type BuiltSite } from "./integration-helpers.ts";

const IMAGE = "/img/pipeline.png";
const PAGE = `---
title: Agent view
layout: doc
permalink: /agents/
---

## Blocks

:::callout{type=warning title="Back up first"}
Copy the data directory before you upgrade.
:::

\`\`\`ts title="answer.ts"
export const answer = 42;
\`\`\`

::figure{src="${IMAGE}" alt="Three boxes in a row." caption="The build pipeline" zoom="true"}

::state{kind=error title="It failed" description="Try again in a moment."}
`;

let site: BuiltSite;
let twin: string;

before(() => {
  site = build("integration", process.env, { "agents.md": PAGE });
  twin = readFileSync(join(site.out, "agents/index.md"), "utf8");
});
after(() => rmSync(site.out, { recursive: true, force: true }));

test("the Markdown twin keeps the callout kind, title and text", () => {
  assert.match(twin, /callout/);
  assert.match(twin, /type=warning/);
  assert.match(twin, /Back up first/);
  assert.match(twin, /Copy the data directory before you upgrade\./);
});

test("the Markdown twin keeps the code language, title and every line", () => {
  assert.match(twin, /```ts[^\n]*title="answer\.ts"/);
  assert.match(twin, /export const answer = 42;/);
});

test("the Markdown twin keeps the figure's alt text, caption and image address", () => {
  assert.match(twin, /alt="Three boxes in a row\."/);
  assert.match(twin, /caption="The build pipeline"/);
  assert.match(twin, new RegExp(IMAGE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")));
});

test("the Markdown twin keeps the state's message", () => {
  assert.match(twin, /::state\{[^}]*kind=error/);
  assert.match(twin, /Try again in a moment\./);
});

test("the page's text carries every message with no script", () => {
  const html = readFileSync(join(site.out, "agents/index.html"), "utf8");
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "");
  for (const phrase of ["Back up first", "Copy the data directory before you upgrade.", "answer = 42", "The build pipeline", "Try again in a moment."]) {
    assert.ok(text.includes(phrase), `${phrase} is in the page text`);
  }
  assert.match(html, /alt="Three boxes in a row\."/);
});
