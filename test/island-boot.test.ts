import assert from "node:assert/strict";
import { test } from "node:test";
import { bootOnce } from "../src/boot.ts";
import { wireDocument } from "../components/before-after/copy.ts";

/** Replaces a browser global for one test and hands back the restore. */
function stub(name: "document" | "navigator", value: unknown): () => void {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  return () => {
    if (original === undefined) delete (globalThis as Record<string, unknown>)[name];
    else Object.defineProperty(globalThis, name, original);
  };
}

test("bootOnce claims one island once per page", () => {
  const page = {};
  assert.equal(bootOnce("test/island-boot", page), true);
  assert.equal(bootOnce("test/island-boot", page), false);
  assert.equal(bootOnce("test/island-boot-other", page), true);
  assert.equal(bootOnce("test/island-boot", {}), true);
});

test("a second copy-button boot on the same page wires nothing twice", (t) => {
  const clicks: string[] = [];
  const button = {
    hidden: true,
    textContent: "",
    dataset: {},
    addEventListener(type: string) {
      clicks.push(type);
    },
  };
  const otherClicks: string[] = [];
  const otherButton = { ...button, dataset: {}, addEventListener: (type: string) => otherClicks.push(type) };
  const page = { querySelectorAll: () => [button] };
  const otherPage = { querySelectorAll: () => [otherButton] };

  let restoreDocument = stub("document", page);
  const restoreNavigator = stub("navigator", { clipboard: { writeText: () => Promise.resolve() } });
  t.after(() => {
    restoreDocument();
    restoreNavigator();
  });

  wireDocument("[data-boot-copy]");
  wireDocument("[data-boot-copy]");
  assert.deepEqual(clicks, ["click"]);
  assert.equal(button.hidden, false);

  // A new page is a new boot, even with the island already claimed elsewhere.
  restoreDocument();
  restoreDocument = stub("document", otherPage);
  wireDocument("[data-boot-copy]");
  assert.deepEqual(otherClicks, ["click"]);
});

/** Imports one entry point as a fresh module, the way a second copy of the bundle would arrive. */
async function importEntry(path: string, tag: string): Promise<void> {
  const url = new URL(path, import.meta.url);
  url.search = tag;
  await import(url.href);
}

test("a second evaluation of the gallery filters island activates once", async (t) => {
  const querySelectorAll: string[] = [];
  const page = {
    querySelectorAll(selector: string) {
      querySelectorAll.push(selector);
      return [];
    },
  };
  t.after(stub("document", page));
  await importEntry("../components/gallery-filters/client.ts", "boot-1");
  await importEntry("../components/gallery-filters/client.ts", "boot-2");
  assert.equal(querySelectorAll.length, 1);
});

test("a second evaluation of the record history island activates once", async (t) => {
  const querySelectorAll: string[] = [];
  const page = {
    querySelectorAll(selector: string) {
      querySelectorAll.push(selector);
      return [];
    },
  };
  t.after(stub("document", page));
  await importEntry("../components/record-history/client.ts", "boot-1");
  await importEntry("../components/record-history/client.ts", "boot-2");
  assert.equal(querySelectorAll.length, 1);
});
