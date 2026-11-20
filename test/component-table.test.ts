import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import table, {
  DESCRIPTION_CLASS,
  REGION_ATTRIBUTE,
  TABLE_CLASS,
  WRAPPER_CLASS,
  rehype,
  type HastNode,
} from "../components/table/index.ts";
import {
  OVERFLOW_TOLERANCE,
  REGION_SELECTOR,
  createWatcher,
  enhance,
  isOverflowing,
  regionLabel,
  start,
  sync,
  type TableElement,
} from "../components/table/client.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const namesPath = join(root, "tokens/names.json");

test("default export is the table component and the region marker matches the island selector", () => {
  assert.equal(typeof table, "function");
  assert.equal(REGION_ATTRIBUTE, "data-table-scroll");
  assert.equal(REGION_SELECTOR, `[${REGION_ATTRIBUTE}]`);
});

/** A Markdown table as the rehype step sees it, with an optional caption. */
function tableTree(caption?: string): { tree: HastNode; table: HastNode } {
  const tableNode: HastNode = {
    type: "element",
    tagName: "table",
    properties: {},
    children: [
      {
        type: "element",
        tagName: "thead",
        children: [
          {
            type: "element",
            tagName: "tr",
            children: [
              {
                type: "element",
                tagName: "th",
                children: [{ type: "text", value: "Environment" }],
              },
              {
                type: "element",
                tagName: "th",
                children: [{ type: "text", value: "Target" }],
              },
              {
                type: "element",
                tagName: "th",
                children: [{ type: "text", value: "Hooks" }],
              },
            ],
          },
        ],
      },
      {
        type: "element",
        tagName: "tbody",
        children: [
          {
            type: "element",
            tagName: "tr",
            children: [
              {
                type: "element",
                tagName: "td",
                children: [
                  {
                    type: "element",
                    tagName: "code",
                    children: [{ type: "text", value: "staging" }],
                  },
                ],
              },
              {
                type: "element",
                tagName: "td",
                children: [{ type: "text", value: "s3://beacon-staging" }],
              },
              {
                type: "element",
                tagName: "td",
                children: [{ type: "text", value: "none" }],
              },
            ],
          },
        ],
      },
    ],
  };
  if (caption !== undefined) {
    tableNode.children?.unshift({
      type: "element",
      tagName: "caption",
      children: [{ type: "text", value: caption }],
    });
  }
  return { tree: { type: "root", children: [tableNode] }, table: tableNode };
}

/** Every text value in a hast subtree, in document order. */
function texts(node: HastNode): string[] {
  if (typeof node.value === "string") return [node.value];
  return (node.children ?? []).flatMap(texts);
}

/** A table with two header rows and headers that span rows and columns, as hast sees it. */
function semanticTableTree(): HastNode {
  const th = (scope: string, text: string, span: Record<string, unknown> = {}): HastNode => ({
    type: "element",
    tagName: "th",
    properties: { scope, ...span },
    children: [{ type: "text", value: text }],
  });
  const td = (text: string): HastNode => ({
    type: "element",
    tagName: "td",
    children: [{ type: "text", value: text }],
  });
  const row = (...cells: HastNode[]): HastNode => ({ type: "element", tagName: "tr", children: cells });

  return {
    type: "element",
    tagName: "table",
    properties: {},
    children: [
      {
        type: "element",
        tagName: "thead",
        children: [
          row(
            th("col", "Environment", { rowspan: 2 }),
            th("col", "Item", { rowspan: 2 }),
            th("colgroup", "Target", { colspan: 2 }),
            th("col", "Hooks", { rowspan: 2 }),
          ),
          row(th("col", "Bucket"), th("col", "Prefix")),
        ],
      },
      {
        type: "element",
        tagName: "tbody",
        children: [
          row(
            th("rowgroup", "Staging", { rowspan: 3 }),
            th("row", "primary"),
            td("s3://beacon-staging"),
            td("/app"),
            td("none"),
          ),
          row(th("row", "canary"), td("s3://beacon-canary"), td("/canary"), td("after")),
          row(th("row", "cold"), td("s3://beacon-cold"), td("/cold"), td("none")),
        ],
      },
    ],
  };
}

