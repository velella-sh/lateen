import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS } from "../layouts/list.ts";

const page = readFileSync(new URL("../site/layouts/list.md", import.meta.url), "utf8");

/** The documentation section of the page, from its heading to the next one. */
function section(name: string): string {
  const start = page.indexOf(`## ${name}`);
  assert.ok(start !== -1, `the page has no ${name} section`);
  const next = page.indexOf("\n## ", start + 1);
  return page.slice(start, next === -1 ? undefined : next);
}

test("the documented list options are exactly the ones the layout exports", () => {
  const documented = [...section("Options").matchAll(/^\| `list\.([^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(documented.sort(), [...OPTIONS].sort());
});
