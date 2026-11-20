import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../site/changelog.md", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../site/_data/navigation.yml", import.meta.url), "utf8");
const config = readFileSync(new URL("../site/mizzen.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

test("the docs changelog uses the changelog layout and real current releases", () => {
  assert.ok(page.includes("layout: changelog"));
  assert.ok(page.includes("permalink: /changelog/"));
  assert.ok(page.includes(`version: ${packageJson.version}`));

  const releases = [
    ["0.2.3", "2026-11-19"],
    ["0.2.2", "2026-11-14"],
    ["0.2.1", "2026-11-14"],
    ["0.2.0", "2026-11-13"],
  ];
  const positions = releases.map(([version, date]) => {
    const release = new RegExp(`version: ${version}\\.?\n[\\t ]+date: ${date}\\.?$`, "m");
    assert.match(page, release);
    return page.search(release);
  });
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "releases are newest first");
});

test("the changelog is linked from Start navigation and the site footer", () => {
  const start = navigation.slice(navigation.indexOf("  - title: Start"), navigation.indexOf("  - title: Components"));
  assert.match(start, /- title: Changelog\n\s+url: \/changelog\//);
  const footer = config.slice(config.indexOf("    footer:"), config.indexOf("    status:"));
  assert.match(footer, /- title: Changelog\n\s+url: \/changelog\//);
});

test("the public page omits mockup filler and links the complete package changelog", () => {
  assert.ok(!page.includes("2026-03-12"));
  assert.ok(!page.includes("Callout titles keep author order"));
  assert.ok(page.includes("https://github.com/velella-sh/lateen/blob/main/CHANGELOG.md"));
});
