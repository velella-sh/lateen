// Creates the two files every component starts with: the Preact unit and a test beside the others.
// It edits no shared index (the folder's README says a unit never does) and prints what is left.
//
// Usage: node scripts/new-component.ts <kebab-case-name>
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export function validName(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
}

function camel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

/** The files to write, keyed by path from the repository root. */
export function files(name: string): Record<string, string> {
  const id = camel(name);
  return {
    [`components/${name}/index.ts`]: `import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/** Props from the directive: \`:${name}[Body]{label=text}\`. */
export type ${id[0]?.toUpperCase()}${id.slice(1)}Props = {
  label?: string;
};

const ${id}: Component<${id[0]?.toUpperCase()}${id.slice(1)}Props> = ({ props, html }) =>
  h("div", { class: "${name}", "aria-label": props.label, dangerouslySetInnerHTML: { __html: html } });

export default ${id};
`,
    [`test/component-${name}.test.ts`]: `import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import ${id} from "../components/${name}/index.ts";

test("the ${name} renders its body inside its own class", () => {
  const node = ${id}({ props: {}, html: "Body" } as unknown as ComponentProps<Record<string, never>>) as unknown as {
    type: string;
    props: { class: string; dangerouslySetInnerHTML: { __html: string } };
  };
  assert.equal(node.type, "div");
  assert.equal(node.props.class, "${name}");
  assert.equal(node.props.dangerouslySetInnerHTML.__html, "Body");
});
`,
  };
}

function main(): number {
  const name = process.argv[2] ?? "";
  if (!validName(name)) {
    console.error("usage: node scripts/new-component.ts <kebab-case-name>");
    return 1;
  }
  const planned = files(name);
  const taken = Object.keys(planned).filter((path) => existsSync(join(ROOT, path)));
  if (taken.length > 0) {
    console.error(`refusing to overwrite: ${taken.join(", ")}`);
    return 1;
  }
  for (const [path, text] of Object.entries(planned)) {
    mkdirSync(dirname(join(ROOT, path)), { recursive: true });
    writeFileSync(join(ROOT, path), text);
    console.log(`created ${path}`);
  }
  console.log(`
Still to do by hand:
  - styles in styles/src/ui.css (then npm run ui:build)
  - an entry for "${name}" in test/visual/inventory.json, and in test/visual/states.json if it gets a client.ts
  - a changelog.d fragment once the pull request has a number`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main();
