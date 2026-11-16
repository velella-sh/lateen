import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { activate, readTicks, storageKey, type Env, type Root, type Store } from "../components/steps/client.ts";
import steps from "../components/steps/index.ts";
import { renderToString } from "preact-render-to-string";

const LIST = "<ol><li><p>One.</p></li><li><p>Two.</p></li><li><p>Three.</p></li></ol>";

function setup(store: Store | undefined | "throws", saved?: string) {
  const html = renderToString(steps({ html: LIST, page: { lang: "en" } } as never) as never);
  const dom = new JSDOM(`<body>${html}</body>`);
  const doc = dom.window.document;
  const root = doc.querySelector("[data-steps]") as unknown as Root;
  const data = new Map<string, string>(saved === undefined ? [] : [[storageKey("/g/"), saved]]);
  const real: Store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  const blocked: Store = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  const env: Env = {
    storage: () => (store === "throws" ? blocked : (store ?? real)),
    path: "/g/",
    create: (tag) => doc.createElement(tag) as never,
  };
  return { dom, doc, root, env, data };
}

const progress = (doc: Document): string => doc.querySelector(".steps-progress")?.textContent ?? "";
const boxes = (doc: Document): HTMLInputElement[] => [...doc.querySelectorAll<HTMLInputElement>(".step-tick input")];

test("ticking a step updates the progress text and is stored", () => {
  const { doc, root, env, data } = setup(undefined);
  activate(root, env);
  assert.equal(progress(doc), "0 of 3 steps done");
  const [first, , third] = boxes(doc);
  first!.click();
  third!.click();
  assert.equal(progress(doc), "2 of 3 steps done");
  assert.equal(data.get(storageKey("/g/")), "[1,3]");
  assert.ok(doc.querySelector('li[data-step="1"]')?.hasAttribute("data-done"));
  first!.click();
  assert.equal(progress(doc), "1 of 3 steps done");
});

test("a reload restores the ticks", () => {
  const { doc, root, env } = setup(undefined, "[2]");
  activate(root, env);
  assert.equal(progress(doc), "1 of 3 steps done");
  assert.deepEqual(boxes(doc).map((b) => b.checked), [false, true, false]);
});

test("a blocked or missing store changes nothing", () => {
  for (const store of ["throws", undefined] as const) {
    const { doc, root, env } = setup(store === undefined ? ({ getItem: () => null, setItem: () => {} } as Store) : store);
    activate(root, env);
    boxes(doc)[0]!.click();
    assert.equal(progress(doc), "1 of 3 steps done");
  }
  const { env } = setup("throws");
  assert.equal(readTicks(env).size, 0);
  assert.equal(readTicks(setup(undefined, "not json").env).size, 0);
});

test("the ticks are real checkboxes with a name per step: keyboard use is native", () => {
  const { doc, root, env } = setup(undefined);
  activate(root, env);
  const [first] = boxes(doc);
  assert.equal(first!.type, "checkbox");
  assert.equal(first!.getAttribute("aria-label"), "Mark step 1 as done");
  assert.equal(doc.querySelector(".steps-progress")?.getAttribute("role"), "status");
});
