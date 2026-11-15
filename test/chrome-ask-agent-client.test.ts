import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import type { ChromeProps, Page, Pager, Site, SiteConfig, SourcePos, Trail } from "@velella/mizzen/contracts";
import { askConfig } from "../chrome/ask-agent/index.ts";
import {
  activateAskAgent,
  type AskDocument,
  type AskElement,
  type AskResult,
} from "../chrome/ask-agent/client.ts";

const pos: SourcePos = { file: "index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };
const trail: Trail = [];
const pager: Pager = {};

function siteConfig(options: Readonly<Record<string, unknown>> = {}): SiteConfig {
  return {
    title: "Example",
    base: "/example",
    url: "https://example.com",
    lang: "en",
    dir: "ltr",
    languages: [],
    source: ".",
    include: [],
    exclude: [],
    navigation: "_data/navigation.yml",
    defaults: [],
    theme: { options },
    search: { text: 300 },
    redirects: {},
    outputs: {},
  };
}

function pageWith(lang = "en"): Page {
  return {
    url: "/example/guide/install/",
    source: pos,
    frontMatter: {},
    title: "Install",
    lang,
    dir: lang === "en" ? "ltr" : "rtl",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
  };
}

function props(options: Readonly<Record<string, unknown>> = {}, lang = "en"): ChromeProps {
  const page = pageWith(lang);
  const site: Site = { config: siteConfig(options), pages: [page], nav: {}, data: {} };
  return { site, page, trail, pager };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const results: readonly AskResult[] = [
  { url: "/example/guide/install/", title: "Install" },
  { url: "/example/guide/theme/", title: "Theme" },
];

function setup(options: Readonly<Record<string, unknown>> = {}, env: { clipboard?: { writeText(text: string): Promise<void> }; fetchText?: (url: string) => Promise<string> } = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html lang="en" dir="ltr"><body><div data-ask-agent hidden></div></body></html>');
  const document = dom.window.document;
  const root = document.querySelector("[data-ask-agent]");
  assert.ok(root);
  const writes: string[] = [];
  const clipboard = env.clipboard ?? {
    writeText(text: string) {
      writes.push(text);
      return Promise.resolve();
    },
  };
  const agent = activateAskAgent({
    document: document as unknown as AskDocument,
    root: root as unknown as AskElement,
    config: askConfig(props(options)),
    clipboard,
    fetchText: env.fetchText ?? (() => Promise.resolve("")),
    lang: "en",
  });
  assert.ok(agent);
  return { dom, document, root, agent, open: agent.open, writes };
}

function panelOf(root: Element): HTMLElement {
  const panel = root.querySelector(".ask-agent-panel");
  assert.ok(panel, "the panel is built");
  return panel as HTMLElement;
}

test("opening the panel reveals it, builds the prompt, states its size, and focuses the text", () => {
  const { root, open } = setup();
  assert.equal((root as HTMLElement).hidden, true);

  open("how do I install the theme", results);

  const panel = panelOf(root);
  assert.equal((root as HTMLElement).hidden, false);
  const textarea = panel.querySelector("textarea");
  assert.ok(textarea);
  assert.match(textarea.value, /Question: how do I install the theme/);
  assert.match(textarea.value, /- Install — https:\/\/example\.com\/example\/guide\/install\//);
  assert.match(textarea.value, /Markdown: https:\/\/example\.com\/example\/guide\/install\/index\.md/);
  assert.match(textarea.value, /Site index: https:\/\/example\.com\/example\/llms\.txt/);
  assert.match(panel.querySelector(".ask-agent-size")?.textContent ?? "", /\d+ characters/);
  assert.equal(panel.ownerDocument.activeElement, textarea);
});

test("copy writes the shown prompt and announces success or failure", async () => {
  const { root, open, writes } = setup();
  open("two words", results);
  const panel = panelOf(root);
  const copy = panel.querySelector(".ask-agent-copy") as HTMLButtonElement;
  copy.click();
  await tick();
  assert.equal(writes.length, 1);
  assert.equal(writes[0], (panel.querySelector("textarea") as HTMLTextAreaElement).value);
  assert.equal(panel.querySelector(".ask-agent-status")?.textContent, "Copied");

  const failing = setup({}, { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
  failing.open("two words", results);
  const failedPanel = panelOf(failing.root);
  (failedPanel.querySelector(".ask-agent-copy") as HTMLButtonElement).click();
  await tick();
  assert.equal(failedPanel.querySelector(".ask-agent-status")?.textContent, "Copy failed.");
});

test("page text is fetched only after the reader turns the option on", async () => {
  const calls: string[] = [];
  const { root, open } = setup({}, {
    fetchText: (url) => {
      calls.push(url);
      return Promise.resolve(`text of ${url}`);
    },
  });
  open("two words", results);
  const panel = panelOf(root);
  const checkbox = panel.querySelector('input[type="checkbox"]') as HTMLInputElement;
  assert.ok(checkbox);
  assert.deepEqual(calls, []);
  assert.doesNotMatch((panel.querySelector("textarea") as HTMLTextAreaElement).value, /text of/);

  checkbox.checked = true;
  checkbox.dispatchEvent(new (checkbox.ownerDocument.defaultView as typeof globalThis).Event("change"));
  await tick();
  await tick();

  assert.deepEqual(calls, ["https://example.com/example/guide/install/index.md", "https://example.com/example/guide/theme/index.md"]);
  assert.match((panel.querySelector("textarea") as HTMLTextAreaElement).value, /### Install\ntext of/);

  checkbox.checked = false;
  checkbox.dispatchEvent(new (checkbox.ownerDocument.defaultView as typeof globalThis).Event("change"));
  assert.doesNotMatch((panel.querySelector("textarea") as HTMLTextAreaElement).value, /text of/);
});

test("a failed text request is announced and the prompt keeps the page without text", async () => {
  const { root, open } = setup({}, { fetchText: () => Promise.reject(new Error("missing")) });
  open("two words", results);
  const panel = panelOf(root);
  const checkbox = panel.querySelector('input[type="checkbox"]') as HTMLInputElement;
  checkbox.checked = true;
  checkbox.dispatchEvent(new (checkbox.ownerDocument.defaultView as typeof globalThis).Event("change"));
  await tick();
  await tick();

  assert.equal(panel.querySelector(".ask-agent-status")?.textContent, "The page text could not be loaded.");
  assert.match((panel.querySelector("textarea") as HTMLTextAreaElement).value, /Related pages:/);
});

test("an agent link carries the encoded prompt", () => {
  const { root, open } = setup({ pageAgent: { providers: [{ title: "Claude", url: "https://claude.ai/new?q={prompt}" }] } });
  open('why does "this" break', results);
  const panel = panelOf(root);
  const link = panel.querySelector(".ask-agent-provider") as HTMLAnchorElement;
  const href = link.getAttribute("href") ?? "";
  assert.match(href, /^https:\/\/claude\.ai\/new\?q=/);
  assert.match(href, /why%20does%20%22this%22%20break/);
  assert.equal(link.getAttribute("target"), "_blank");
});

test("a link longer than the limit copies the prompt and says why", async () => {
  const long = `https://claude.ai/new?q=${"a".repeat(8000)}`;
  const { root, open, writes } = setup({ pageAgent: { providers: [{ title: "Claude", url: `${long}{prompt}` }] } });
  open("two words", results);
  const panel = panelOf(root);
  const link = panel.querySelector(".ask-agent-provider") as HTMLAnchorElement;
  const event = new (link.ownerDocument.defaultView as typeof globalThis).MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true);
  await tick();
  assert.equal(writes.length, 1);
  assert.equal(panel.querySelector(".ask-agent-status")?.textContent, "This link would be too long, so the prompt was copied instead.");
});

test("a page with no ask config gets no opener", () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div data-ask-agent hidden></div></body></html>');
  const root = dom.window.document.querySelector("[data-ask-agent]");
  assert.ok(root);
  assert.equal(
    activateAskAgent({
      document: dom.window.document as unknown as AskDocument,
      root: root as unknown as AskElement,
      config: undefined,
    }),
    undefined,
  );
});

test("closing the dialog hides the ask slot, and the next open shows it again", () => {
  const { root, agent, open } = setup();
  open("two words", results);
  assert.equal((root as HTMLElement).hidden, false);
  agent.hide();
  assert.equal((root as HTMLElement).hidden, true);
  open("two words", results);
  assert.equal((root as HTMLElement).hidden, false);
});

test("the search results section fills without taking focus from the page", () => {
  const { root, agent } = setup();
  agent.open("two words", results, root, false);
  const panel = panelOf(root);
  assert.notEqual(panel.ownerDocument.activeElement, panel.querySelector("textarea"));
  assert.match((panel.querySelector("textarea") as HTMLTextAreaElement).value, /Question: two words/);
});
