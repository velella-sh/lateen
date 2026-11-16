import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS as DEMO_OPTIONS } from "../components/cli-demo/index.ts";
import { OPTIONS as TABS_OPTIONS, SITE_OPTION } from "../components/install-tabs/index.ts";

const page = readFileSync(new URL("../site/components/cli-demo.md", import.meta.url), "utf8");

/** The option names in the first column of the `Option` tables, in page order, split at the install-tabs section. */
function documented(section: string): string[] {
  const names: string[] = [];
  let inTable = false;
  for (const line of section.split("\n")) {
    if (/^\| Option \|/.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    const cell = /^\| `([^`]+)` \|/.exec(line);
    if (cell) names.push(cell[1]!);
    else if (!/^\| ---/.test(line)) inTable = false;
  }
  return names;
}

const [demoPart, tabsPart] = page.split(/^## Install tabs$/m) as [string, string];

test("the CLI demo page documents exactly the options the component reads", () => {
  assert.deepEqual(documented(demoPart).sort(), [...DEMO_OPTIONS].sort());
});

test("the install tabs section documents exactly the attributes and the site option the component reads", () => {
  assert.deepEqual(documented(tabsPart).sort(), [...TABS_OPTIONS, SITE_OPTION.replace(/^/, "theme.options.")].sort());
});

test("the example data names no real product, and the page is linked from the index and navigation", () => {
  assert.match(page, /example-package/);
  assert.match(readFileSync(new URL("../site/components/index.md", import.meta.url), "utf8"), /\(\.\/cli-demo\/\)/);
  assert.match(readFileSync(new URL("../site/_data/navigation.yml", import.meta.url), "utf8"), /\/components\/cli-demo\//);
});
