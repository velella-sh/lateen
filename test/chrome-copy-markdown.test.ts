import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ChromeProps, Page, Pager, Site, SiteConfig, SourcePos, Trail } from "@velella/mizzen/contracts";
import copyMarkdown, { markdownTwin, pageUrl, twinUrl } from "../chrome/copy-markdown/index.ts";
import {
  activate,
  copy,
  type ActivateEnv,
  type Clipboard,
  type CopyButton,
  type CopyStatus,
} from "../chrome/copy-markdown/client.ts";
const pos: SourcePos = { file: "docs/guide/install.md", line: 3, column: 1, endLine: 9, endColumn: 1 };

function siteConfig(base = "/example"): SiteConfig {
  return {
    title: "Example",
    base,
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
    outputs: {},
    collections: {},
    feeds: {},
  };
}

const trail: Trail = [];
const pager: Pager = {};

function pageWith(url = "/example/guide/install/", kind: Page["kind"] = "doc", lang = "en", dir: Page["dir"] = "ltr"): Page {
  return {
    url,
    source: pos,
    frontMatter: { title: "Install" },
    title: "Install",
    lang,
    dir,
    headings: [],
    html: "",
    markdown: "# Install\n",
    kind,
  };
}

function props(page: Page = pageWith(), base = "/example"): ChromeProps {
  const site: Site = { config: siteConfig(base), pages: [page], nav: {}, data: {}, collections: {} };
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
  const tag = node.type as string;
  const { children, ...rest } = node.props;
  const attrs = Object.entries(rest)
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${String(value)}"`))
    .join("");
  return `<${tag}${attrs}>${html(children)}</${tag}>`;
}

const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);

test("renders a plain Markdown link, a hidden copy button, and a status region", () => {
  const out = html(copyMarkdown(props()));

  assert.match(out, /^<div class="copy-markdown" data-copy-markdown>/);
  assert.match(
    out,
    /<button type="button" class="copy-markdown-button" hidden data-copy-markdown-button data-markdown="\/example\/guide\/install\/index\.md" data-copied="Copied" data-copy-failed="Press Ctrl\+C">Copy page as Markdown<\/button>/,
  );
  assert.match(out, /<a class="copy-markdown-link" href="\/example\/guide\/install\/index\.md">View Markdown<\/a>/);
  assert.match(out, /<p class="copy-markdown-status" role="status" data-copy-markdown-status><\/p>/);
});

test("the link, button, and confirmation follow the page language", () => {
  const out = html(copyMarkdown(props(pageWith("/example/fa/install/", "doc", "fa", "rtl"))));

  assert.match(out, />کپی صفحه به صورت مارک‌داون</);
  assert.match(out, /data-copied="کپی شد"/);
  assert.match(out, /<a class="copy-markdown-link" href="\/example\/fa\/install\/index\.md">مشاهده مارک‌داون<\/a>/);
});

test("a page with no Markdown twin, or one that is not a doc page, renders nothing", () => {
  assert.equal(copyMarkdown(props(pageWith("/example/dashboard/", "app"))), null);
  assert.equal(copyMarkdown(props(pageWith("/example/guide/install.json"))), null);
});

test("the site's base stays in the Markdown twin address, never doubled, when the page URL carries it", () => {
  const out = html(copyMarkdown(props(pageWith("/prefix/guide/install/"), "/prefix")));

  assert.match(out, /href="\/prefix\/guide\/install\/index\.md"/);
  assert.doesNotMatch(out, /\/prefix\/prefix/);
});

test("view and copy share one base-aware twin on a subpath site whose page URL lacks the base", () => {
  const out = html(copyMarkdown(props(pageWith("/guide/install/"), "/docs")));

  assert.match(out, /<a class="copy-markdown-link" href="\/docs\/guide\/install\/index\.md">/);
  assert.match(out, /data-markdown="\/docs\/guide\/install\/index\.md"/);
  assert.equal(out.match(/data-markdown="(\/docs\/guide\/install\/index\.md)"/)![1], "/docs/guide/install/index.md");
});

test("a root deployment keeps the twin exactly as the page URL gives it", () => {
  const out = html(copyMarkdown(props(pageWith("/guide/install/"), "")));

  assert.match(out, /href="\/guide\/install\/index\.md"/);
  assert.match(out, /data-markdown="\/guide\/install\/index\.md"/);
});

