// The theme's options are a public contract: this test holds them to `schema/options.schema.json`.
// Every site in this repository must write options the schema lists, and every option path a unit
// names — a `theme.options.<path>` in code or a literal in `optionOf(...)` — must be in the schema
// too, so a new option cannot ship without its entry.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../", import.meta.url));
const schema = JSON.parse(readFileSync(join(root, "schema/options.schema.json"), "utf8")) as {
  properties?: Record<string, unknown>;
  $defs?: Record<string, Record<string, unknown>>;
};
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

/** Every file under one directory whose name ends with one of the suffixes. */
function files(dir: string, suffixes: readonly string[]): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...files(path, suffixes));
    else if (suffixes.some((suffix) => entry.name.endsWith(suffix))) found.push(path);
  }
  return found;
}

/** Every `mizzen.yml` under the directories that carry a site. */
function sites(): string[] {
  const found: string[] = [];
  for (const dir of ["fixtures", "site", "starters", "test"]) {
    for (const path of files(dir, ["mizzen.yml"])) found.push(path);
  }
  return found;
}

/** The schema node a local `$ref` or `oneOf` branch leads to, or undefined. */
function branch(node: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  if (node === undefined) return undefined;
  const ref = node.$ref;
  if (typeof ref === "string") {
    const name = ref.replace("#/$defs/", "");
    const defs = schema.$defs as Record<string, Record<string, unknown>> | undefined;
    return branch(defs?.[name], key);
  }
  const properties = node.properties as Record<string, Record<string, unknown>> | undefined;
  if (properties?.[key] !== undefined) return properties[key];
  for (const group of ["oneOf", "anyOf", "allOf"] as const) {
    const branches = node[group];
    if (!Array.isArray(branches)) continue;
    for (const item of branches as Record<string, unknown>[]) {
      const found = branch(item, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** True when the schema has this dotted path under `theme.options`. */
function listed(path: string): boolean {
  let node: Record<string, unknown> | undefined = schema as Record<string, unknown>;
  for (const key of path.split(".")) {
    node = branch(node, key);
    if (node === undefined) return false;
  }
  return true;
}

/** The option path each `optionOf(...)` call names. */
function readPaths(text: string): string[] {
  return [...text.matchAll(/optionOf\([^,]*,\s*"([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** The option paths code and comments spell as `theme.options.<path>`. */
function spelledPaths(text: string): string[] {
  return [...text.matchAll(/theme\.options\??\.([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)/g)].map(
    (match) => (match[1] ?? "").replace(/\.$/, ""),
  );
}

test("every site in this repository writes options the schema lists", () => {
  const problems: string[] = [];
  for (const path of sites()) {
    const config = parse(readFileSync(join(root, path), "utf8")) as {
      theme?: { name?: string; options?: unknown };
    };
    if (config.theme?.name !== undefined && config.theme.name !== "@velella/lateen") continue;
    const options = config.theme?.options;
    if (options === undefined) continue;
    if (!validate(options)) {
      const errors = (validate.errors ?? []) as ErrorObject[];
      for (const error of errors) problems.push(`${relative(root, path)}${error.instancePath || "/theme/options"}: ${error.message ?? "is invalid"}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("every option path a unit names is in the schema", () => {
  const problems: string[] = [];
  for (const path of ["src", "components", "chrome", "layouts"].flatMap((dir) => files(dir, [".ts", ".tsx"]))) {
    const text = readFileSync(join(root, path), "utf8");
    for (const option of [...readPaths(text), ...spelledPaths(text)]) {
      if (option !== "" && !listed(option)) problems.push(`${path}: theme.options.${option}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the schema lists the option blocks this release ships", () => {
  for (const block of [
    "announcement",
    "brand",
    "drift",
    "editPage",
    "favicon",
    "feedback",
    "footer",
    "gallery",
    "glossary",
    "history",
    "installTabs",
    "logo",
    "network",
    "pageAgent",
    "preset",
    "reportIssue",
    "sourceMode",
    "stale",
    "status",
    "trust",
  ]) {
    assert.ok(listed(block), `schema/options.schema.json lists ${block}`);
  }
});
