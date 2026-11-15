import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OPTIONS as A11Y_OPTIONS } from "../components/a11y-report/index.ts";
import { OPTIONS as BUDGET_OPTIONS } from "../components/budget-report/index.ts";
import { OPTIONS as WCAG_OPTIONS } from "../components/wcag-checklist/index.ts";

const page = readFileSync(new URL("../site/components/reports.md", import.meta.url), "utf8");

/** The documentation section of one component, from its heading to the next one. */
function section(name: string): string {
  const start = page.indexOf(`## \`${name}\``);
  assert.ok(start !== -1, `the page has no section for ${name}`);
  const next = page.indexOf("\n## ", start + 1);
  return page.slice(start, next === -1 ? undefined : next);
}

/** The attributes written on one component's directive in the page. */
function directiveAttributes(name: string): string[] {
  const found = [...page.matchAll(new RegExp(`:{2,3}${name}\\{([^}]*)\\}`, "g"))];
  assert.ok(found.length > 0, `the page shows no ${name} example`);
  return found.flatMap((match) => [...(match[1] ?? "").matchAll(/([a-z-]+)=/g)].map((attr) => attr[1] ?? ""));
}

test("every option a report component exports is documented in its own section", () => {
  for (const [name, options] of [
    ["a11y-report", A11Y_OPTIONS],
    ["budget-report", BUDGET_OPTIONS],
    ["wcag-checklist", WCAG_OPTIONS],
  ] as const) {
    const body = section(name);
    for (const option of options) assert.match(body, new RegExp("`" + option + "`"), `${name}.${option}`);
  }
});

test("every attribute the page writes on a report example is one the component reads", () => {
  for (const [name, options] of [
    ["a11y-report", A11Y_OPTIONS],
    ["budget-report", BUDGET_OPTIONS],
    ["wcag-checklist", WCAG_OPTIONS],
  ] as const) {
    for (const attribute of directiveAttributes(name)) {
      assert.ok((options as readonly string[]).includes(attribute), `${name} does not read ${attribute}`);
    }
  }
});