test("trailing slashes on the base join exactly once", () => {
  const out = html(copyMarkdown(props(pageWith("/guide/install/"), "/docs/")));

  assert.match(out, /href="\/docs\/guide\/install\/index\.md"/);
  assert.doesNotMatch(out, /\/docs\/\//);
});

test("pageUrl: the base goes in only when the URL does not already carry it", () => {
  assert.equal(pageUrl("/guide/install/", "/docs"), "/docs/guide/install/");
  assert.equal(pageUrl("/docs/guide/install/", "/docs"), "/docs/guide/install/");
  assert.equal(pageUrl("/docs", "/docs"), "/docs");
  assert.equal(pageUrl("/docsify/install/", "/docs"), "/docs/docsify/install/");
  assert.equal(pageUrl("/docs-x/", "/docs"), "/docs/docs-x/");
  assert.equal(pageUrl("/guide/install/", "/docs/"), "/docs/guide/install/");
  assert.equal(pageUrl("/guide/install/", ""), "/guide/install/");
  assert.equal(pageUrl("/guide/install/", "/"), "/guide/install/");
});

test("markdownTwin: base-aware twins for pretty, root, and .html URLs; nothing for file-like ones", () => {
  assert.equal(markdownTwin("/guide/install/", "/docs"), "/docs/guide/install/index.md");
  assert.equal(markdownTwin("/", "/docs"), "/docs/index.md");
  assert.equal(markdownTwin("/docs/", "/docs"), "/docs/index.md");
  assert.equal(markdownTwin("/404.html", "/docs"), "/docs/404.md");
  assert.equal(markdownTwin("/404.html", ""), "/404.md");
  assert.equal(markdownTwin("/guide/install.json", "/docs"), undefined);
  assert.equal(markdownTwin("/docs/feed.xml", "/docs"), undefined);
});

test("a subpath site renders nothing for a non-doc page or a file-like URL, base or not", () => {
  assert.equal(copyMarkdown(props(pageWith("/guide/dashboard/", "app", "en", "ltr"), "/docs")), null);
  assert.equal(copyMarkdown(props(pageWith("/guide/install.json"), "/docs")), null);
});

test("twinUrl: pretty URLs get index.md, HTML files swap their extension, and other files have no twin", () => {
  assert.equal(twinUrl("/guide/install/"), "/guide/install/index.md");
  assert.equal(twinUrl("/guide/install"), "/guide/install/index.md");
  assert.equal(twinUrl("/"), "/index.md");
  assert.equal(twinUrl("/example"), "/example/index.md");
  assert.equal(twinUrl("/404.html"), "/404.md");
  assert.equal(twinUrl("/feed.xml"), undefined);
});

/** A button that records the click listeners wired to it, and presses them like a real click. */
function fakeButton(
  dataset: CopyButton["dataset"] = { markdown: "/example/guide/install/index.md", copied: "Copied", copyFailed: "Press Ctrl+C" },
): CopyButton & { clicks: Array<() => void> } {
  const fake = {
    hidden: true,
    dataset,
    clicks: [] as Array<() => void>,
    addEventListener(type: string, listener: () => void) {
      assert.equal(type, "click");
      fake.clicks.push(listener);
    },
    click() {
      for (const listener of fake.clicks) listener();
    },
  };
  return fake;
}

/** A status region that records the attributes the island sets while a copy runs. */
function fakeStatus(): CopyStatus & { attrs: Map<string, string> } {
  const attrs = new Map<string, string>();
  return {
    textContent: "",
    attrs,
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
  };
}

/** An environment whose fetch and clipboard record their calls. */
function env(
  options: { fetchText?: (url: string) => Promise<string>; clipboard?: Clipboard } = {},
): ActivateEnv & {
  fetched: string[];
  wrote: string[];
  status: CopyStatus & { attrs: Map<string, string> };
} {
  const fake = {
    fetched: [] as string[],
    wrote: [] as string[],
    status: fakeStatus(),
    fetchText:
      options.fetchText ??
      ((url: string) => {
        fake.fetched.push(url);
        return Promise.resolve("# Install\n");
      }),
    clipboard:
      options.clipboard ??
      ({
        writeText(text: string) {
          fake.wrote.push(text);
          return Promise.resolve();
        },
      } satisfies Clipboard),
  };
  return fake;
}

/** Lets the fetch and clipboard promises settle. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("activate reveals the button and wires the click without requesting anything yet", () => {
  const button = fakeButton();
  const world = env();
  activate(button, world);

  assert.equal(button.hidden, false);
  assert.equal(button.clicks.length, 1);
  assert.deepEqual(world.fetched, []);
  assert.deepEqual(world.wrote, []);
});

test("a click fetches the Markdown twin, writes it to the clipboard, and announces it", async () => {
  const button = fakeButton();
  const world = env();
  activate(button, world);

  button.clicks[0]!();
  await settle();

  assert.deepEqual(world.fetched, ["/example/guide/install/index.md"]);
  assert.deepEqual(world.wrote, ["# Install\n"]);
  assert.equal(world.status.textContent, "Copied");
});

test("an adjacent copy control keeps its own status region and announces once", async () => {
  const pageButton = fakeButton();
  const pageStatus = fakeStatus();
  const codeStatus: CopyStatus = { textContent: "" };
  const world = env();

  activate(pageButton, { ...world, status: pageStatus });
  activate(fakeButton(), { ...world, status: codeStatus });

  pageButton.clicks[0]!();
  await settle();

  assert.equal(pageStatus.textContent, "Copied");
  assert.equal(pageStatus.attrs.get("aria-busy"), undefined);
  assert.equal(codeStatus.textContent, "");
  assert.deepEqual(world.wrote, ["# Install\n"]);
});

test("the copy button fetches the same base-aware twin the plain link shows, byte for byte", async () => {
  const out = html(copyMarkdown(props(pageWith("/guide/install/"), "/docs")));
  const markdown = out.match(/data-markdown="([^"]+)"/)![1]!;
  assert.equal(markdown, "/docs/guide/install/index.md");

  const button = fakeButton({ markdown, copied: "Copied", copyFailed: "Press Ctrl+C" });
  const world = env();
  activate(button, world);
  button.clicks[0]!();
  await settle();

  assert.deepEqual(world.fetched, [markdown], "the copy takes the published twin address");
  assert.deepEqual(world.wrote, ["# Install\n"], "the exact fetched bytes reach the clipboard");
  assert.equal(world.status.textContent, "Copied");
});

test("a copy in flight clears the old message, marks the status busy, and announces once it settles", async () => {
  let settleFetch!: (markdown: string) => void;
  const button = fakeButton();
  const world = env({ fetchText: () => new Promise<string>((resolve) => (settleFetch = resolve)) });
  activate(button, world);

  world.status.textContent = "Press Ctrl+C";
  button.clicks[0]!();

  assert.equal(world.status.textContent, "", "the old answer is gone while the new request runs");
  assert.equal(world.status.attrs.get("aria-busy"), "true");

  settleFetch("# Install\n");
  await settle();

  assert.equal(world.status.attrs.has("aria-busy"), false);
  assert.equal(world.status.textContent, "Copied");
});

test("a second press while a copy is in flight does not fetch or announce twice", async () => {
  let settleFetch!: (markdown: string) => void;
  let calls = 0;
  const button = fakeButton();
  const world = env({
    fetchText: () => {
      calls += 1;
      return new Promise<string>((resolve) => (settleFetch = resolve));
    },
  });
  activate(button, world);

  button.clicks[0]!();
  button.clicks[0]!();
  settleFetch("# Install\n");
  await settle();

  assert.equal(calls, 1);
  assert.deepEqual(world.wrote, ["# Install\n"]);
  assert.equal(world.status.textContent, "Copied");
});

test("a failed request or a refused clipboard announces the failure instead", async () => {
  const rejectedClipboard: Clipboard = { writeText: () => Promise.reject(new Error("denied")) };
  const requestFails = env({ fetchText: () => Promise.reject(new Error("offline")) });
  const clipboardFails = env({ clipboard: rejectedClipboard });

  await copy(fakeButton(), requestFails);
  assert.equal(requestFails.status.textContent, "Press Ctrl+C");

  await copy(fakeButton(), clipboardFails);
  assert.equal(clipboardFails.status.textContent, "Press Ctrl+C");
});

test("without a clipboard or fetch, the button stays hidden and no click is wired", () => {
  const button = fakeButton();
  activate(button, { status: { textContent: "" } });

  assert.equal(button.hidden, true);
  assert.equal(button.clicks.length, 0);

  const noFetch = fakeButton();
  activate(noFetch, { clipboard: { writeText: () => Promise.resolve() }, status: { textContent: "" } });

  assert.equal(noFetch.hidden, true);
  assert.equal(noFetch.clicks.length, 0);
});

test("a button with no Markdown address stays hidden and copies nothing", async () => {
  const button = fakeButton({});
  const world = env();
  activate(button, world);

  assert.equal(button.hidden, true);
  assert.equal(button.clicks.length, 0);

  await copy(button, world);
  assert.deepEqual(world.fetched, []);
  assert.equal(world.status.textContent, "");
});

