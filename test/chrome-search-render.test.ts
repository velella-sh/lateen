import assert from "node:assert/strict";
import { test } from "node:test";
import type { PaletteRun } from "../chrome/command-palette/actions.ts";
import { activeIndexOf, optionList, type SearchRecord } from "../chrome/search/options.ts";
import {
  renderOptions,
  type SearchDocument,
  type SearchElement,
  type SearchNode,
  type SearchResults,
} from "../chrome/search/render.ts";

// ---------------------------------------------------------------------------
// A small DOM, so the renderer can be inspected without a browser.

interface FakeNode {
  tag: string;
  text?: string;
  attrs: Record<string, string>;
  children: FakeNode[];
  listeners: Record<string, Array<() => void>>;
  clicks: number;
  scrolls: number;
  setAttribute(name: string, value: string): void;
  append(...nodes: SearchNode[]): void;
  addEventListener(type: string, listener: () => void): void;
  click(): void;
  scrollIntoView(options: { readonly block: "nearest" }): void;
}

function fakeDocument(): SearchDocument {
  const make = (tag: string, text?: string): FakeNode => {
    const node: FakeNode = {
      tag,
      ...(text === undefined ? {} : { text }),
      attrs: {},
      children: [],
      listeners: {},
      clicks: 0,
      scrolls: 0,
      setAttribute(name: string, value: string) {
        node.attrs[name] = value;
      },
      append(...nodes: SearchNode[]) {
        for (const child of nodes) node.children.push(child as unknown as FakeNode);
      },
      addEventListener(type: string, listener: () => void) {
        (node.listeners[type] ??= []).push(listener);
      },
      click() {
        node.clicks += 1;
        for (const listener of node.listeners["click"] ?? []) listener();
      },
      scrollIntoView() {
        node.scrolls += 1;
      },
    };
    return node;
  };
  return {
    createElement: (tag: string) => make(tag) as unknown as SearchElement,
    createTextNode: (text: string) => make("#text", text) as unknown as SearchNode,
  };
}

function fakeResults() {
  const fake = {
    nodes: [] as SearchNode[],
    replaceChildren(...nodes: SearchNode[]) {
      fake.nodes = nodes;
    },
  };
  return fake;
}

/** Every node under `nodes`, itself included, in document order. */
function walkAll(nodes: readonly SearchNode[]): FakeNode[] {
  return nodes.flatMap((node) => {
    const fake = node as unknown as FakeNode;
    return [fake, ...walkAll(fake.children)];
  });
}

function textOf(node: FakeNode): string {
  return node.tag === "#text" ? node.text ?? "" : node.children.map(textOf).join("");
}

const findClass = (nodes: readonly FakeNode[], name: string): FakeNode | undefined =>
  nodes.find((node) => node.attrs.class === name);

const record = (url: string, excerpt: string, title?: string): SearchRecord => ({
  url,
  excerpt,
  ...(title === undefined ? {} : { meta: { title } }),
});

test("an excerpt keeps Pagefind's highlights as plain marks and decodes its entities", () => {
  const results = fakeResults();
  renderOptions(results as unknown as SearchResults, optionList([record("/a/", 'Tom & Jerry &lt;script&gt; <mark class="hit">cache</mark>')], []), {
    doc: fakeDocument(),
    run: () => {},
  });
  const nodes = walkAll(results.nodes);

  assert.equal(textOf(findClass(nodes, "search-result-excerpt")!), "Tom & Jerry <script> cache");
  const marks = nodes.filter((node) => node.tag === "mark");
  assert.deepEqual(marks.map(textOf), ["cache"]);
  assert.deepEqual(marks[0]!.attrs, {}, "a mark carries no attributes from the index");
});

test("a title or excerpt cannot inject an element: everything is a text node", () => {
  const results = fakeResults();
  renderOptions(
    results as unknown as SearchResults,
    optionList([record("/a/", '<img src=x onerror="alert(1)">Clear the <mark onmouseover="alert(1)">cache</mark>.', "<script>alert(1)</script>")], []),
    { doc: fakeDocument(), run: () => {} },
  );
  const nodes = walkAll(results.nodes);

  assert.equal(textOf(findClass(nodes, "search-result-title")!), "<script>alert(1)</script>");
  assert.equal(textOf(findClass(nodes, "search-result-excerpt")!), '<img src=x onerror="alert(1)">Clear the cache.');
  assert.ok(nodes.every((node) => node.tag !== "script" && node.tag !== "img"));
});

test("a result without a title shows its URL, and an unsafe URL loses its link but keeps its option", () => {
  const results = fakeResults();
  const drawn = renderOptions(
    results as unknown as SearchResults,
    optionList([record("/plain/", "text"), record("javascript:alert(1)", "text", "Unsafe")], []),
    { doc: fakeDocument(), run: () => {} },
  );
  const nodes = walkAll(results.nodes);

  assert.equal(textOf(findClass(nodes, "search-result-title")!), "/plain/");
  const options = nodes.filter((node) => node.attrs.role === "option");
  assert.equal(options[0]!.tag, "a");
  assert.equal(options[0]!.attrs.href, "/plain/");
  assert.equal(options[1]!.tag, "span", "an unsafe URL is never a link");
  assert.equal(options[1]!.attrs.href, undefined);
  assert.equal(drawn.length, 2);
});