test("rehype wraps a bare table in a focusable scroll region without an unnamed landmark", () => {
  const { tree, table: tableNode } = tableTree();

  rehype()(tree);

  const wrapper = tree.children?.[0];
  assert.ok(wrapper);
  assert.equal(wrapper.type, "element");
  assert.equal(wrapper.tagName, "div");
  assert.deepEqual(wrapper.properties?.className, [WRAPPER_CLASS]);
  assert.equal(wrapper.properties?.dataTableScroll, true);
  assert.equal(wrapper.properties?.tabIndex, 0);
  assert.equal(wrapper.properties?.role, undefined, "a table without a caption adds no region");
  assert.equal(wrapper.properties?.ariaLabel, undefined, "the generic Table label is gone");
  assert.equal(wrapper.children?.[0], tableNode, "the table node itself is kept, cells untouched");
  assert.deepEqual(tableNode.properties?.className, [TABLE_CLASS]);
  assert.ok(texts(tree).includes("s3://beacon-staging"));
});

test("rehype uses a caption as the region's name without adding a second copy of the text", () => {
  const { tree } = tableTree("Deploy targets");

  rehype()(tree);

  const wrapper = tree.children?.[0];
  assert.equal(wrapper?.properties?.role, "region");
  assert.equal(wrapper?.properties?.ariaLabel, "Deploy targets");
  assert.equal(wrapper?.properties?.tabIndex, 0, "without the island the region stays focusable");
  assert.deepEqual(
    texts(tree).filter((text) => text === "Deploy targets"),
    ["Deploy targets"],
    "the caption is the only copy of the name",
  );
});

test("rehype leaves an empty caption unnamed rather than repeating a generic label", () => {
  const { tree } = tableTree("   ");
  rehype()(tree);
  assert.equal(tree.children?.[0]?.properties?.role, undefined);
  assert.equal(tree.children?.[0]?.properties?.ariaLabel, undefined);
});

test("rehype is idempotent when the table is already wrapped", () => {
  const { tree } = tableTree("Deploy targets");
  rehype()(tree);
  rehype()(tree);

  assert.equal(tree.children?.length, 1);
  assert.equal(tree.children?.[0]?.tagName, "div");
  assert.equal(tree.children?.[0]?.children?.[0]?.tagName, "table");
  assert.deepEqual(tree.children?.[0]?.children?.[0]?.properties?.className, [TABLE_CLASS]);
});

test("rehype keeps RTL direction and every cell when it wraps a right-to-left table", () => {
  const { tree } = tableTree("أهداف النشر");
  tree.properties = { dir: "rtl" };

  rehype()(tree);

  const wrapper = tree.children?.[0];
  assert.equal(tree.properties?.dir, "rtl", "the page direction is not changed");
  assert.equal(wrapper?.properties?.ariaLabel, "أهداف النشر");
  assert.ok(texts(tree).includes("staging"), "cell content survives the wrapper");
  assert.ok(texts(tree).includes("s3://beacon-staging"));
});

test("rehype keeps a multi-row thead, scopes, and spans when it wraps a table", () => {
  const tableNode = semanticTableTree();
  const children = structuredClone(tableNode.children);
  const tree: HastNode = { type: "root", children: [tableNode] };

  rehype()(tree);

  const wrapper = tree.children?.[0];
  assert.equal(wrapper?.tagName, "div");
  assert.equal(wrapper?.children?.[0], tableNode, "the table node itself is kept");
  assert.deepEqual(tableNode.children, children, "no header row, scope, or span is flattened or rewritten");

  const thead = tableNode.children?.[0];
  assert.equal(thead?.children?.length, 2, "both header rows remain");
  assert.deepEqual(thead?.children?.[0]?.children?.[2]?.properties, { scope: "colgroup", colspan: 2 });
  assert.deepEqual(thead?.children?.[1]?.children?.[0]?.properties, { scope: "col" });
});

test("rehype keeps body row and row-group headers with their scope", () => {
  const tableNode = semanticTableTree();
  const tree: HastNode = { type: "root", children: [tableNode] };

  rehype()(tree);

  const firstRow = tableNode.children?.[1]?.children?.[0];
  assert.equal(firstRow?.children?.[0]?.tagName, "th", "a body row group header stays a th");
  assert.deepEqual(firstRow?.children?.[0]?.properties, { scope: "rowgroup", rowspan: 3 });
  assert.deepEqual(firstRow?.children?.[1]?.properties, { scope: "row" });
  assert.ok(texts(tree).includes("canary"), "the row header content survives");
});

