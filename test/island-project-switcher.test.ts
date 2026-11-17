import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, NetworkProject, Page, Pager, Site, SiteConfig, SiteNetwork, SourcePos, Trail } from "@velella/mizzen/contracts";
import projectSwitcher from "../chrome/project-switcher/index.ts";
import {
  activate,
  type SwitcherDisclosure,
  type SwitcherDocument,
  type SwitcherFocusable,
} from "../chrome/project-switcher/island.ts";

const pos: SourcePos = { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config: SiteConfig = {
  title: "Alpha",
  base: "/alpha",
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

const page: Page = {
  url: "/alpha/guide/install/",
  source: pos,
  frontMatter: { title: "Install" },
  title: "Install",
  lang: "en",
  dir: "ltr",
  headings: [],
  html: "",
  markdown: "",
  kind: "doc",
};

const trail: Trail = [];
const pager: Pager = {};

function project(id: string, title: string, current = false): NetworkProject {
  return { id, path: id, title, current };
}

function props(): ChromeProps {
  const network: SiteNetwork = {
    current: "alpha",
    lock: "0".repeat(64),
    projects: [project("alpha", "Alpha", true), project("beta", "Beta Docs"), project("gamma", "Gamma")],
  };
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {}, network };
  return { site, page, trail, pager };
}

function setup() {
  const html = renderToString(projectSwitcher(props()) as never);
  const dom = new JSDOM(`<body>${html}</body>`);
  const doc = dom.window.document;
  const disclosure = doc.querySelector("[data-project-switcher]") as unknown as HTMLDetailsElement;
  const summary = doc.querySelector("summary") as HTMLElement;
  const links = [...doc.querySelectorAll("a[href]")] as HTMLAnchorElement[];
  const outside = doc.createElement("a");
  outside.href = "/elsewhere/";
  doc.body.append(outside);

  activate(
    {
      disclosure: disclosure as unknown as SwitcherDisclosure,
      summary: summary as SwitcherFocusable,
      links: links as unknown as SwitcherFocusable[],
    },
    {
      document: doc as unknown as SwitcherDocument,
      hasFocus: (node) => (node as HTMLElement).contains(doc.activeElement),
    },
  );

  const key = (target: Element, name: string): KeyboardEvent => {
    const event = new dom.window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  const click = (target: EventTarget): MouseEvent => {
    const event = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  const focusout = (target: Element, relatedTarget: EventTarget | null): FocusEvent => {
    const event = new dom.window.FocusEvent("focusout", { bubbles: true, relatedTarget });
    target.dispatchEvent(event);
    return event;
  };

  return { dom, doc, disclosure, summary, links, outside, key, click, focusout };
}

test("the page is a native disclosure that works with no script", () => {
  const { disclosure, summary, links, dom } = setup();
  assert.equal(disclosure.tagName, "DETAILS");
  assert.equal(disclosure.open, false);
  assert.equal(summary.tagName, "SUMMARY");
  assert.match(summary.textContent ?? "", /Projects/);
  assert.equal(summary.querySelector(".project-switcher-marker")?.getAttribute("aria-hidden"), "true");
  assert.equal(links.length, 3);
  assert.equal(dom.window.document.querySelectorAll("[aria-current='true']").length, 1);
  for (const link of links) {
    assert.doesNotMatch(link.outerHTML, /hidden|tabindex="-1"/);
    assert.match(link.getAttribute("href") ?? "", /^\/(alpha|beta|gamma)\/$/);
  }
});

test("Escape closes the disclosure and returns focus to the summary", () => {
  const { disclosure, summary, links, key, doc } = setup();
  disclosure.open = true;
  links[1]!.focus();
  const event = key(links[1]!, "Escape");
  assert.equal(event.defaultPrevented, true);
  assert.equal(disclosure.open, false);
  assert.equal(doc.activeElement, summary);
});

test("Escape on a closed disclosure is left to the page", () => {
  const { disclosure, summary, links, key, doc } = setup();
  const event = key(links[0]!, "Escape");
  assert.equal(event.defaultPrevented, false);
  assert.equal(disclosure.open, false);
  assert.notEqual(doc.activeElement, summary);
});

test("arrow keys move between links and wrap at both ends", () => {
  const { disclosure, links, key } = setup();
  disclosure.open = true;

  links[0]!.focus();
  assert.equal(key(links[0]!, "ArrowDown").defaultPrevented, true);
  assert.equal(links[1]!.matches(":focus"), true);

  links[0]!.focus();
  assert.equal(key(links[0]!, "ArrowUp").defaultPrevented, true);
  assert.equal(links[2]!.matches(":focus"), true);

  links[2]!.focus();
  key(links[2]!, "ArrowDown");
  assert.equal(links[0]!.matches(":focus"), true);

  links[1]!.focus();
  key(links[1]!, "ArrowUp");
  assert.equal(links[0]!.matches(":focus"), true);
});

test("arrow keys do nothing while the disclosure is closed", () => {
  const { disclosure, links, key, doc } = setup();
  links[0]!.focus();
  const event = key(links[0]!, "ArrowDown");
  assert.equal(event.defaultPrevented, false);
  assert.equal(disclosure.open, false);
  assert.equal(doc.activeElement, links[0]);
});

test("a click outside closes the disclosure and a click inside keeps it open", () => {
  const { disclosure, links, outside, click, doc } = setup();
  disclosure.open = true;
  click(links[0]!);
  assert.equal(disclosure.open, true);

  click(doc.body);
  assert.equal(disclosure.open, false);

  disclosure.open = true;
  click(outside);
  assert.equal(disclosure.open, false);
});

test("focus leaving the disclosure closes it; focus staying inside does not", () => {
  const { disclosure, links, summary, outside, focusout, doc } = setup();
  disclosure.open = true;
  links[0]!.focus();

  focusout(links[0]!, summary);
  assert.equal(disclosure.open, true);

  focusout(links[0]!, outside);
  assert.equal(disclosure.open, false);

  disclosure.open = true;
  links[0]!.focus();
  focusout(links[0]!, null);
  assert.equal(disclosure.open, true);

  outside.focus();
  disclosure.open = true;
  focusout(links[0]!, null);
  assert.equal(disclosure.open, false);});

test("Tab is never trapped: the island leaves it to the browser", () => {
  const { disclosure, links, key } = setup();
  disclosure.open = true;
  links[0]!.focus();
  const event = key(links[0]!, "Tab");
  assert.equal(event.defaultPrevented, false);
  assert.equal(disclosure.open, true);
  assert.equal(links[0]!.matches(":focus"), true);
});
