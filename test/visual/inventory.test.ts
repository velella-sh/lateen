import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { tempDir } from "../integration-helpers.ts";
import { buildFixture } from "./fixtures/build.ts";

interface Entry {
  readonly name: string;
  readonly selector: string;
  readonly page?: string;
  readonly variants?: readonly string[];
}

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BUILD = tempDir("visual-inventory-gate-");
const REPORT = tempDir("visual-inventory-report-");
const INVENTORY = JSON.parse(readFileSync(join(ROOT, "test/visual/inventory.json"), "utf8")) as { components: Entry[] };
const STATES = JSON.parse(readFileSync(join(ROOT, "test/visual/states.json"), "utf8")) as { components: { name: string }[] };

function components(): string[] {
  return readdirSync(join(ROOT, "components"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && readFileSync(join(ROOT, "components", entry.name, "index.ts"), "utf8").length > 0)
    .map((entry) => entry.name)
    .sort();
}

function docFor(page: string): Document {
  const file = page === "/" ? "index.html" : `${page.replace(/^\/|\/$/g, "")}/index.html`;
  return new JSDOM(readFileSync(join(BUILD, file), "utf8")).window.document;
}

test("the inventory covers every component, selector, variant and island", () => {
  buildFixture(BUILD);
  const expected = components();
  const inventoryNames = INVENTORY.components.map((entry) => entry.name);
  const errors: string[] = [];

  for (const name of expected) if (!inventoryNames.includes(name)) errors.push(`missing component: ${name}`);
  for (const name of inventoryNames) if (!expected.includes(name)) errors.push(`unknown component: ${name}`);

  const gallery = docFor("/gallery/");
  const inventoryPage = docFor("/inventory/");
  const allHtml = `${gallery.documentElement.outerHTML}\n${inventoryPage.documentElement.outerHTML}`;

  for (const entry of INVENTORY.components) {
    const doc = entry.page === undefined ? gallery : docFor(entry.page);
    if (doc.querySelector(entry.selector) === null) errors.push(`component ${entry.name}: selector not found: ${entry.selector}`);
    for (const variant of entry.variants ?? []) {
      if (!allHtml.includes(variant)) errors.push(`variant ${entry.name}: ${variant} has no fixture`);
    }
  }

  const islands = readdirSync(join(ROOT, "components"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && readdirSync(join(ROOT, "components", entry.name)).includes("client.ts"))
    .map((entry) => entry.name)
    .sort();
  const stateNames = new Set(STATES.components.map((entry) => entry.name));
  for (const name of islands) if (!stateNames.has(name)) errors.push(`client component ${name} has no states.json entry`);

  writeFileSync(
    join(REPORT, "fixture-inventory.json"),
    `${JSON.stringify({ components: expected.length, variants: INVENTORY.components.reduce((n, entry) => n + (entry.variants?.length ?? 0), 0), clientComponents: islands.length, ok: errors.length === 0, errors }, null, 2)}\n`,
  );

  assert.deepEqual(errors, [], errors.join("\n"));
});

interface Contract {
  /** Selector that must exist in the server-rendered fixture. */
  readonly state?: string;
  /** Selector `styles/print.css` must carry when paper changes the screen behavior. */
  readonly print?: string;
  /** Why a component is exempt from the print half of the contract. */
  readonly reason?: string;
}

/**
 * The no-JavaScript and print contract for the components the issue names. A component with a
 * print rule must also keep its no-JS state in the static fixture; the four exempt components carry
 * no screen-only state that paper would lose.
 */
const CONTRACTS: Readonly<Record<string, Contract>> = {
  details: { state: "details.details > :not(summary)", print: "details:not([open]) > :not(summary)" },
  tabs: { state: '.tabs > [role="tabpanel"]', print: '.tabs > [role="tabpanel"][hidden]' },
  "os-tabs": { state: ".os-tabs-panel", print: ".os-tabs-panel[hidden]" },
  "code-tabs": { state: ".code-tabs-panel", print: ".code-tabs-panel[hidden]" },
  "install-tabs": { state: ".install-tabs-panel", print: ".install-tabs-panel[hidden]" },
  "symbol-popover": { state: ".symbol-popover-panel", print: ".symbol-popover-panel" },
  term: { state: ".term-panel", print: ".term-panel" },
  "trust-panel": { state: ".trust-panel-body", print: ".trust-panel-body" },
  code: { state: "pre.code code", print: ".code code" },
  terminal: { state: ".terminal-body", print: ".terminal-body" },
  table: { state: ".table-scroll > .table", print: ".table-scroll > .table" },
  "schema-table": { state: ".schema-table", print: ".schema-table" },
  "a11y-report": { state: ".a11y-report-scroll", print: ".a11y-report-scroll" },
  "budget-report": { state: ".budget-report-scroll", print: ".budget-report-scroll" },
  "wcag-checklist": { state: ".wcag-checklist-scroll", print: ".wcag-checklist-scroll" },
  figure: { state: "figure.figure", print: ".figure-credit a[href]" },
  "link-card": { state: "a.link-card", print: ".link-card" },
  "diff-block": { reason: "plain code lines with no clipped or hidden content; print.css hides only its copy control" },
  "output-block": { reason: "plain output text with no clipped or hidden content; print.css hides only its copy control" },
  video: { reason: "the no-JS fallback is a plain link the global printed-link rule already covers" },
  mermaid: { reason: "its SVG and source are figure content the global figure break rules cover" },
};

test("the component fixtures keep their no-JS state and print contract", () => {
  buildFixture(BUILD);
  const css = readFileSync(join(ROOT, "styles/print.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
  const errors: string[] = [];
  const excluded: string[] = [];

  for (const [name, contract] of Object.entries(CONTRACTS)) {
    if (contract.reason !== undefined) {
      excluded.push(name);
      continue;
    }
    const page = docFor("/gallery/");
    assert.ok(contract.state, `${name}: no no-JS selector in the contract`);
    if (page.querySelector(contract.state) === null) {
      errors.push(`${name}: the server-rendered fixture has no \`${contract.state}\``);
    }
    if (contract.print !== undefined && !css.includes(contract.print)) {
      errors.push(`${name}: print.css has no rule for \`${contract.print}\``);
    }
  }

  const report = {
    contracts: Object.keys(CONTRACTS).length,
    checked: Object.keys(CONTRACTS).length - excluded.length,
    excluded,
    ok: errors.length === 0,
    errors,
  };
  writeFileSync(join(REPORT, "component-contracts.json"), `${JSON.stringify(report, null, 2)}\n`);

  assert.deepEqual(errors, [], errors.join("\n"));
});