test("the component keeps multi-level header structure and scopes in its scroll region", () => {
  const children = [
    h(
      "thead",
      null,
      h(
        "tr",
        null,
        h("th", { scope: "col", rowspan: 2 }, "Environment"),
        h("th", { scope: "col", rowspan: 2 }, "Item"),
        h("th", { scope: "colgroup", colspan: 2 }, "Target"),
        h("th", { scope: "col", rowspan: 2 }, "Hooks"),
      ),
      h("tr", null, h("th", { scope: "col" }, "Bucket"), h("th", { scope: "col" }, "Prefix")),
    ),
    h(
      "tbody",
      null,
      h(
        "tr",
        null,
        h("th", { scope: "rowgroup", rowspan: 2 }, "Staging"),
        h("th", { scope: "row" }, "primary"),
        h("td", null, "s3://beacon-staging"),
        h("td", null, "/app"),
        h("td", null, "none"),
      ),
      h(
        "tr",
        null,
        h("th", { scope: "row" }, "canary"),
        h("td", null, "s3://beacon-canary"),
        h("td", null, "/canary"),
        h("td", null, "after"),
      ),
    ),
  ];

  const html = renderToString(table({ caption: "Deploy targets", children }) as never);

  assert.match(html, /<thead><tr><th scope="col" rowspan="2">Environment<\/th>/);
  assert.match(html, /<th scope="colgroup" colspan="2">Target<\/th>/);
  assert.match(html, /<th scope="rowgroup" rowspan="2">Staging<\/th><th scope="row">primary<\/th>/);
  assert.match(html, /<th scope="row">canary<\/th>/);
});

test("the component names the region from an author label and omits it without one", () => {
  const labelled = table({ label: "Deploy targets", children: [] }) as unknown as {
    props: Record<string, unknown>;
  };
  assert.equal(labelled.props.role, "region");
  assert.equal(labelled.props["aria-label"], "Deploy targets");
  assert.equal(labelled.props["data-label"], "Deploy targets");
  assert.equal(labelled.props.tabIndex, 0);
  assert.equal(labelled.props[REGION_ATTRIBUTE], true);

  const plain = table({ children: [] }) as unknown as { props: Record<string, unknown> };
  assert.equal(plain.props.role, undefined);
  assert.equal(plain.props["aria-label"], undefined);
  assert.equal(plain.props.tabIndex, 0, "the fallback stays keyboard-scrollable");
});

test("a caption is the table's first child and names the region when no label is given", () => {
  const html = renderToString(
    table({ caption: "Deploy targets", children: [] }) as never,
  );
  assert.match(html, /<table class="table"><caption>Deploy targets<\/caption><\/table>/);
  assert.match(html, /role="region"/);
  assert.match(html, /aria-label="Deploy targets"/);

  const labelled = renderToString(
    table({ caption: "Deploy targets", label: "Author label", children: [] }) as never,
  );
  assert.match(labelled, /aria-label="Author label"/);
  assert.match(labelled, /<caption>Deploy targets<\/caption>/);
});

test("a description follows the table, gets a stable id, and describes the scroll region", () => {
  const page = {};
  const html = renderToString(
    table({ caption: "Deploy targets", description: "The targets a deployment writes.", page, children: [] }) as never,
  );
  assert.match(html, /aria-describedby="table-description"/);
  assert.match(html, new RegExp(`<p class="${DESCRIPTION_CLASS}" id="table-description">The targets a deployment writes\\.</p>`));
  assert.ok(html.indexOf("</div>") < html.indexOf(`<p class="${DESCRIPTION_CLASS}"`), "the description sits outside the scroll region");
});

test("empty caption and description emit no empty elements", () => {
  const plain = table({ caption: "   ", description: "", children: [] }) as never;
  const html = renderToString(plain);
  assert.doesNotMatch(html, /<caption>/);
  assert.doesNotMatch(html, new RegExp(DESCRIPTION_CLASS));
  assert.doesNotMatch(html, /aria-describedby/);
  assert.doesNotMatch(html, /role="region"/);
});

