import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import type { Site, SourcePos } from "@velella/mizzen/contracts";
import details, { BODY_CLASS, DEFAULT_SUMMARY, DETAILS_CLASS, SUMMARY_CLASS, type DetailsProps } from "../components/details/index.ts";
import { reveal, watch, type FragmentDocument, type FragmentWindow } from "../components/details/client.ts";
import { siteConfig } from "./helpers/site.ts";
import { pageWith } from "./helpers/page.ts";

const pos: SourcePos = { file: "docs/guide/setup.md", line: 4, column: 1, endLine: 9, endColumn: 1 };

const config = siteConfig({ base: "/example" });

const page = pageWith({ url: "/example/guide/setup/", source: pos, frontMatter: { title: "Setup" }, title: "Setup" });

const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {} };

function render(props: DetailsProps, body = "<p>Body text.</p>"): string {
  return html(details({ props, page, site, html: body }));
}

type VNode = { type: unknown; props: { children?: unknown; [key: string]: unknown } };

function isVNode(node: unknown): node is VNode {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

/** Minimal Preact vnode → HTML string for assertions. Escapes text; `dangerouslySetInnerHTML` is raw. */
function html(node: unknown): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return escapeText(String(node));
  if (Array.isArray(node)) return node.map(html).join("");
  if (!isVNode(node)) return "";
  const tag = node.type as string;
  const { children, dangerouslySetInnerHTML, ...rest } = node.props;
  const attrs = Object.entries(rest)
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${escapeAttr(String(value))}"`))
    .join("");
  const inner = dangerouslySetInnerHTML ? (dangerouslySetInnerHTML as { __html: string }).__html : html(children);
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

test("default export is the details component", () => {
  assert.equal(typeof details, "function");
});

test("renders a closed details element whose first child is the summary", () => {
  const out = render({ summary: "Install steps" });
  assert.match(
    out,
    new RegExp(`^<details class="${DETAILS_CLASS}"><summary class="${SUMMARY_CLASS}">Install steps</summary><div class="${BODY_CLASS}">`),
  );
  assert.doesNotMatch(out, /<details[^>]* open/);
});

test("keeps the rendered Markdown body as raw HTML inside the body region", () => {
  const out = render({ summary: "Notes" }, "<p>See <a href=\"#setup\">setup</a>.</p>");
  assert.match(out, new RegExp(`<div class="${BODY_CLASS}"><p>See <a href="#setup">setup</a>\\.</p></div>`));
});

test("the open prop, valueless as in :::details{open}, starts the block expanded", () => {
  const out = render({ summary: "Open by default", open: "" });
  assert.match(out, new RegExp(`^<details class="${DETAILS_CLASS}" open>`));
});

test("a missing or blank summary falls back to the default label", () => {
  assert.match(render({}), new RegExp(`<summary class="${SUMMARY_CLASS}">${DEFAULT_SUMMARY}</summary>`));
  assert.match(render({ summary: "   " }), new RegExp(`<summary class="${SUMMARY_CLASS}">${DEFAULT_SUMMARY}</summary>`));
});

test("escapes the summary text", () => {
  const out = render({ summary: "<script>alert(1)</script>" });
  assert.doesNotMatch(out, /<script\b[^>]*>/i);
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

/* The island: a closed disclosure hides the fragment target, so the target's ancestors open first. */
function domPage(body: string, hash = "") {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${body}</body></html>`, {
    url: `https://example.com/guide/${hash}`,
  });
  const document = dom.window.document;
  const scrolled: string[] = [];
  for (const element of document.querySelectorAll("[id]")) {
    (element as unknown as { scrollIntoView?: () => void }).scrollIntoView = () => scrolled.push(element.id);
  }
  return {
    dom,
    document,
    doc: document as unknown as FragmentDocument,
    win: dom.window as unknown as FragmentWindow,
    scrolled,
  };
}

test("a fragment on load opens its closed disclosure, focuses the target, and scrolls to it", () => {
  const { document, doc, win, scrolled } = domPage(
    `<details class="${DETAILS_CLASS}"><summary>Install</summary><h3 id="windows">Windows</h3></details>`,
    "#windows",
  );
  watch(doc, win);

  assert.equal(document.querySelector<HTMLDetailsElement>("details")!.open, true);
  assert.equal(document.activeElement?.id, "windows");
  assert.equal(document.getElementById("windows")!.getAttribute("tabindex"), "-1", "a heading is focusable for this visit");
  assert.deepEqual(scrolled, ["windows"]);
});

test("a hash change opens the disclosure that owns the new target", () => {
  const { dom, document, doc, win } = domPage(
    '<details id="first"><summary>First</summary><p id="one">One</p></details>' +
      '<details id="second"><summary>Second</summary><p id="two">Two</p></details>',
  );
  watch(doc, win);
  assert.deepEqual([...document.querySelectorAll<HTMLDetailsElement>("details")].map((entry) => entry.open), [false, false]);

  dom.reconfigure({ url: "https://example.com/guide/#two" });
  dom.window.dispatchEvent(new dom.window.Event("hashchange"));

  assert.deepEqual([...document.querySelectorAll<HTMLDetailsElement>("details")].map((entry) => entry.open), [false, true]);
  assert.equal(document.activeElement?.id, "two");
});

test("nested closed disclosures all open around the target", () => {
  const { document, doc, win } = domPage(
    '<details id="outer"><summary>Outer</summary><details id="inner"><summary>Inner</summary><p id="deep">Deep</p></details></details>',
    "#deep",
  );
  watch(doc, win);

  assert.equal(document.querySelector<HTMLDetailsElement>("#outer")!.open, true);
  assert.equal(document.querySelector<HTMLDetailsElement>("#inner")!.open, true);
  assert.equal(document.activeElement?.id, "deep");
});

test("a disclosure beside the target's ancestors stays closed", () => {
  const { document, doc, win } = domPage(
    '<details id="other"><summary>Other</summary><p>Elsewhere</p></details>' +
      '<details id="own"><summary>Own</summary><p id="target">Target</p></details>',
    "#target",
  );
  watch(doc, win);

  assert.equal(document.querySelector<HTMLDetailsElement>("#own")!.open, true);
  assert.equal(document.querySelector<HTMLDetailsElement>("#other")!.open, false);
});

test("a fragment with no target changes nothing", () => {
  const { document, doc, win, scrolled } = domPage(
    '<details id="closed"><summary>Closed</summary><p id="present">Here</p></details>',
    "#missing",
  );
  watch(doc, win);

  assert.equal(document.querySelector<HTMLDetailsElement>("#closed")!.open, false);
  assert.equal(document.activeElement, document.body, "load does not steal focus for a missing target");
  assert.deepEqual(scrolled, []);
  assert.equal(reveal(doc, ""), false, "an empty fragment names no target");
  assert.equal(reveal(doc, "#"), false);
});

