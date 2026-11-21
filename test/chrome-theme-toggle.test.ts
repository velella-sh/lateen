import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Fragment } from "preact";
import themeToggle from "../chrome/theme-toggle/index.ts";
import {
  activate,
  announce,
  apply,
  choose,
  next,
  read,
  save,
  sync,
  type ThemeEnv,
  type ThemeEvents,
  type ThemeStorage,
  type ThemeStorageEvent,
  type ThemeToggleRoot,
} from "../chrome/theme-toggle/client.ts";
import { THEME_KEY } from "../layouts/base.ts";

/** The switch reads no props; the engine passes ChromeProps anyway. */
const noopProps = {} as never;
const render = () => html(themeToggle(noopProps));

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

const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);

/** An in-memory store over `THEME_KEY` that records what was written. */
function store(saved?: string): ThemeStorage & { written: string | undefined } {
  const fake = {
    written: undefined as string | undefined,
    getItem: (key: string) => (key === THEME_KEY && saved !== undefined ? saved : null),
    setItem: (key: string, value: string) => {
      if (key === THEME_KEY) fake.written = value;
    },
  };
  return fake;
}

/** A store whose every access throws, as private browsing can. */
function brokenStore(): ThemeStorage {
  return {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
}

/** A switch root with a button, a status region, and the click listeners that were wired. */
function fakeToggle(): ThemeToggleRoot & {
  attrs: Record<string, string>;
  button: { attrs: Record<string, string>; textContent: string | null; setAttribute(n: string, v: string): void };
  clicks: Array<(event: { target?: unknown }) => void>;
  status: { textContent: string | null; setAttribute(n: string, v: string): void };
} {
  const element = () => {
    const el = {
      attrs: {} as Record<string, string>,
      textContent: "" as string | null,
      setAttribute(name: string, value: string) {
        el.attrs[name] = value;
      },
    };
    return el;
  };
  const fake = {
    hidden: true,
    attrs: {} as Record<string, string>,
    button: element(),
    status: element(),
    clicks: [] as Array<(event: { target?: unknown }) => void>,
    setAttribute(name: string, value: string) {
      fake.attrs[name] = value;
    },
    querySelector(selector: string) {
      if (selector === ".theme-toggle-button") return fake.button;
      if (selector === ".theme-toggle-status") return fake.status;
      return null;
    },
    addEventListener(type: string, listener: (event: { target?: unknown }) => void) {
      assert.equal(type, "click");
      fake.clicks.push(listener);
    },
  };
  return fake;
}

/** An environment with a plain store and a `<html>` that records its attributes. */
function env<S extends ThemeStorage>(
  storage: S,
  events?: ThemeEvents,
): ThemeEnv & { attrs: Record<string, string>; storage: S } {
  const attrs: Record<string, string> = {};
  return {
    attrs,
    storage,
    ...(events === undefined ? {} : { events }),
    root: {
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
    },
  };
}

/** A window whose cross-tab storage event a test can fire. */
function events(): ThemeEvents & {
  listeners: Set<(event: ThemeStorageEvent) => void>;
  fire(event: ThemeStorageEvent): void;
} {
  const listeners = new Set<(event: ThemeStorageEvent) => void>();
  return {
    listeners,
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    fire(event: ThemeStorageEvent) {
      for (const listener of listeners) listener(event);
    },
  };
}

test("renders a hidden switch with data-theme-toggle, one named button, and a status region", () => {
  const out = render();

  assert.match(out, /^<span class="theme-toggle" data-theme-toggle hidden>/);
  assert.match(out, /<button class="iconbtn theme-toggle-button" type="button" aria-label="Color theme">/);
  assert.match(out, /<span class="theme-toggle-status" role="status"><\/span>/);
  assert.doesNotMatch(out, /<input|<fieldset|checked/);
});

test("draws a sun and a moon", () => {
  const out = render();

  const kinds = [...out.matchAll(/theme-toggle-icon theme-toggle-icon-([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(kinds, ["light", "dark"]);
});

test("read: explicit choices are kept and missing, legacy, or invalid values default to dark", () => {
  assert.equal(read(store("light")), "light");
  assert.equal(read(store("dark")), "dark");
  assert.equal(read(store("system")), "dark");
  assert.equal(read(store("banana")), "dark");
  assert.equal(read(store()), "dark");
  assert.equal(read(brokenStore()), "dark");
});

test("save: writes under the key the theme script reads, and survives a broken store", () => {
  const fake = store();
  save(fake, "dark");
  assert.equal(fake.written, "dark");

  assert.doesNotThrow(() => save(brokenStore(), "light"));
});

test("apply: sets data-theme on the root", () => {
  const page = env(store());
  apply(page, "light");
  assert.equal(page.attrs["data-theme"], "light");
});

test("next: alternates between light and dark", () => {
  assert.equal(next("light"), "dark");
  assert.equal(next("dark"), "light");
});

test("sync: reveals the switch, marks the choice, and labels the button with it and the next one", () => {
  const toggle = fakeToggle();
  sync(toggle, "dark");
  assert.equal(toggle.hidden, false);
  assert.equal(toggle.attrs["data-choice"], "dark");
  assert.equal(toggle.button.attrs["aria-label"], "Color theme: Dark. Switch to light.");
});

test("announce: names the choice on the status region", () => {
  for (const choice of ["light", "dark"] as const) {
    const toggle = fakeToggle();
    announce(toggle, choice);
    assert.equal(toggle.status.textContent, `${choice[0]!.toUpperCase()}${choice.slice(1)} theme.`);
  }
});

test("activate: reveals, shows and applies the saved choice, and listens for clicks", () => {
  const toggle = fakeToggle();
  const page = env(store("light"));
  activate(toggle, page);

  assert.equal(toggle.hidden, false);
  assert.equal(toggle.attrs["data-choice"], "light");
  assert.equal(page.attrs["data-theme"], "light");
  assert.equal(toggle.clicks.length, 1);
});

test("activate with nothing stored: dark is the default choice", () => {
  const toggle = fakeToggle();
  const page = env(store());
  activate(toggle, page);

  assert.equal(toggle.attrs["data-choice"], "dark");
  assert.equal(page.attrs["data-theme"], "dark");
});

test("every click saves, applies, reflects, and announces the next choice", () => {
  const toggle = fakeToggle();
  const page = env(store("light"));
  activate(toggle, page);

  toggle.clicks[0]!({});
  assert.equal(page.storage.written, "dark");
  assert.equal(toggle.attrs["data-choice"], "dark");
  assert.equal(page.attrs["data-theme"], "dark");
  assert.equal(toggle.status.textContent, "Dark theme.");

  toggle.clicks[0]!({});
  assert.equal(page.storage.written, "light");
  assert.equal(toggle.attrs["data-choice"], "light");
  assert.equal(page.attrs["data-theme"], "light");
});

test("choose: the whole change works without an event, in order", () => {
  const toggle = fakeToggle();
  const page = env(store("system"));
  choose(page, toggle, "light");

  assert.equal(page.storage.written, "light");
  assert.equal(toggle.attrs["data-choice"], "light");
  assert.equal(page.attrs["data-theme"], "light");
  assert.equal(toggle.hidden, false);
  assert.equal(toggle.status.textContent, "Light theme.");
});

test("activate: the toggle adopts a valid choice made in another tab", () => {
  const other = events();
  const page = env(store("light"), other);
  const toggle = fakeToggle();
  activate(toggle, page);

  other.fire({ key: THEME_KEY, newValue: "dark" });
  assert.equal(page.attrs["data-theme"], "dark");
  assert.equal(toggle.attrs["data-choice"], "dark");
  assert.equal(toggle.button.attrs["aria-label"], "Color theme: Dark. Switch to light.");
  assert.equal(toggle.status.textContent, "Dark theme.");

});

test("activate: clearing storage or receiving a legacy system choice falls back to dark", () => {
  for (const value of [null, "system"]) {
    const other = events();
    const page = env(store("light"), other);
    const toggle = fakeToggle();
    activate(toggle, page);

    other.fire({ key: THEME_KEY, newValue: value });
    assert.equal(toggle.attrs["data-choice"], "dark");
    assert.equal(page.attrs["data-theme"], "dark");
  }
});

test("activate: invalid values and other keys in storage events change nothing", () => {
  const other = events();
  const page = env(store("light"), other);
  const toggle = fakeToggle();
  activate(toggle, page);

  other.fire({ key: THEME_KEY, newValue: "banana" });
  other.fire({ key: "another-key", newValue: "dark" });
  assert.equal(page.attrs["data-theme"], "light");
  assert.equal(toggle.attrs["data-choice"], "light");
});

test("activate: cleanup stops following other tabs", () => {
  const other = events();
  const page = env(store("dark"), other);
  const stop = activate(fakeToggle(), page);

  assert.equal(other.listeners.size, 1);
  stop();

  assert.equal(other.listeners.size, 0);
  other.fire({ key: THEME_KEY, newValue: "light" });
  assert.equal(page.attrs["data-theme"], "dark");
});

test("activate: a blocked store still lets the reader change the theme", () => {
  const page = env(brokenStore());
  const toggle = fakeToggle();
  activate(toggle, page);
  assert.equal(page.attrs["data-theme"], "dark");

  toggle.clicks[0]!({});
  assert.equal(page.attrs["data-theme"], "light");
  assert.equal(toggle.attrs["data-choice"], "light");
});

test("activate: a host without storage-event APIs stays usable", () => {
  const toggle = fakeToggle();
  const page = env(store("light"));
  assert.doesNotThrow(() => activate(toggle, page));
  assert.equal(page.attrs["data-theme"], "light");
  assert.equal(toggle.attrs["data-choice"], "light");
});