test("two tables with the same caption on one page get different description ids", () => {
  const page = {};
  const first = renderToString(table({ caption: "Deploy targets", description: "First.", page, children: [] }) as never);
  const second = renderToString(table({ caption: "Deploy targets", description: "Second.", page, children: [] }) as never);
  assert.match(first, /id="table-description"/);
  assert.match(second, /id="table-2-description"/);
});

/** A scroll region as the island reads it: attributes, measured widths, and a caption. */
interface FakeRegion extends TableElement {
  readonly attributes: Map<string, string>;
}

/** A node that only satisfies the element shape for queries the island never reads from it. */
const BLANK: TableElement = {
  scrollWidth: 0,
  clientWidth: 0,
  textContent: "",
  getAttribute: () => null,
  setAttribute: () => {},
  removeAttribute: () => {},
  querySelector: () => null,
};

function fakeRegion(scrollWidth: number, clientWidth: number, caption = "", authorLabel?: string): FakeRegion {
  const attributes = new Map<string, string>();
  if (authorLabel !== undefined) attributes.set("data-label", authorLabel);
  const captionNode: TableElement = { ...BLANK, textContent: caption };
  const tableNode: TableElement = { ...BLANK };
  return {
    scrollWidth,
    clientWidth,
    textContent: "",
    attributes,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => {
      attributes.set(name, value);
    },
    removeAttribute: (name) => {
      attributes.delete(name);
    },
    querySelector: (selector) => {
      if (selector === "caption") return caption === "" ? null : captionNode;
      if (selector === "table") return tableNode;
      return null;
    },
  };
}

/** The markup the server sends before the island runs: a tab stop, plus a region when captioned. */
function fallback(region: FakeRegion, label?: string): void {
  region.setAttribute("tabindex", "0");
  if (label !== undefined) {
    region.setAttribute("role", "region");
    region.setAttribute("aria-label", label);
  }
}

test("overflow is measured in CSS pixels with a one-pixel rounding tolerance", () => {
  assert.equal(OVERFLOW_TOLERANCE, 1);
  assert.equal(isOverflowing(fakeRegion(100, 100)), false);
  assert.equal(isOverflowing(fakeRegion(101, 100)), false, "a subpixel or rounding difference is not overflow");
  assert.equal(isOverflowing(fakeRegion(102, 100)), true);
  assert.equal(isOverflowing(fakeRegion(80, 100)), false);
});

test("a table that fits loses the fallback tab stop and region", () => {
  const region = fakeRegion(100, 100, "Deploy targets");
  fallback(region, "Deploy targets");

  assert.equal(sync(region), false);
  assert.equal(region.attributes.has("tabindex"), false);
  assert.equal(region.attributes.has("role"), false);
  assert.equal(region.attributes.has("aria-label"), false);
});

test("an overflowing table regains the tab stop and a caption-named region", () => {
  const region = fakeRegion(640, 320, "Deploy targets");

  assert.equal(sync(region), true);
  assert.equal(region.attributes.get("tabindex"), "0");
  assert.equal(region.attributes.get("role"), "region");
  assert.equal(region.attributes.get("aria-label"), "Deploy targets");
});

test("an overflowing table without a caption stays keyboard-scrollable but is not a landmark", () => {
  const region = fakeRegion(640, 320);

  assert.equal(sync(region), true);
  assert.equal(region.attributes.get("tabindex"), "0");
  assert.equal(region.attributes.has("role"), false);
  assert.equal(region.attributes.has("aria-label"), false);
});

test("an author label names the region and beats a caption", () => {
  const region = fakeRegion(640, 320, "Visible caption", "Author label");
  assert.equal(regionLabel(region), "Author label");
  sync(region);
  assert.equal(region.attributes.get("aria-label"), "Author label");
});

/** A fake observer that records the targets it observes and whether it was disconnected. */
class FakeObserver {
  readonly callback: () => void;
  readonly targets: TableElement[] = [];
  disconnected = 0;

  constructor(callback: () => void) {
    this.callback = callback;
  }

  observe(target: TableElement): void {
    this.targets.push(target);
  }

  disconnect(): void {
    this.disconnected += 1;
  }

  fire(): void {
    this.callback();
  }
}

/** A fake `ResizeObserver` constructor plus every instance it created, in order. */
function observing(): { Observer: new (callback: () => void) => FakeObserver; created: FakeObserver[] } {
  const created: FakeObserver[] = [];
  const Observer = class extends FakeObserver {
    constructor(callback: () => void) {
      super(callback);
      created.push(this);
    }
  };
  return { Observer, created };
}

