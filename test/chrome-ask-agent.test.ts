import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, Page, Pager, Site, SiteConfig, SourcePos, Trail } from "@velella/mizzen/contracts";
import askAgent, { askAgentSection, askConfig, askJson } from "../chrome/ask-agent/index.ts";
import { parseAskConfig } from "../chrome/ask-agent/client.ts";
import { buildPrompt, DEFAULT_STRINGS, PAGE_LIMIT, TEXT_LIMIT, type PromptPage } from "../chrome/ask-agent/prompt.ts";

const pos: SourcePos = { file: "index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };
const trail: Trail = [];
const pager: Pager = {};

function siteConfig(options: Readonly<Record<string, unknown>> = {}, overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Example",
    base: "/example",
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
    ...overrides,
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

function props(options: Readonly<Record<string, unknown>> = {}, overrides: Partial<SiteConfig> = {}, lang = "en"): ChromeProps {
  const page = pageWith(lang);
  const site: Site = { config: siteConfig(options, overrides), pages: [page], nav: {}, data: {} };
  return { site, page, trail, pager };
}

function json(node: unknown): string {
  return renderToString(node as never);
}

test("the prompt names the question, the pages, their addresses, and their Markdown twins", () => {
  const built = buildPrompt({
    site: "Example",
    question: "how do I install the theme",
    pages: [
      { title: "Install", url: "/guide/install/", markdown: "/guide/install/index.md" },
      { title: "", url: "/layouts/", markdown: "/layouts/index.md" },
    ],
  });

  assert.match(built.prompt, /^You are helping me with a question about the Example documentation\./);
  assert.match(built.prompt, /Question: how do I install the theme/);
  assert.match(built.prompt, /- Install — \/guide\/install\/ \(Markdown: \/guide\/install\/index\.md\)/);
  assert.match(built.prompt, /- \/layouts\/ — \/layouts\/ \(Markdown: \/layouts\/index\.md\)/);
  assert.equal(built.cutPages, 0);
  assert.equal(built.cutText, false);
});

test("the prompt names the site index when the site publishes one", () => {
  const built = buildPrompt({
    site: "Example",
    question: "two words",
    pages: [{ title: "Install", url: "/install/" }],
    siteIndex: "https://example.com/example/llms.txt",
  });
  assert.match(built.prompt, /Site index: https:\/\/example\.com\/example\/llms\.txt/);
});

test("the prompt keeps the reader's text as typed and adds no markup of its own", () => {
  const built = buildPrompt({
    site: "Example",
    question: "why does <b>this</b> break",
    pages: [{ title: "A & B", url: "/a/" }],
  });
  assert.match(built.prompt, /Question: why does <b>this<\/b> break/);
  assert.match(built.prompt, /- A & B — \/a\//);
  assert.doesNotMatch(built.prompt, /&lt;|&amp;/);
});

test("the page limit cuts the list and says so in the prompt", () => {
  const pages: PromptPage[] = Array.from({ length: PAGE_LIMIT + 2 }, (_value, index) => ({
    title: `Page ${index + 1}`,
    url: `/page-${index + 1}/`,
  }));
  const built = buildPrompt({ site: "Example", question: "two words", pages });

  assert.equal(built.pages.length, PAGE_LIMIT);
  assert.equal(built.cutPages, 2);
  assert.match(built.prompt, new RegExp(`Only the first ${PAGE_LIMIT} related pages are included\\.`));
  assert.doesNotMatch(built.prompt, /Page 6/);
});

test("the text limit cuts the page text and names every page it left out", () => {
  const built = buildPrompt({
    site: "Example",
    question: "two words",
    pages: [
      { title: "First", url: "/first/", text: "a".repeat(TEXT_LIMIT - 2) },
      { title: "Second", url: "/second/", text: "b".repeat(100) },
    ],
    textLimit: TEXT_LIMIT,
  });

  assert.equal(built.cutText, true);
  assert.match(built.prompt, /### First\n/);
  assert.doesNotMatch(built.prompt, new RegExp(`b{100}`));
  assert.match(built.prompt, /The page text was cut at 12000 characters; left out: Second\./);
});

test("the prompt uses the page language's wording", () => {
  const fa = askConfig(props({}, {}, "fa"));
  const ar = askConfig(props({}, {}, "ar"));
  assert.match(fa.messages.prompt.intro, /مستندات \{site\}/);
  assert.match(ar.messages.prompt.question, /^السؤال:/);
  assert.notEqual(fa.messages.copy, "Copy prompt");
  assert.notEqual(ar.messages.heading, "Ask your agent");
});

test("a provider joins the panel only when it takes a prompt and nothing else", () => {
  const config = askConfig(
    props({
      pageAgent: {
        providers: [
          { title: "Claude", url: "https://claude.ai/new?q={prompt}" },
          { title: "Page menu", url: "https://example.com/?q={markdown}" },
          { title: "Mixed", url: "https://example.com/?q={prompt}&lang={lang}" },
          { title: "Unsafe", url: "javascript:alert({prompt})" },
        ],
      },
    }),
  );

  assert.deepEqual(config.providers, [{ title: "Claude", url: "https://claude.ai/new?q={prompt}" }]);
});

test("the site's origin and published files are read from the config", () => {
  const on = askConfig(props({}, { url: "https://example.com/example" }));
  assert.equal(on.origin, "https://example.com");
  assert.equal(on.markdown, true);
  assert.equal(on.llms, "/example/llms.txt");

  const off = askConfig(props({}, { outputs: { twins: false, llms: false } }));
  assert.equal(off.markdown, false);
  assert.equal(off.llms, undefined);
});

test("the panel's JSON is inert and reads back as the same config", () => {
  const config = askConfig(props({ pageAgent: { providers: [{ title: "<Claude>", url: "https://claude.ai/new?q={prompt}" }] } }));
  const written = askJson(config);
  assert.doesNotMatch(written, /<\/script|</);

  const out = json(askAgent(props()));
  assert.match(out, /^<script type="application\/json" data-ask-agent-config>/);
  const parsed = parseAskConfig(written);
  assert.deepEqual(parsed, config);
});

test("parseAskConfig rejects missing or malformed data", () => {
  assert.equal(parseAskConfig(null), undefined);
  assert.equal(parseAskConfig("not json"), undefined);
  assert.equal(parseAskConfig("{}"), undefined);
  assert.equal(parseAskConfig('{"site":"A","markdown":true,"providers":[],"limits":{},"messages":{}}'), undefined);
});

test("the search results section explains the feature and links llms.txt", () => {
  const out = json(askAgentSection(props()));
  assert.match(out, /<section class="ask-agent-section" data-ask-agent-section>/);
  assert.match(out, /Ask your agent/);
  assert.match(out, /<a href="\/example\/llms\.txt">Read llms\.txt<\/a>/);
});

test("the search results section stays out when the site publishes no Markdown twins", () => {
  assert.equal(askAgentSection(props({}, { outputs: { twins: false } })), null);
});

test("a question with no pages still reads as a complete prompt", () => {
  const built = buildPrompt({ site: "Example", question: "two words", pages: [], strings: DEFAULT_STRINGS });
  assert.match(built.prompt, /^You are helping me with a question about the Example documentation\./);
  assert.match(built.prompt, /Question: two words/);
  assert.doesNotMatch(built.prompt, /Related pages:/);
});
