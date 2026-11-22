import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Fragment } from "preact";
import type { ChromeProps, Page, Pager, RepositoryConfig, Site, SiteConfig, SourcePos, Trail } from "@velella/mizzen/contracts";
import pageFooter from "../../../chrome/page-footer/index.ts";
import { activate, copy, RESET_MS, type Clipboard, type CopyButton, type CopyEnv } from "../../../chrome/page-footer/client.ts";
import { readUiCss } from "../../ui-css-helpers.ts";

const pos: SourcePos = { file: "docs/guide/install.md", line: 3, column: 1, endLine: 9, endColumn: 1 };

const repository: RepositoryConfig = { url: "https://github.com/velella-sh/lateen/", branch: "main", dir: "docs" };

function siteConfig(repo?: RepositoryConfig): SiteConfig {
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
    ...(repo === undefined ? {} : { repository: repo }),
    theme: { options: {} },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
    feeds: {},
  };
}

const trail: Trail = [];
const pager: Pager = {};

function pageWith(frontMatter: Record<string, unknown> = {}, source: SourcePos = pos): Page {
  return {
    url: "/example/guide/install/",
    source,
    frontMatter: { title: "Install", ...frontMatter },
    title: "Install",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
  };
}

function props(page: Page, repo?: RepositoryConfig): ChromeProps {
  const site: Site = { config: siteConfig(repo), pages: [page], nav: {}, data: {}, collections: {} };
  return { site, page, trail, pager };
}

type VNode = { type: unknown; props: { children?: unknown; [key: string]: unknown } };

function isVNode(node: unknown): node is VNode {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

/** Minimal Preact vnode → HTML string for assertions (no render-to-string dependency). */
function html(node: unknown): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(html).join("");
  if (!isVNode(node)) return "";
  if (node.type === Fragment) return html(node.props.children);
  if (typeof node.type === "function") return html((node.type as (p: object) => unknown)(node.props));
  const tag = node.type as string;
  const { children, ...rest } = node.props;
  const attrs = Object.entries(rest)
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${String(value)}"`))
    .join("");
  return `<${tag}${attrs}>${html(children)}</${tag}>`;
}

