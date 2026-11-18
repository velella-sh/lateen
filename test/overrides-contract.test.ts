import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

const here = import.meta.dirname;
const repo = join(here, "..");
const fixtures = join(here, "overrides", "fixtures");
const site = join(fixtures, "site");
const invalid = join(fixtures, "invalid");

/** The `theme.overrides` map of a fixture config. */
interface Overrides {
  readonly components?: Readonly<Record<string, string>>;
  readonly layouts?: Readonly<Record<string, string>>;
}

function overridesOf(file: string): Overrides {
  const config = parse(readFileSync(file, "utf8")) as { theme?: { overrides?: Overrides } };
  return config.theme?.overrides ?? {};
}

/** True when the module at `file` default-exports a function. */
async function exportsUnit(file: string): Promise<boolean> {
  const mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
  return typeof mod.default === "function";
}

test("the sample site replaces one component and one layout", async () => {
  const overrides = overridesOf(join(site, "mizzen.yml"));
  assert.deepEqual(Object.keys(overrides.components ?? {}), ["related-guides"]);
  assert.deepEqual(Object.keys(overrides.layouts ?? {}), ["doc"]);

  for (const [kind, themePath] of [
    ["components", "components/related-guides/index.ts"],
    ["layouts", "layouts/doc.ts"],
  ] as const) {
    const name = kind === "components" ? "related-guides" : "doc";
    const rel = overrides[kind]?.[name];
    assert.ok(rel, `${kind}.${name} is configured`);
    assert.ok(existsSync(join(repo, themePath)), `the theme has ${themePath}`);
    assert.ok(existsSync(join(site, rel)), `${rel} exists in the site root`);
    assert.ok(existsSync(join(site, rel.replace(/\.ts$/, ".css"))), `${rel} has its CSS sidecar`);
    assert.ok(await exportsUnit(join(site, rel)), `${rel} default-exports a function`);
  }
});

test("the invalid fixture keeps an unknown name and a missing file apart", async () => {
  const overrides = overridesOf(join(invalid, "mizzen.yml"));
  const nav = overrides.components?.["site-nav"];
  const doc = overrides.layouts?.doc;

  assert.ok(nav, "site-nav is configured");
  assert.ok(existsSync(join(invalid, nav)), "the site-nav module exists, so only the name is wrong");
  assert.ok(await exportsUnit(join(invalid, nav)), "the site-nav module is a valid component");
  assert.ok(!existsSync(join(repo, "components/site-nav")), "site-nav is not a theme component");

  assert.ok(doc, "doc is configured");
  assert.ok(existsSync(join(repo, "layouts/doc.ts")), "doc is a theme layout");
  assert.ok(!existsSync(join(invalid, doc)), "the configured doc file is missing");
});

test("the note fixes the contract and its diagnostics", () => {
  const note = readFileSync(join(repo, "docs", "overrides.md"), "utf8");
  for (const id of [
    "overrides.missing-file",
    "overrides.invalid-export",
    "overrides.unknown-unit",
    "overrides.outside-site",
  ]) {
    assert.ok(note.includes(id), `docs/overrides.md names ${id}`);
  }
  for (const required of ["theme.overrides", "Build behavior", "test/overrides/fixtures/"]) {
    assert.ok(note.includes(required), `docs/overrides.md states ${required}`);
  }
});
