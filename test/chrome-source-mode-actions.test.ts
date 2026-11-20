import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { h } from "preact";
import { render } from "preact-render-to-string";
import type { ChromeProps } from "@velella/mizzen/contracts";
import { stamp, type SourceActions, type SourceBlock } from "../chrome/source-mode/client.ts";
import sourceMode from "../chrome/source-mode/index.ts";
import { lineUrlOf } from "../src/repository.ts";

const MESSAGES: Record<string, string> = {
  "copy-label": "Copy {location}",
  copied: "Copied {location}.",
  "copy-failed": "Could not copy {location}.",
  "repo-label": "View {location} in the repository (opens in a new window)",
  "repo-link": "Repository",
};

function run(repository: SourceActions["repository"], copy = async (_text: string) => true) {
  const dom = new JSDOM(`<body><p data-src="docs/a.md:3:1-3:20">Hello</p></body>`);
  const document = dom.window.document;
  const announced: string[] = [];
  const copied: string[] = [];
  const entries = stamp({
    blocks: [...document.querySelectorAll("[data-src]")] as unknown as SourceBlock[],
    createLabel: () => document.createElement("span") as never,
    actions: {
      repository,
      storage: undefined,
      messages: (name) => MESSAGES[name] ?? "",
      createElement: (tag) => document.createElement(tag) as never,
      copy: async (text) => {
        copied.push(text);
        return copy(text);
      },
      announce: (message) => announced.push(message),
    },
  });
  return { document, entries, announced, copied };
}

test("the label is a button that copies file:line and announces it", async () => {
  const { document, announced, copied } = run(undefined);
  const button = document.querySelector("button.source-label-copy") as HTMLButtonElement;
  assert.equal(button.textContent, "docs/a.md:3");
  assert.equal(button.querySelector("bdi")?.getAttribute("dir"), "ltr", "the path is isolated inside the button");
  assert.equal(button.getAttribute("aria-label"), "Copy docs/a.md:3");
  button.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(copied, ["docs/a.md:3"]);
  assert.deepEqual(announced, ["Copied docs/a.md:3."]);
});

test("a refused clipboard is announced, not silent", async () => {
  const { document, announced } = run(undefined, async () => false);
  (document.querySelector("button.source-label-copy") as HTMLButtonElement).click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(announced, ["Could not copy docs/a.md:3."]);
});

test("a GitHub repository links the same line, and the name says it opens a new window", () => {
  const { document } = run({ url: "https://github.com/acme/site/", branch: "dev" });
  const link = document.querySelector("a.source-label-link") as HTMLAnchorElement;
  assert.equal(link.getAttribute("href"), "https://github.com/acme/site/blob/dev/docs/a.md#L3");
  assert.equal(link.getAttribute("target"), "_blank");
  assert.match(link.getAttribute("rel") ?? "", /noopener/);
  assert.match(link.getAttribute("aria-label") ?? "", /opens in a new window/);
});

test("a GitLab repository uses the /-/blob shape, with the default branch", () => {
  assert.equal(
    lineUrlOf({ url: "https://gitlab.com/acme/site" }, "./docs/a b.md", 7),
    "https://gitlab.com/acme/site/-/blob/main/docs/a%20b.md#L7",
  );
});

test("a site without a repository, or on another forge, gets no repository link", () => {
  assert.equal(run(undefined).document.querySelector("a.source-label-link"), null);
  assert.equal(lineUrlOf({ url: "https://git.example.org/acme/site" }, "a.md", 1), undefined);
  assert.equal(lineUrlOf({ url: "https://github.com/acme/site" }, "a.md", 0), undefined);
});

test("the switch carries the repository only when its host has a line URL shape", () => {
  const page = { lang: "en", dir: "ltr" };
  const out = (repository?: { url: string }) =>
    render(h("div", null, sourceMode({ site: { config: { repository, theme: {} } }, page } as unknown as ChromeProps) as never));
  assert.match(out({ url: "https://github.com/acme/site" }), /data-repository=/);
  assert.doesNotMatch(out(), /data-repository/);
  assert.doesNotMatch(out({ url: "https://git.example.org/acme/site" }), /data-repository/);
});