/** A fake window that records the resize listeners registered on it. */
function fakeWindow(): {
  listeners: Set<() => void>;
  addEventListener: (type: "resize", listener: () => void) => void;
  removeEventListener: (type: "resize", listener: () => void) => void;
} {
  const listeners = new Set<() => void>();
  return {
    listeners,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
}

test("every table on the page shares one observer and re-syncs after a region or table resize", () => {
  const wide = fakeRegion(640, 320, "Wide");
  const narrow = fakeRegion(320, 320, "Narrow");
  const { Observer, created } = observing();

  const stop = enhance({ regions: () => [wide, narrow], watcher: createWatcher(Observer, fakeWindow()) });

  assert.equal(created.length, 1, "the whole page uses one observer");
  const observer = created[0]!;
  assert.equal(observer.targets.length, 4, "both regions and both tables are observed");
  assert.equal(wide.attributes.get("tabindex"), "0");
  assert.equal(narrow.attributes.has("tabindex"), false, "the fitting table keeps no tab stop");

  narrow.scrollWidth = 700;
  observer.fire();
  assert.equal(narrow.attributes.get("tabindex"), "0", "growing past the region adds the tab stop");
  assert.equal(narrow.attributes.get("aria-label"), "Narrow");

  wide.scrollWidth = 320;
  observer.fire();
  assert.equal(wide.attributes.has("tabindex"), false, "shrinking back removes it again");
  assert.equal(wide.attributes.has("role"), false);

  stop();
});

test("cleanup disconnects the shared observer once and keeps the current overflow state", () => {
  const wide = fakeRegion(640, 320, "Wide");
  const { Observer, created } = observing();
  const stop = enhance({ regions: () => [wide], watcher: createWatcher(Observer, fakeWindow()) });
  const observer = created[0]!;
  assert.equal(observer.disconnected, 0);

  stop();

  assert.equal(observer.disconnected, 1);
  assert.equal(wide.attributes.get("tabindex"), "0");
  assert.equal(wide.attributes.get("role"), "region");
  assert.equal(wide.attributes.get("aria-label"), "Wide");

  observer.fire();
  assert.equal(wide.attributes.get("tabindex"), "0", "a late callback no longer touches the page");
  assert.equal(wide.attributes.get("aria-label"), "Wide");
});

test("the resize fallback adds one window listener for any number of tables and cleanup removes it", () => {
  const win = fakeWindow();
  const one = fakeRegion(640, 320, "One");
  const two = fakeRegion(320, 320, "Two");

  const stop = enhance({ regions: () => [one, two], watcher: createWatcher(undefined, win) });

  assert.equal(win.listeners.size, 1, "one listener total, not one per region or table");

  two.scrollWidth = 700;
  for (const listener of win.listeners) listener();
  assert.equal(two.attributes.get("tabindex"), "0");
  assert.equal(two.attributes.get("aria-label"), "Two");

  stop();
  assert.equal(win.listeners.size, 0);
});

test("repeated setup through one watcher does not duplicate the observer or the listener", () => {
  const win = fakeWindow();
  const shared = createWatcher(undefined, win);
  const region = fakeRegion(640, 320, "One");

  const first = enhance({ regions: () => [region], watcher: shared });
  const second = enhance({ regions: () => [region], watcher: shared });

  assert.equal(win.listeners.size, 1);
  first();
  second();
  assert.equal(win.listeners.size, 0);
});

test("the island starts from the document and observer globals and can be stopped", () => {
  const region = fakeRegion(640, 320, "Deploy targets");
  const { Observer, created } = observing();
  const win = fakeWindow();

  const stop = start({
    document: { querySelectorAll: () => [region] },
    ResizeObserver: Observer,
    addEventListener: win.addEventListener,
    removeEventListener: win.removeEventListener,
  });
  assert.equal(created.length, 1);
  assert.equal(region.attributes.get("aria-label"), "Deploy targets");

  stop();
  assert.equal(created[0]!.disconnected, 1);
});

test("the island does nothing without a document and keeps the no-JS markup as it is", () => {
  const stop = start({});
  assert.equal(typeof stop, "function");
  assert.doesNotThrow(() => stop());
});

