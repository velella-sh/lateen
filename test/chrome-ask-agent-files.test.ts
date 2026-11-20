// The ask panel names the files the site actually publishes: llms.txt when the site writes it, and a
// record page's index.json only when page JSON is published. Nothing is guessed for other pages.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import type { ChromeProps, Pager, Site, SiteConfig, SourcePos, Trail } from "@velella/mizzen/contracts";
import { askConfig } from "../chrome/ask-agent/index.ts";
import { activateAskAgent, type AskDocument, type AskElement, type AskResult } from "../chrome/ask-agent/client.ts";
import { pageWith } from "./helpers/page.ts";

const pos: SourcePos = { file: "index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };
const trail: Trail = [];
const pager: Pager = {};

function siteConfig(outputs: Readonly<Record<string, boolean>> = {}): SiteConfig {
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
    theme: { options: {} },
    search: { text: 300 },
    redirects: {},
    outputs,
    collections: {},
    feeds: {},
  };
}

const page = pageWith({ url: "/example/guide/install/", source: pos, frontMatter: {}, title: "Install" });

function props(outputs: Readonly<Record<string, boolean>>): ChromeProps {
  const site: Site = { config: siteConfig(outputs), pages: [page], nav: {}, data: {}, collections: {} };
  return { site, page, trail, pager };
}

/** Opens the panel with the given results and returns the prompt it shows. */
function promptFor(outputs: Readonly<Record<string, boolean>>, results: readonly AskResult[]): string {
  const dom = new JSDOM('<!DOCTYPE html><html lang="en" dir="ltr"><body><div data-ask-agent hidden></div></body></html>');
  const document = dom.window.document;
  const root = document.querySelector("[data-ask-agent]");
  assert.ok(root);
  const agent = activateAskAgent({
    document: document as unknown as AskDocument,
    root: root as unknown as AskElement,
    config: askConfig(props(outputs)),
    clipboard: { writeText: () => Promise.resolve() },
    fetchText: () => Promise.resolve(""),
    lang: "en",
  });
  assert.ok(agent);
  agent.open("how do I install", results);
  const textarea = root.querySelector(".ask-agent-panel textarea") as HTMLTextAreaElement | null;
  assert.ok(textarea);
  return textarea.value;
}

const record: AskResult = {
  url: "/example/books/alpha/",
  title: "Alpha",
  filters: { collection: ["books"] },
};

test("a published llms.txt and page JSON are named for a record page", () => {
  const config = askConfig(props({}));
  assert.equal(config.pageJson, true);
  assert.equal(config.llms, "/example/llms.txt");

  const prompt = promptFor({}, [record]);
  assert.match(prompt, /Site index: https:\/\/example\.com\/example\/llms\.txt/);
  assert.match(prompt, /JSON: https:\/\/example\.com\/example\/books\/alpha\/index\.json/);
});

test("page JSON is not named for a page the search does not call a record", () => {
  const prompt = promptFor({}, [{ url: "/example/guide/install/", title: "Install" }]);
  assert.doesNotMatch(prompt, /JSON:/);
});

test("a site that publishes neither file names neither", () => {
  const config = askConfig(props({ llms: false, "page-json": false }));
  assert.equal(config.pageJson, false);
  assert.equal(config.llms, undefined);

  const prompt = promptFor({ llms: false, "page-json": false }, [record]);
  assert.doesNotMatch(prompt, /Site index/);
  assert.doesNotMatch(prompt, /JSON:/);
});

test("each file is named on its own when only that one is published", () => {
  const noIndex = promptFor({ llms: false }, [record]);
  assert.doesNotMatch(noIndex, /Site index/);
  assert.match(noIndex, /JSON: https:\/\/example\.com\/example\/books\/alpha\/index\.json/);

  const noJson = promptFor({ "page-json": false }, [record]);
  assert.match(noJson, /Site index: https:\/\/example\.com\/example\/llms\.txt/);
  assert.doesNotMatch(noJson, /JSON:/);
});
