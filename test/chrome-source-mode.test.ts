import assert from "node:assert/strict";
import { test } from "node:test";
import { h } from "preact";
import { render } from "preact-render-to-string";
import type { ChromeProps, Page } from "@velella/mizzen/contracts";
import sourceMode from "../chrome/source-mode/index.ts";
import {
  activate,
  type ModeRoot,
  type SourceEnv,
  type SwitchPart,
  type SwitchRoot,
} from "../chrome/source-mode/client.ts";
import { stringsOf } from "../i18n/index.ts";
import { paletteActions } from "../chrome/command-palette/actions.ts";
import { liveHandlers } from "../chrome/search/client.ts";

function renderFor(lang: string): string {
  const page = { lang, dir: lang === "en" ? "ltr" : "rtl" } as unknown as Page;
  const site = { config: { theme: {} } };
  return render(h("div", null, sourceMode({ site, page } as unknown as ChromeProps) as never));
}

test("the switch renders hidden, with a pressed state and a status region", () => {
  const out = renderFor("en");
  assert.match(out, /data-source-mode[^>]* hidden/);
  assert.match(out, /<button type="button" class="source-mode-button" aria-pressed="false"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>Source mode<\/button>/);
  assert.match(out, /<span class="source-mode-status" role="status"><\/span>/);
  assert.ok(out.includes(`data-on-message="${stringsOf("en").source_mode_on}"`));
});

test("the active bar renders hidden, with a count region and one Exit control", () => {
  const out = renderFor("en");
  assert.match(
    out,
    /<div class="source-mode-active" hidden><span class="source-mode-count" aria-live="polite"><\/span><button type="button" class="source-exit-button">[\s\S]*?Exit Source mode<\/button><\/div>/,
  );
});

test("the switch carries ready SVG for the label link actions, and never their words", () => {
  const page = { lang: "en", dir: "ltr" };
  const withRepo = render(h("div", null, sourceMode({ site: { config: { repository: { url: "https://github.com/acme/site" }, theme: {} } }, page } as unknown as ChromeProps) as never));
  assert.match(withRepo, /data-icon-open="&lt;svg/);
  const withEditor = render(
    h("div", null, sourceMode({ site: { config: { theme: { options: { sourceMode: { editor: "vscode://file/{path}:{line}" } } } } }, page } as unknown as ChromeProps) as never),
  );
  assert.match(withEditor, /data-icon-open="&lt;svg/);
  assert.match(withEditor, /source-folder-button/);
  // A site with neither has no icons and no folder control.
  const bare = renderFor("en");
  assert.doesNotMatch(bare, /data-icon-open=|source-folder-button/);
});

test("the switch is localized in Persian and Arabic", () => {
  for (const lang of ["fa", "ar"] as const) {
    assert.ok(renderFor(lang).includes(stringsOf(lang).source_mode_label ?? "missing"), lang);
    assert.notEqual(stringsOf(lang).source_mode_on, stringsOf("en").source_mode_on);
  }
});

function part(): SwitchPart & { attrs: Record<string, string>; click(): void } {
  const self = {
    textContent: "" as string | null,
    attrs: {} as Record<string, string>,
    listener: undefined as undefined | (() => void),
    setAttribute(name: string, value: string) {
      self.attrs[name] = value;
    },
    addEventListener(_type: "click", listener: () => void) {
      self.listener = listener;
    },
    click() {
      self.listener?.();
    },
  };
  return self;
}

function setup(stored?: string, throwing = false) {
  const button = part();
  const status = part();
  const root: SwitchRoot = {
    hidden: true,
    getAttribute: (name) => (name === "data-on-message" ? "on!" : name === "data-off-message" ? "off!" : null),
    querySelector: (selector) => (selector === ".source-mode-button" ? button : selector === ".source-mode-status" ? status : null),
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
    blocks: [],
    storage: {
      getItem: (key) => {
        if (throwing) throw new Error("blocked");
        return store.get(key) ?? null;
      },
      setItem: (key, value) => {
        if (throwing) throw new Error("blocked");
        store.set(key, value);
      },
    },
    createLabel: () => ({ textContent: "", setAttribute() {} }),
  };
  activate(root, env);
  return { root, button, status, classes, store };
}

test("activation reveals the switch and always starts off, even with an old stored choice", () => {
  const off = setup();
  assert.equal(off.root.hidden, false);
  assert.equal(off.classes.has("source-mode"), false);
  assert.equal(off.button.attrs["aria-pressed"], "false");

  const old = setup("on");
  assert.equal(old.classes.has("source-mode"), false, "a stored on is never restored");
  assert.equal(old.button.attrs["aria-pressed"], "false");
  assert.equal(old.status.textContent, "");
});

test("a click toggles the mode and announces it, and nothing is stored", () => {
  const s = setup();
  s.button.click();
  assert.equal(s.classes.has("source-mode"), true);
  assert.equal(s.store.size, 0);
  assert.equal(s.status.textContent, "on!");
  s.button.click();
  assert.equal(s.classes.has("source-mode"), false);
  assert.equal(s.status.textContent, "off!");
});

test("blocked storage does not stop the mode from working", () => {
  const s = setup(undefined, true);
  s.button.click();
  assert.equal(s.classes.has("source-mode"), true);
});

test("the command palette offers the switch and presses its button", () => {
  const page = { lang: "en", url: "/a/", kind: "doc", headings: [] } as unknown as Page;
  const action = paletteActions({ page }).find((a) => a.id === "source-mode");
  assert.deepEqual(action?.run, { kind: "source" });
  let clicks = 0;
  const handlers = liveHandlers({
    document: { querySelector: (selector) => (selector.includes("source-mode-button") ? { click: () => void (clicks += 1) } : null) },
  });
  handlers.source?.();
  assert.equal(clicks, 1);
});