test("every option carries the id, key, and selection the field's aria-activedescendant needs", () => {
  const results = fakeResults();
  const list = optionList([record("/a/", "one"), record("/b/", "two")], [{ id: "theme-dark", label: "Dark" }]);
  const drawn = renderOptions(results as unknown as SearchResults, list, { doc: fakeDocument(), run: () => {} });
  const nodes = walkAll(results.nodes);

  assert.deepEqual(drawn.map((row) => row.id), list.rows.map((row) => row.id));
  assert.deepEqual(drawn.map((row) => row.key), list.rows.map((row) => row.key));
  const options = nodes.filter((node) => node.attrs.role === "option");
  assert.deepEqual(options.map((node) => node.attrs.id), list.rows.map((row) => row.id));
  for (const option of options) {
    assert.equal(option.attrs["aria-selected"], "false");
    assert.equal(option.attrs.tabindex, "-1");
  }
  assert.deepEqual(options.map((node) => node.attrs["data-search-option"]), list.rows.map((row) => row.key));
  // The rows are shape, the groups are named by their headings, and a heading is never an option.
  assert.ok(nodes.filter((node) => node.tag === "li").every((node) => node.attrs.role === "presentation"));
  const groups = nodes.filter((node) => node.attrs.role === "group");
  assert.deepEqual(groups.map((node) => node.attrs["aria-labelledby"]), list.groups.map((group) => group.id));
  assert.ok(nodes.filter((node) => node.attrs.class === "search-group-title").every((node) => node.attrs.role === "presentation"));
});

test("a redraw keeps the keys the active option is re-resolved by, and drops a row that is gone", () => {
  const results = fakeResults();
  const doc = fakeDocument();
  const before = optionList([record("/a/", "one"), record("/b/", "two")], []);
  const first = renderOptions(results as unknown as SearchResults, before, { doc, run: () => {} });
  const key = first[1]!.key;

  // The same query redraws: the remembered key still names the same row.
  const again = renderOptions(results as unknown as SearchResults, optionList([record("/a/", "one"), record("/b/", "two")], []), { doc, run: () => {} });
  assert.equal(activeIndexOf(again, key), 1);
  assert.equal(again[1]!.id, first[1]!.id);

  // A narrower query drops the row: the key resolves to nothing rather than a dangling reference.
  const narrowed = renderOptions(results as unknown as SearchResults, optionList([record("/a/", "one")], []), { doc, run: () => {} });
  assert.equal(activeIndexOf(narrowed, key), -1);
});

test("an action's click runs its descriptor, and an action without one is still a reachable option", () => {
  const ran: PaletteRun[] = [];
  const results = fakeResults();
  const list = optionList([], [
    { id: "theme-dark", label: "Dark", hint: "Switch theme", run: { kind: "theme", choice: "dark" } },
    { id: "inert", label: "Inert" },
  ]);
  const drawn = renderOptions(results as unknown as SearchResults, list, { doc: fakeDocument(), run: (command) => ran.push(command) });
  const nodes = walkAll(results.nodes);

  const buttons = nodes.filter((node) => node.tag === "button");
  assert.deepEqual(buttons.map((node) => node.attrs["data-palette-action"]), ["theme-dark", "inert"]);
  assert.equal(textOf(findClass(nodes, "search-action-hint")!), "Switch theme");

  drawn[0]!.activate();
  assert.deepEqual(ran, [{ kind: "theme", choice: "dark" }]);
  assert.equal(buttons[0]!.clicks, 1);
  assert.equal(buttons[0]!.scrolls, 1, "activating brings the option into view");

  drawn[1]!.activate();
  assert.deepEqual(ran, [{ kind: "theme", choice: "dark" }], "an action with no descriptor does nothing");
});

test("the ask row hands its question to the panel, and stays inert without one", () => {
  const asked: string[] = [];
  const results = fakeResults();
  const ask = { question: "how does search work", label: "Ask about “how does search work”", hint: "Copy a prompt" };
  const drawn = renderOptions(results as unknown as SearchResults, optionList([], [], {}, ask), {
    doc: fakeDocument(),
    run: () => {},
    ask: (question) => asked.push(question),
  });
  drawn[0]!.activate();
  assert.deepEqual(asked, ["how does search work"]);

  const inert = renderOptions(results as unknown as SearchResults, optionList([], [], {}, ask), { doc: fakeDocument(), run: () => {} });
  const nodes = walkAll(results.nodes);
  assert.equal(inert[0]!.element, nodes.find((node) => node.tag === "li"), "without a handler the row itself is the option");
  inert[0]!.activate();
  assert.deepEqual(asked, ["how does search work"], "and pressing it asks nothing");
});

test("a pointer entering a row names its option by position", () => {
  const hovered: number[] = [];
  const results = fakeResults();
  renderOptions(results as unknown as SearchResults, optionList([record("/a/", "one"), record("/b/", "two")], []), {
    doc: fakeDocument(),
    run: () => {},
    hover: (index) => hovered.push(index),
  });
  const rows = walkAll(results.nodes).filter((node) => node.tag === "li");
  for (const listener of rows[1]!.listeners["pointerenter"] ?? []) listener();
  assert.deepEqual(hovered, [1]);
});