const names = JSON.parse(readFileSync(new URL("../../../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);

test("the copy button starts hidden, so a visitor without JavaScript never sees it", () => {
  const out = html(pageFooter(props(pageWith())));

  assert.match(out, /<button type="button" class="page-footer-copy" hidden data-page-footer-copy data-prompt=.*>Edit with your agent<\/button>/);
});

test("the agent prompt names the source file and line and the page title", () => {
  const out = html(pageFooter(props(pageWith())));

  assert.match(out, /data-prompt="Edit docs\/guide\/install\.md:3\. Current text: .*Install.*\. Change:"/);
});

test("the button carries the copied and failure messages for the island", () => {
  const out = html(pageFooter(props(pageWith())));

  assert.match(out, /data-copied="Copied"/);
  assert.match(out, /data-copy-failed="Press Ctrl\+C"/);
});

test("the footer asks for no feedback, and keeps the report link", () => {
  const out = html(pageFooter(props(pageWith(), repository)));

  assert.doesNotMatch(out, /Was this helpful|Give feedback/);
  assert.match(out, /<p class="page-footer-feedback"><a href="https:\/\/github\.com\/velella-sh\/lateen\/issues\/new\?[^"]*" rel="noopener">Report a problem with this page<\/a><\/p>/);
});

test("the report link fills an issue with the page, source, language and version", () => {
  const out = html(pageFooter(props(pageWith({ version: "v2" }), repository)));

  assert.match(out, /issues\/new\?title=Install&body=I%20found%20a%20problem%20with%20this%20page\.%0A%0APage%3A%20%2Fexample%2Fguide%2Finstall%2F%0ASource%3A%20docs%2Fguide%2Finstall\.md%0ALanguage%3A%20en%0AVersion%3A%20v2%0A/);
});

test("a record page asks about the data, not the page", () => {
  const page = { ...pageWith(), record: { collection: "books", id: "a", position: { file: "books.json", startLine: 1, endLine: 2 } } } as Page;
  const out = html(pageFooter(props(page, repository)));

  assert.match(out, /Report a problem with this data/);
  assert.match(out, /Collection%3A%20books/);
});

test("a custom tracker template works without a repository", () => {
  const config = siteConfig();
  const site: Site = {
    config: { ...config, theme: { options: { reportIssue: { url: "https://tracker.example.com/new?title={title}&body={body}" } } } },
    pages: [],
    nav: {},
    data: {},
    collections: {},
  };
  const page = pageWith();
  const out = html(pageFooter({ site, page, trail, pager }));

  assert.match(out, /https:\/\/tracker\.example\.com\/new\?title=Install&body=I%20found/);
  assert.doesNotMatch(out, /Was this helpful/);
});

test("reportIssue false turns the report link off", () => {
  const config = siteConfig(repository);
  const site: Site = {
    config: { ...config, theme: { options: { reportIssue: false } } },
    pages: [],
    nav: {},
    data: {},
    collections: {},
  };
  const page = pageWith();
  const out = html(pageFooter({ site, page, trail, pager }));

  assert.doesNotMatch(out, /Report a problem|Give feedback/);
});

test("without a repository or a tracker, both links are left out and the prompt stays", () => {
  const out = html(pageFooter(props(pageWith())));

  assert.doesNotMatch(out, /issues\/new/);
  assert.doesNotMatch(out, /Was this helpful/);
  assert.match(out, /data-page-footer-copy/);
});

test("the back-to-top link targets the main landmark with the label and arrow", () => {
  const out = html(pageFooter(props(pageWith())));

  assert.match(
    out,
    /<a class="back-to-top" href="#main"><svg class="back-to-top-arrow"[^>]* aria-hidden="true" focusable="false">.*M12 19V5.*<\/svg>Back to top<\/a>/,
  );
});

test("the back-to-top control follows the page actions as the last element of the footer", () => {
  const withFeedback = html(pageFooter(props(pageWith(), repository)));
  assert.match(withFeedback, /<\/p><a class="back-to-top" href="#main">/);

  const withoutRepository = html(pageFooter(props(pageWith())));
  assert.match(withoutRepository, /<\/button><a class="back-to-top" href="#main">/);
  assert.match(withoutRepository, /<\/a><\/div>$/);
});

test("the back-to-top label follows the page language in both directions", () => {
  for (const [lang, dir, label] of [
    ["en", "ltr", "Back to top"],
    ["fa", "rtl", "بازگشت به بالا"],
    ["ar", "rtl", "العودة إلى الأعلى"],
  ] as const) {
    const page = { ...pageWith(), lang, dir };
    const out = html(pageFooter(props(page)));
    assert.ok(out.includes(`</svg>${label}</a>`), `${lang} label`);
  }
});

test("the back-to-top link is a plain link with no JavaScript gate", () => {
  const out = html(pageFooter(props(pageWith())));
  const link = /<a class="back-to-top"[^>]*>/.exec(out)?.[0] ?? "";

  assert.equal(link, '<a class="back-to-top" href="#main">');
  assert.doesNotMatch(link, /hidden|data-|onclick/);
});

test("the back-to-top styles use logical margin and add no motion", () => {
  const css = readUiCss();
  const rule = /\.back-to-top\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

  assert.match(rule, /ms-auto/, "the control sits at the inline end in both directions");
  assert.doesNotMatch(rule, /margin-(left|right)|(^|[;{\s])(left|right):/, "no physical side");
  assert.doesNotMatch(rule, /transition|animation/, "the control adds no motion");

  const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  assert.match(reduced, /transition:\s*none\s*!important/);
});

/** A button with the attributes the page renders and a click listener that tests can fire. */
function fakeButton(hidden = true): CopyButton & { clicks: Array<() => void>; click(): void } {
  const fake = {
    hidden,
    textContent: "Edit with your agent" as string | null,
    dataset: { prompt: "Edit docs/guide/install.md:3.", copied: "Copied", copyFailed: "Press Ctrl+C" },
    clicks: [] as Array<() => void>,
    addEventListener(type: "click", listener: () => void) {
      assert.equal(type, "click");
      fake.clicks.push(listener);
    },
    click() {
      for (const listener of fake.clicks) listener();
    },
  };
  return fake;
}

/** A clipboard that records what it was given and resolves or rejects as the test asks. */
function fakeClipboard(ok = true): Clipboard & { written: string[] } {
  const fake = {
    written: [] as string[],
    writeText(text: string) {
      fake.written.push(text);
      return ok ? Promise.resolve() : Promise.reject(new Error("denied"));
    },
  };
  return fake;
}

/** An environment whose timer is recorded, not run, so tests decide when the label comes back. */
function fakeEnv(clipboard?: Clipboard): CopyEnv & { timers: Array<{ callback: () => void; ms: number }> } {
  const fake = {
    clipboard,
    timers: [] as Array<{ callback: () => void; ms: number }>,
    schedule(callback: () => void, ms: number) {
      fake.timers.push({ callback, ms });
      return fake.timers.length;
    },
  };
  return fake;
}

test("activate: without a clipboard the button stays hidden and nothing is wired", () => {
  const button = fakeButton();
  activate(button, fakeEnv(undefined));

  assert.equal(button.hidden, true);
  assert.equal(button.clicks.length, 0);
});

test("activate: with a clipboard the button is revealed and its click is wired", () => {
  const button = fakeButton();
  activate(button, fakeEnv(fakeClipboard()));

  assert.equal(button.hidden, false);
  assert.equal(button.clicks.length, 1);
});

test("a click writes the prompt, says Copied, and restores the label after the reset delay", async () => {
  const button = fakeButton();
  const clipboard = fakeClipboard();
  const env = fakeEnv(clipboard);
  activate(button, env);

  button.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(clipboard.written, ["Edit docs/guide/install.md:3."]);
  assert.equal(button.textContent, "Copied");
  assert.equal(env.timers.length, 1);
  assert.equal(env.timers[0]!.ms, RESET_MS);

  env.timers[0]!.callback();
  assert.equal(button.textContent, "Edit with your agent");
});

test("a refused clipboard says Press Ctrl+C and still restores the label", async () => {
  const button = fakeButton();
  const env = fakeEnv(fakeClipboard(false));
  activate(button, env);

  button.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(button.textContent, "Press Ctrl+C");
  env.timers[0]!.callback();
  assert.equal(button.textContent, "Edit with your agent");
});

test("copy keeps the label it was given, even while a previous result is still on screen", async () => {
  const button = fakeButton();
  button.textContent = "Copied";
  const env = fakeEnv(fakeClipboard());

  await copy(button, "Edit with your agent", env);

  env.timers[0]!.callback();
  assert.equal(button.textContent, "Edit with your agent");
});
