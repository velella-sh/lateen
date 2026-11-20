import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { readUiCss } from "./ui-css-helpers.ts";

/**
 * Layout-rendered components must not keep a private style.css (the engine never loads it).
 * After the lateen-legacy drop their rules live in styles/src/ui.css when styled.
 */
const LAYOUT_COMPONENTS: Readonly<Record<string, string>> = {
  "add-to-calendar": ".add-to-calendar",
  "changelog-entry": ".changelog-entry",
  code: ".code",
  "drift-banner": ".drift-banner",
  "page-status": ".page-status",
  "record-history": ".record-history",
  "stale-notice": ".stale-notice",
  "reading-time": ".reading-time",
  "trust-panel": ".trust-panel",
};

const ui = readUiCss();

for (const [name, root] of Object.entries(LAYOUT_COMPONENTS)) {
  test(`layout component ${name} keeps its CSS in the sailcloth bundle`, () => {
    assert.ok(
      !existsSync(new URL(`../components/${name}/style.css`, import.meta.url)),
      `components/${name}/style.css would never load from a layout`,
    );
    assert.ok(
      !existsSync(new URL(`../styles/parts-${name}.css`, import.meta.url)),
      `styles/parts-${name}.css was removed with lateen-legacy`,
    );
    // Match `.code` as a selector, not as a prefix of `.code-block` / `.code-copy`.
    const asSelector = new RegExp(`${root.replace(".", "\\.")}(?![\\w-])`);
    if (asSelector.test(ui)) {
      assert.match(ui, new RegExp(`${root.replace(".", "\\.")}\\s*[,{]`));
    }
  });
}
