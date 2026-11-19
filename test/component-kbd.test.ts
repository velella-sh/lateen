import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import kbd, { CLASS_NAME, directive } from "../components/kbd/index.ts";

type Rendered = { type: string; props: { class: string; dangerouslySetInnerHTML?: { __html: string } } };

/** Render the key the way the render host calls it: no props, the body HTML. */
function render(html: string): Rendered {
  const input = { props: {}, html, page: {}, site: {} } as unknown as ComponentProps;
  return kbd(input) as unknown as Rendered;
}

const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);

const css = "" /* lateen-legacy removed: components/kbd/style.css */;

test("default export is the kbd component", () => {
  assert.equal(typeof kbd, "function");
});

test("the directive is kbd, so :kbd[Ctrl+K] reaches the component", () => {
  assert.equal(directive, "kbd");
  assert.equal(CLASS_NAME, "kbd");
});

test("renders a kbd element with the body HTML", () => {
  const node = render("Ctrl+K");
  assert.equal(node.type, "kbd");
  assert.equal(node.props.class, "kbd");
  assert.deepEqual(node.props.dangerouslySetInnerHTML, { __html: "Ctrl+K" });
});

test("passes the body HTML through unchanged", () => {
  assert.deepEqual(render("<span>Shift</span>+<span>Enter</span>").props.dangerouslySetInnerHTML, {
    __html: "<span>Shift</span>+<span>Enter</span>",
  });
});

test("an empty body renders an empty key", () => {
  assert.deepEqual(render("").props.dangerouslySetInnerHTML, { __html: "" });
});

