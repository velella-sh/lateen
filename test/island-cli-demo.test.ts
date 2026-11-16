import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import cliDemo from "../components/cli-demo/index.ts";
import { activate, activateAll, copy, RESET_MS, type Button, type Env, type Root } from "../components/cli-demo/client.ts";

class FakeButton implements Button {
  hidden = true;
  textContent: string | null;
  dataset: { text?: string };
  clicks: (() => void)[] = [];
  constructor(label: string, text?: string) {
    this.textContent = label;
    this.dataset = text === undefined ? {} : { text };
  }
  addEventListener(_type: "click", listener: () => void): void {
    this.clicks.push(listener);
  }
  click(): void {
    for (const c of this.clicks) c();
  }
}

function fixture() {
  const buttons = {
    "[data-cli-demo-copy-commands]": new FakeButton("Copy commands", "npm ci"),
    "[data-cli-demo-copy-all]": new FakeButton("Copy all", "$ npm ci\nadded"),
  } as Record<string, FakeButton>;
  const bar = { hidden: true, textContent: "" as string | null };
  const status = { textContent: "" as string | null };
  const root = {
    dataset: { copied: "Copied", copyFailed: "Press Ctrl+C" },
    querySelector: (sel: string) =>
      (sel === ".cli-demo-bar" ? bar : sel === "[data-cli-demo-status]" ? status : (buttons[sel] ?? null)) as never,
    querySelectorAll: () => [],
  } as Root;
  const timers: (() => void)[] = [];
  const written: string[] = [];
  const env = (clipboard: Env["clipboard"]): Env => ({
    clipboard,
    schedule: (cb) => timers.push(cb),
    cancel: () => {},
    reducedMotion: false,
  });
  return { buttons, bar, status, root, timers, written, env };
}

const ok = (written: string[]) => ({ writeText: (t: string) => (written.push(t), Promise.resolve()) });

test("both copy modes: commands without prompt or output, all as written", async () => {
  const f = fixture();
  activate(f.root, f.env(ok(f.written)));
  assert.equal(f.bar.hidden, false);
  f.buttons["[data-cli-demo-copy-commands]"]!.click();
  f.buttons["[data-cli-demo-copy-all]"]!.click();
  await Promise.resolve();
  assert.deepEqual(f.written, ["npm ci", "$ npm ci\nadded"]);
  assert.ok(!f.written[0]!.includes("$"));
});

test("a copy reports the result on the button and the status line, then resets", async () => {
  const f = fixture();
  const button = f.buttons["[data-cli-demo-copy-all]"]!;
  await copy(button, "x", f.root, f.env(ok(f.written)));
  assert.equal(button.textContent, "Copied");
  assert.equal(f.status.textContent, "Copied");
  assert.equal(f.timers.length, 1);
  f.timers[0]!();
  assert.equal(button.textContent, "Copy all");
  assert.equal(f.status.textContent, "");
  assert.equal(RESET_MS, 2000);
});

test("a clipboard that rejects says so instead of failing", async () => {
  const f = fixture();
  const button = f.buttons["[data-cli-demo-copy-commands]"]!;
  await copy(button, "x", f.root, f.env({ writeText: () => Promise.reject(new Error("denied")) }));
  assert.equal(button.textContent, "Press Ctrl+C");
});

test("a blocked clipboard (none) leaves every button and the bar hidden", () => {
  const f = fixture();
  activate(f.root, f.env(undefined));
  assert.equal(f.bar.hidden, true);
  for (const b of Object.values(f.buttons)) assert.equal(b.hidden, true);
});

test("a writeText that throws synchronously is not fatal to activation", () => {
  const f = fixture();
  assert.doesNotThrow(() => activateAll({ querySelectorAll: () => [f.root] }, f.env(ok(f.written))));
});

test("the no-script page: bar and buttons hidden, text plain, prompt and labels unselectable", () => {
  const input = { props: {}, html: "<p>$ npm ci\nadded</p>", page: { lang: "en", source: { file: "a.md", line: 1 } }, site: {} } as unknown as ComponentProps;
  const dom = new JSDOM(`<body>${renderToString(cliDemo(input as never) as never)}</body>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector(".cli-demo-bar")?.hasAttribute("hidden"), true);
  for (const b of doc.querySelectorAll("button")) assert.equal(b.hasAttribute("hidden"), true);
  assert.equal(doc.querySelector(".cli-demo-body code")?.textContent, "$ npm cioutputadded");
  const css = readFileSync(new URL("../components/cli-demo/style.css", import.meta.url), "utf8");
  for (const sel of [".cli-demo-prompt", ".cli-demo-label"]) {
    const block = new RegExp(`${sel.replace(".", "\\.")}\\s*\\{[^}]*user-select:\\s*none`).test(css);
    assert.ok(block, `${sel} is unselectable`);
  }
});

test("on a rendered page the island wires the real buttons", async () => {
  const input = { props: {}, html: "<p>$ npm ci\nadded</p>", page: { lang: "en", source: { file: "a.md", line: 1 } }, site: {} } as unknown as ComponentProps;
  const dom = new JSDOM(`<body>${renderToString(cliDemo(input as never) as never)}</body>`);
  const written: string[] = [];
  activateAll(dom.window.document as never, {
    clipboard: ok(written),
    schedule: () => 0,
    cancel: () => {},
    reducedMotion: false,
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelector(".cli-demo-bar")?.hasAttribute("hidden"), false);
  (doc.querySelector("[data-cli-demo-copy-commands]") as HTMLElement).click();
  (doc.querySelector("[data-cli-demo-copy-all]") as HTMLElement).click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(written, ["npm ci", "$ npm ci\nadded"]);
});
