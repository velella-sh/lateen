import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import installTabs, { commandFor, directive, GENERIC_MANAGER, idBase, managersOf, MAX_MANAGERS } from "../components/install-tabs/index.ts";
import { activateAll, readChoice, saveChoice, select, STORAGE_KEY, type Group, type Radio, type Store } from "../components/install-tabs/client.ts";

const MANAGERS = [
  { name: "npm", command: "npm install {package}" },
  { name: "pnpm", command: "pnpm add {package}" },
  { name: "yarn", command: "yarn add {package}" },
];

function render(props: Record<string, string>, managers?: unknown, html = ""): string {
  const options = managers === undefined ? {} : { installTabs: { managers } };
  const input = { props, html, page: { lang: "en" }, site: { config: { theme: { options } } } } as unknown as ComponentProps;
  return renderToString(installTabs(input as never) as never);
}

test("the directive is install-tabs", () => {
  assert.equal(directive, "install-tabs");
});

test("every manager has a radio, a tab and a panel with its own command", () => {
  const out = render({ package: "example-pkg" }, MANAGERS);
  assert.equal(out.match(/class="install-tabs-radio"/g)?.length, 3);
  for (const m of MANAGERS) {
    assert.match(out, new RegExp(`<label class="install-tabs-tab"><input [^>]*data-manager="${m.name}"[^>]*>${m.name}</label>`));
    assert.match(out, new RegExp(`<code>${commandFor(m, "example-pkg").replace(/ /g, " ")}</code>`));
  }
  assert.equal(out.match(/ checked/g)?.length, 1);
});

test("the package comes from the prop, else the first body line, and is escaped", () => {
  assert.match(render({}, MANAGERS, "<p>from-body</p>"), /npm install from-body/);
  assert.match(render({ package: "<b>" }, MANAGERS), /npm install &lt;b>/);
});

test("a missing option shows the one generic manager, with no tabs", () => {
  assert.deepEqual(managersOf(undefined), [GENERIC_MANAGER]);
  const out = render({ package: "p" });
  assert.match(out, /npm install p/);
  assert.doesNotMatch(out, /<input/);
  assert.match(out, /data-single/);
});

test("bad entries are skipped, names are unique, and the list is capped", () => {
  const cfg = (managers: unknown) => ({ theme: { options: { installTabs: { managers } } } }) as never;
  assert.deepEqual(managersOf(cfg("nope")), [GENERIC_MANAGER]);
  assert.deepEqual(managersOf(cfg([{ name: "", command: "x" }, { name: "a" }, 3, null])), [GENERIC_MANAGER]);
  assert.deepEqual(managersOf(cfg([MANAGERS[0], MANAGERS[0], { name: "b", command: "b {package}" }])).map((m) => m.name), ["npm", "b"]);
  const many = Array.from({ length: 20 }, (_, i) => ({ name: `m${i}`, command: "c" }));
  assert.equal(managersOf(cfg(many)).length, MAX_MANAGERS);
});

test("ids are made safe", () => {
  assert.equal(idBase('a" b'), "a-b");
  assert.equal(idBase(undefined), "install-tabs");
});

// --- island ---

class FakeRadio implements Radio {
  checked: boolean;
  readonly dataset: { manager: string };
  listener: (() => void) | undefined;
  constructor(manager: string, checked = false) {
    this.dataset = { manager };
    this.checked = checked;
  }
  addEventListener(_t: "change", l: () => void): void {
    this.listener = l;
  }
  choose(): void {
    this.checked = true;
    this.listener?.();
  }
}
const group = (names: string[]) => {
  const radios = names.map((n, i) => new FakeRadio(n, i === 0));
  return { radios, group: { querySelectorAll: () => radios } as Group };
};
const memory = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

test("island: a remembered choice is applied, a click is remembered and shared across groups", () => {
  const store = memory();
  store.data.set(STORAGE_KEY, "pnpm");
  const a = group(["npm", "pnpm", "yarn"]);
  const b = group(["npm", "pnpm"]);
  activateAll({ querySelectorAll: () => [a.group, b.group] }, store);
  assert.deepEqual(a.radios.map((r) => r.checked), [false, true, false]);
  assert.deepEqual(b.radios.map((r) => r.checked), [false, true]);
  a.radios[2]!.choose();
  assert.equal(store.data.get(STORAGE_KEY), "yarn");
  assert.deepEqual(b.radios.map((r) => r.checked), [false, true], "a group without that manager keeps its own");
});

test("island: a blocked store neither throws nor changes the choice", () => {
  const blocked: Store = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(readChoice(blocked), undefined);
  assert.doesNotThrow(() => saveChoice(blocked, "npm"));
  assert.equal(readChoice(undefined), undefined);
  const g = group(["npm", "pnpm"]);
  activateAll({ querySelectorAll: () => [g.group] }, blocked);
  g.radios[1]!.choose();
  assert.deepEqual(g.radios.map((r) => r.checked), [false, true]);
});

test("the stylesheet shows only the checked install panel and hides the radios", () => {
  const css = [
    readFileSync(new URL("../styles/src/components.css", import.meta.url), "utf8"),
    readFileSync(new URL("../styles/src/overrides.css", import.meta.url), "utf8"),
  ].join("\n");
  assert.match(css, /\.install-tabs-radio\s*\{[^}]*opacity:\s*0/);
  assert.match(css, /\.install-tabs-panel\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.install-tabs-tab:has\(\.install-tabs-radio:checked\) \+ \.install-tabs-panel/);
});

test("island: an unknown remembered manager changes nothing", () => {
  const g = group(["npm", "pnpm"]);
  select([g.group], "bun");
  assert.deepEqual(g.radios.map((r) => r.checked), [true, false]);
});
