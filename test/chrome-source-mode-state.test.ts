// The visible state of Source mode: the active bar, its block count, and the Exit control. Each has
// its own test here, beside the switch's and the labels' tests, so a reader-visible change cannot
// land without one.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  activate,
  type ModeRoot,
  type SourceBlock,
  type SourceEnv,
  type SwitchPart,
  type SwitchRoot,
} from "../chrome/source-mode/client.ts";

const MESSAGES: Record<string, string> = {
  "mode-count": "{n} blocks with a source position.",
  "mode-empty": "This page has no blocks with a source position.",
};

interface FakePart extends SwitchPart {
  hidden?: boolean;
  readonly attrs: Record<string, string>;
  listener?: (() => void) | undefined;
  click(): void;
}

function part(): FakePart {
  const self: FakePart = {
    textContent: "",
    hidden: false,
    attrs: {},
    listener: undefined,
    setAttribute(name, value) {
      self.attrs[name] = value;
    },
    addEventListener(_type, listener) {
      self.listener = listener;
    },
    click() {
      self.listener?.();
    },
  };
  return self;
}

interface Options {
  readonly stored?: string;
  readonly html?: string;
  /** The disclosure opener the island calls when the mode comes on. */
  readonly reveal?: () => void;
}

function setup(options: Options = {}) {
  const { stored, html = "", reveal } = options;
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  const document = dom.window.document;
  const button = part();
  const status = part();
  const active = part();
  const count = part();
  const exit = part();
  active.hidden = true;
  const root: SwitchRoot = {
    hidden: true,
    getAttribute: (name) => (name === "data-on-message" ? "on!" : name === "data-off-message" ? "off!" : null),
    querySelector: (selector) =>
      ({
        ".source-mode-button": button,
        ".source-mode-status": status,
        ".source-mode-active": active,
        ".source-mode-count": count,
        ".source-exit-button": exit,
      })[selector] ?? null,
  };
  const classes = new Set<string>();
  const modeRoot: ModeRoot = {
    classList: {
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name),
    },
  };
  const store = new Map<string, string>(stored === undefined ? [] : [["lateen-source-mode", stored]]);
  const env: SourceEnv = {
    root: modeRoot,
    blocks: [...document.querySelectorAll("[data-src]")] as unknown as SourceBlock[],
    storage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => void store.set(key, value) },
    createLabel: (tag = "span") => document.createElement(tag) as never,
    revealSwitch: reveal,
    actions: {
      storage: undefined,
      messages: (name) => MESSAGES[name] ?? "",
      createElement: (tag) => document.createElement(tag) as never,
      copy: async () => true,
      announce: () => {},
    },
  };
  activate(root, env);
  return { root, button, status, active, count, exit, classes, store, document };
}

const ONE_BLOCK = `<p data-src="a.md:1:1-1:5">one</p>`;
const TWO_BLOCKS = `<p data-src="a.md:1:1-1:5">one</p><p data-src="a.md:3:1-3:5">two</p>`;

test("the active bar stays hidden and empty until the mode is on", () => {
  const s = setup({ html: TWO_BLOCKS });
  assert.equal(s.active.hidden, true, "the bar is out of the layout while off");
  assert.equal(s.count.textContent, "");
  assert.equal(s.button.attrs["aria-pressed"], "false");

  s.button.click();
  assert.equal(s.active.hidden, false, "the bar is revealed with the mode");
  assert.equal(s.count.textContent, "2 blocks with a source position.");
});

test("source labels show stable block ids alongside the source position", () => {
  const s = setup({ html: `<p data-src="a.md:8:1-8:5" data-block="stable-sample">sample</p>` });
  s.button.click();
  const identity = s.document.querySelector(".source-label [data-source-block-id]");
  assert.equal(identity?.textContent, "stable-sample");
  assert.equal(identity?.getAttribute("dir"), "ltr");
  assert.equal(s.document.querySelector(".source-label-copy")?.textContent, "a.md:8");
});

test("a page with no sourced blocks says so instead of showing a bare zero", () => {
  const s = setup({ html: `<p>no source here</p>` });
  s.button.click();
  assert.equal(s.active.hidden, false);
  assert.equal(s.count.textContent, "This page has no blocks with a source position.");
});

test("the Exit control turns the mode off and hides the bar", () => {
  const s = setup({ html: ONE_BLOCK });
  s.button.click();
  assert.equal(s.active.hidden, false);
  s.exit.click();
  assert.equal(s.classes.has("source-mode"), false);
  assert.equal(s.active.hidden, true);
  assert.equal(s.button.attrs["aria-pressed"], "false");
  assert.equal(s.status.textContent, "off!");
});

test("the switch toggles the mode and announces it", () => {
  const s = setup({ html: ONE_BLOCK });
  s.button.click();
  assert.equal(s.classes.has("source-mode"), true);
  assert.equal(s.status.textContent, "on!");
  s.button.click();
  assert.equal(s.classes.has("source-mode"), false);
});

test("turning the mode on opens the disclosure that holds the switch", () => {
  // The doc layout keeps the switch in a closed "Page tools"; the palette must not leave it hidden.
  let revealed = 0;
  const s = setup({ stored: "on", html: ONE_BLOCK, reveal: () => void (revealed += 1) });
  assert.equal(revealed, 0, "loading the page never opens the disclosure, even with an old stored choice");
  s.button.click();
  assert.equal(revealed, 1, "turning the mode on reveals the switch");
  s.exit.click();
  assert.equal(revealed, 1, "turning the mode off does not reopen a disclosure the reader closed");
  s.button.click();
  assert.equal(revealed, 2, "turning it back on reveals the switch again");
});

test("a page without a switch is left alone", () => {
  const root: SwitchRoot = { hidden: true, getAttribute: () => null, querySelector: () => null };
  activate(root, {
    root: { classList: { toggle() {}, contains: () => false } },
    blocks: [],
    storage: undefined,
    createLabel: () => ({ textContent: "", setAttribute() {} }),
  });
  assert.equal(root.hidden, true);
});
