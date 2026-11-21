import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, test } from "node:test";
import { all, build, type BuiltSite } from "./integration-helpers.ts";

let site: BuiltSite;
before(() => {
  site = build("integration", process.env, {
    "index.md": readFileSync(new URL("../site/index.md", import.meta.url), "utf8"),
    "install.md": readFileSync(new URL("../site/install.md", import.meta.url), "utf8"),
    "mizzen.yml": readFileSync(new URL("../fixtures/integration/mizzen.yml", import.meta.url), "utf8")
      .replace('base: ""', "base: /lateen"),
  });
});

test("the docs home identifies Lateen and links to onboarding, a preview, and documentation", () => {
  const home = site.document("/");
  assert.match(home.querySelector("main h1")!.textContent!, /Lateen.*documentation theme for Mizzen/);
  assert.deepEqual(all(home, ".hero-actions a").map((link) => link.getAttribute("href")), [
    "/lateen/install/",
    "/lateen/showpiece/",
    "/lateen/layouts/",
  ]);
  assert.deepEqual(all(home, ".hero-btn-primary").map((link) => link.textContent), ["Quickstart"]);
  assert.deepEqual(all(home, "a.feature-grid-card").map((link) => link.getAttribute("href")), [
    "/lateen/components/",
    "/lateen/starters/",
    "/lateen/tokens/",
  ]);
  assert.equal(home.querySelector(".home-bits, .home-preview, .home-showpiece-demo"), null);
});

test("quickstart renders the shell blocks in project setup order and links to the local preview", () => {
  const article = site.document("/install/").querySelector(".doc-body")!;
  assert.match(article.textContent!, /Node\.js 24 or later/);
  const blocks = all(article, "pre[data-lang='sh'] code").map((code) => code.textContent!.trim());
  assert.equal(blocks.length, 4);
  assert.match(blocks[0]!, /^npm init -y\nnpm install --save-exact [\s\S]*@velella\/mizzen@0\.2\.\d+[\s\S]*@velella\/lateen@0\.2\.\d+$/);
  assert.match(blocks[1]!, /^cat > mizzen\.yml [\s\S]*name: "@velella\/lateen"/);
  assert.match(blocks[2]!, /^cat > index\.md [\s\S]*title: Welcome to my docs\n---\n\nMy first page with Lateen\./);
  assert.equal(blocks[3], "npx mizzen dev .");
  assert.ok(article.querySelector('a[href="http://127.0.0.1:3000/"]'));
});
