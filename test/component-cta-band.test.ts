import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import ctaBand, { COPY_ATTRIBUTE, directive, OPTIONS } from "../components/cta-band/index.ts";
import { activateAll } from "../components/cta-band/client.ts";

const MANAGERS = [
  { name: "npm", command: "npm install {package}" },
  { name: "pnpm", command: "pnpm add {package}" },
];

function render(props: Record<string, string>, lang = "en", managers: unknown = MANAGERS): string {
  const input = {
    props,
    html: "",
    page: { lang },
    site: { config: { base: "/", theme: { options: { installTabs: { managers } } } } },
  } as unknown as ComponentProps;
  const node = ctaBand(input as never);
  return node === null ? "" : renderToString(node as never);
}

test("the directive is cta-band and every option is documented in OPTIONS", () => {
  assert.equal(directive, "cta-band");
  assert.deepEqual([...OPTIONS], ["title", "lead", "label", "url", "package", "id"]);
});

test("the action only: heading, text and one link, no command, no copy button", () => {
  const out = render({ title: "Start", lead: "Read the guide.", label: "Get started", url: "/start/" });
  assert.match(out, /<h2 class="cta-band-title">Start<\/h2>/);
  assert.match(out, /<p class="cta-band-lead">Read the guide\.<\/p>/);
  assert.match(out, /<a class="cta-band-action" href="\/start\/">Get started<\/a>/);
  assert.doesNotMatch(out, /install-tabs|<button/);
});

test("the command only: install tabs and exactly one copy button", () => {
  const out = render({ title: "Install", package: "example-pkg" });
  assert.match(out, /data-install-tabs/);
  assert.match(out, /npm install example-pkg/);
  assert.match(out, /pnpm add example-pkg/);
  assert.doesNotMatch(out, /cta-band-action/);
  assert.equal(out.match(/<button/g)?.length, 1);
  assert.match(out, new RegExp(`${COPY_ATTRIBUTE}`));
  assert.match(out, / hidden/);
});

test("both: the primary action comes before the command in the reading order", () => {
  const out = render({ title: "Go", label: "Start", url: "/start/", package: "example-pkg" });
  assert.ok(out.indexOf("cta-band-action") < out.indexOf("data-install-tabs"));
  assert.equal(out.match(/<a /g)?.length, 1);
  assert.equal(out.match(/<button/g)?.length, 1);
});

test("nothing is drawn without a usable action or command, and unsafe or blank values are dropped", () => {
  assert.equal(render({ title: "Only a title" }), "");
  assert.equal(render({ label: "Go" }), "");
  assert.equal(render({ label: "Go", url: "javascript:alert(1)" }), "");
  assert.equal(render({ title: "T", label: " ", url: "/x/", package: " " }), "");
});

test("text is escaped", () => {
  const out = render({ title: "<b>x</b>", label: "<i>", url: "/a/" });
  assert.match(out, /&lt;b>x&lt;\/b>/);
  assert.doesNotMatch(out, /<b>/);
});

test("island: the copy control takes the command of the selected manager", async () => {
  const panels = { selected: "pnpm add example-pkg" };
  const tabs = { querySelector: (s: string) => (s.includes(":checked") ? { textContent: panels.selected } : null) };
  let click = () => {};
  const button = {
    hidden: true,
    nextElementSibling: { textContent: "" },
    dataset: { commands: "npm install example-pkg" } as Record<string, string>,
    addEventListener: (_: "click", l: () => void) => void (click = l),
    parentElement: tabs,
  };
  const written: string[] = [];
  activateAll({ querySelectorAll: () => [button] }, {
    clipboard: { writeText: async (t) => void written.push(t) },
    schedule: () => {},
  });
  assert.equal(button.hidden, false);
  click();
  await Promise.resolve();
  assert.deepEqual(written, ["pnpm add example-pkg"]);
});

test("island: without a clipboard the button stays hidden", () => {
  const button = { hidden: true, nextElementSibling: { textContent: "" }, dataset: {}, addEventListener: () => {}, parentElement: { querySelector: () => null } };
  activateAll({ querySelectorAll: () => [button] }, { clipboard: undefined, schedule: () => {} });
  assert.equal(button.hidden, true);
});
