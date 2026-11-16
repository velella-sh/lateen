import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { brokenLinks, checkStarters, listStarters, manifestProblems, root, startersDir, withoutLanguages } from "../scripts/check-starters.ts";

/** A folder to hold a temporary starters folder. */
function scratch(): string {
  return mkdtempSync(join(tmpdir(), "lateen-starters-test-"));
}

/** Writes a minimal starter whose home page carries the given body. */
function writeStarter(dir: string, name: string, body: string): void {
  const base = join(dir, name);
  mkdirSync(base, { recursive: true });
  writeFileSync(join(base, "starter.json"), JSON.stringify({ title: "Fixture", description: "A fixture starter." }));
  writeFileSync(
    join(base, "mizzen.yml"),
    'title: Fixture\ndescription: A fixture.\nlang: en\nurl: https://example.com\nbase: ""\ntheme:\n  name: "@velella/lateen"\n',
  );
  writeFileSync(join(base, "index.md"), `---\ntitle: Fixture\ndescription: A fixture page.\nlayout: doc\npermalink: /\n---\n\n${body}\n`);
}

test("an empty or missing starters folder passes", () => {
  const dir = scratch();
  try {
    assert.deepEqual(checkStarters(dir), []);
    assert.deepEqual(checkStarters(join(dir, "missing")), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a starter with a broken link fails and is not skipped", () => {
  const dir = scratch();
  try {
    writeStarter(dir, "good", "Plain text with no links.");
    writeStarter(dir, "bad", "See [the missing page](/no-such-page/).");
    const problems = checkStarters(dir);
    assert.ok(problems.length > 0);
    assert.ok(problems.every((p) => p.starter === "bad"), JSON.stringify(problems));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a starter without starter.json or a description fails", () => {
  const dir = scratch();
  try {
    writeStarter(dir, "one", "Text.");
    writeFileSync(join(dir, "one", "starter.json"), JSON.stringify({ title: "Only a title" }));
    assert.match(manifestProblems(join(dir, "one")).problems.join("\n"), /description/);
    rmSync(join(dir, "one", "starter.json"));
    assert.match(manifestProblems(join(dir, "one")).problems.join("\n"), /starter\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a file over the size limit fails", () => {
  const dir = scratch();
  try {
    writeStarter(dir, "heavy", "Text.");
    writeFileSync(join(dir, "heavy", "big.txt"), "x".repeat(300 * 1024));
    assert.match(checkStarters(dir).map((p) => p.message).join("\n"), /big\.txt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("withoutLanguages drops the languages block and nothing else", () => {
  const config = "title: A\nlanguages:\n  - code: en\n    name: English\n  - code: fa\nsearch: { text: 300 }\n";
  assert.equal(withoutLanguages(config), "title: A\nsearch: { text: 300 }\n");
});

test("brokenLinks reads files, folders, anchors and external links", () => {
  const dir = scratch();
  try {
    mkdirSync(join(dir, "a"), { recursive: true });
    writeFileSync(join(dir, "a", "index.html"), "ok");
    writeFileSync(
      join(dir, "index.html"),
      '<a href="/a/">a</a><a href="a/#x">a</a><a href="https://x.test/">x</a><a href="#top">t</a><a href="/gone/">g</a>',
    );
    assert.deepEqual(brokenLinks(dir), ["index.html: /gone/"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every starter in the repository carries only files the engine reads and passes the check", () => {
  const names = listStarters(startersDir);
  for (const name of names) {
    const entries = readdirSync(join(startersDir, name));
    assert.ok(entries.includes("starter.json") && entries.includes("mizzen.yml"), `${name} needs starter.json and mizzen.yml`);
  }
  assert.deepEqual(checkStarters(startersDir), []);
});

test("the starters folder is published and the README is in it", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { files: string[] };
  assert.ok(pkg.files.includes("starters"));
  assert.ok(readFileSync(join(startersDir, "README.md"), "utf8").includes("starter.json"));
});
