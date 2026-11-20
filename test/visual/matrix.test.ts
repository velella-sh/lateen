import assert from "node:assert/strict";
import { test } from "node:test";
import { expandMatrix, islandComponents, loadMatrix, loadStates } from "../../scripts/test-visual.ts";
import { loadInventory, stateMatrixCases, stateMatrixErrors } from "../../scripts/visual-matrix.ts";
import { PAGES } from "./fixtures/pages.ts";

const matrix = loadMatrix();
const entries = expandMatrix(matrix);
const layouts = entries.filter((entry) => entry.section === "layout");
const gallery = entries.filter((entry) => entry.section === "gallery");
const print = entries.filter((entry) => entry.section === "print");
const forced = entries.filter((entry) => entry.section === "forced-colors");
const pageByPath = new Map(PAGES.map((page) => [page.path, page]));

test("the matrix lists every layout in both themes, three languages and three widths", () => {
  const themes = [...new Set(layouts.map((entry) => entry.theme))].sort();
  const widths = [...new Set(layouts.map((entry) => entry.width))].sort((a, b) => a - b);
  const langs = [...new Set(layouts.map((entry) => entry.lang))].sort();
  assert.deepEqual(themes, ["dark", "light"]);
  assert.deepEqual(widths, [375, 768, 1280]);
  assert.deepEqual(langs, ["ar", "en", "fa"]);

  for (const target of matrix.layouts) {
    const cases = layouts.filter((entry) => entry.name === target.name);
    assert.equal(cases.length, matrix.themes.length * Object.keys(matrix.widths).length, target.name);
    for (const theme of matrix.themes) {
      for (const widthName of Object.keys(matrix.widths)) {
        assert.ok(cases.some((entry) => entry.theme === theme && entry.widthName === widthName), `${target.name} ${theme} ${widthName}`);
      }
    }
  }

  const covered = layouts
    .filter((entry) => entry.lang === "en")
    .map((entry) => pageByPath.get(entry.path)?.layout);
  assert.deepEqual([...new Set(covered)].sort(), [...new Set(PAGES.map((page) => page.layout))].sort());
  assert.ok(layouts.some((entry) => entry.lang === "fa" && entry.dir === "rtl"), "Persian is right to left");
  assert.ok(layouts.some((entry) => entry.lang === "ar" && entry.dir === "rtl"), "Arabic is right to left");
});

test("the gallery has two widths, three print pages and two forced-colors pages", () => {
  assert.deepEqual([...new Set(gallery.map((entry) => entry.widthName))], ["mobile", "desktop"]);
  assert.equal(new Set(gallery.map((entry) => entry.name)).size, 3);
  assert.equal(gallery.length, matrix.gallery.pages.length * matrix.gallery.widths.length * matrix.themes.length);
  assert.equal(print.length, 3);
  assert.equal(forced.length, 2);
  assert.deepEqual(print.map((entry) => entry.path).sort(), matrix.gallery.pages.map((page) => page.path).sort());
  assert.ok(print.every((entry) => entry.section === "print"));
  assert.ok(forced.every((entry) => entry.section === "forced-colors"));
});

test("every entry names one safe, unique screenshot and a real fixture page", () => {
  const cases = entries.map((entry) => entry.case);
  assert.equal(new Set(cases).size, cases.length);
  for (const entry of entries) {
    assert.match(entry.case, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, entry.case);
    const page = pageByPath.get(entry.path);
    assert.ok(page !== undefined, `${entry.case}: ${entry.path} is a fixture page`);
    assert.equal(entry.lang, page.lang, entry.case);
    assert.equal(entry.dir, page.lang === "en" ? "ltr" : "rtl", entry.case);
  }
  assert.deepEqual(
    new Set(entries.map((entry) => entry.width)).size,
    3,
    "the matrix has three widths",
  );
});

test("the matrix data names valid widths, themes and pages", () => {
  assert.equal(matrix.version, 1);
  assert.deepEqual([...matrix.themes], ["light", "dark"]);
  for (const [name, size] of Object.entries(matrix.widths)) {
    assert.match(name, /^[a-z][a-z0-9-]*$/);
    assert.ok(Number.isInteger(size.width) && size.width > 0, name);
    assert.ok(Number.isInteger(size.height) && size.height > 0, name);
  }
  const targets = [...matrix.layouts, ...matrix.gallery.pages];
  assert.equal(new Set(targets.map((target) => target.name)).size, targets.length);
  assert.equal(new Set(targets.map((target) => target.path)).size, targets.length);
  for (const target of targets) {
    assert.match(target.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, target.name);
    assert.ok(target.path.startsWith("/"), target.path);
    assert.equal(target.dir, target.lang === "en" ? "ltr" : "rtl", target.name);
  }
  for (const widthName of matrix.gallery.widths) {
    assert.ok(matrix.widths[widthName] !== undefined, `${widthName} is a matrix width`);
  }
});

test("every interactive component has one unique state case", () => {
  const states = loadStates();
  const cases = stateMatrixCases(states).map((entry) => entry.case);
  assert.equal(new Set(cases).size, cases.length);
  assert.deepEqual(stateMatrixErrors(states, loadInventory(), islandComponents()), []);
});

test("a missing, unknown or duplicated component state is rejected", () => {
  const states = loadStates();
  const inventory = loadInventory();
  const components = islandComponents();
  const first = states.components[0];
  assert.ok(first !== undefined);

  const missing = { ...states, components: states.components.slice(1) };
  assert.ok(stateMatrixErrors(missing, inventory, components).includes(`missing component: ${first.name}`));

  const duplicated = { ...states, components: [...states.components, first] };
  assert.ok(stateMatrixErrors(duplicated, inventory, components).includes(`duplicate component: ${first.name}`));

  const unknown = { ...states, components: [...states.components, { ...first, name: "not-a-component" }] };
  assert.ok(stateMatrixErrors(unknown, inventory, components).includes("unknown component: not-a-component"));

  const state = first.states[0];
  assert.ok(state !== undefined);
  const repeated = {
    ...states,
    components: states.components.map((entry) => (entry.name === first.name ? { ...entry, states: [state, state] } : entry)),
  };
  const errors = stateMatrixErrors(repeated, inventory, components);
  assert.ok(errors.includes(`${first.name}: duplicate state: ${state}`));
  assert.ok(errors.includes(`duplicate case: ${first.name}-${state}`));
});
