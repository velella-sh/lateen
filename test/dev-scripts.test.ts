// The two helper scripts that shorten the development loop: test-changed and new-component.
import assert from "node:assert/strict";
import { test } from "node:test";
import { files, validName } from "../scripts/new-component.ts";
import { keyOf, select } from "../scripts/test-changed.ts";

test("keyOf names the component folder, or the file without its extension", () => {
  assert.equal(keyOf("components/badge/index.ts"), "components/badge");
  assert.equal(keyOf("scripts/check-starters.ts"), "scripts/check-starters");
});

test("a changed test runs itself and a changed source runs the tests that mention it", () => {
  const tests = {
    "test/a.test.ts": 'import x from "../components/badge/index.ts"',
    "test/b.test.ts": "nothing here",
  };
  assert.deepEqual(select(["components/badge/index.ts"], tests).tests, ["test/a.test.ts"]);
  assert.deepEqual(select(["test/b.test.ts"], tests).tests, ["test/b.test.ts"]);
  assert.deepEqual(select(["components/ghost/index.ts"], tests).unmatched, ["components/ghost/index.ts"]);
});

test("shared inputs and prose select no narrow test", () => {
  const picked = select(["styles/src/ui.css", "docs/performance.md", "changelog.d/1.changed.md"], { "test/a.test.ts": "styles/src/ui" });
  assert.equal(picked.shared, true);
  assert.deepEqual(picked.tests, []);
  assert.deepEqual(picked.unmatched, []);
});

test("new-component accepts kebab-case names only and plans a unit plus a test", () => {
  assert.equal(validName("code-tabs"), true);
  for (const bad of ["", "Code", "code_tabs", "-a", "a--b", "../x"]) assert.equal(validName(bad), false, bad);
  assert.deepEqual(Object.keys(files("code-tabs")), ["components/code-tabs/index.ts", "test/component-code-tabs.test.ts"]);
  assert.match(files("code-tabs")["components/code-tabs/index.ts"] ?? "", /export default codeTabs;/);
});
