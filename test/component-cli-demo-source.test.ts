import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import cliDemo from "../components/cli-demo/index.ts";
import { readSessionFile, siteFolderOf } from "../components/cli-demo/source.ts";
import { tempDir } from "./integration-helpers.ts";

const root = tempDir("cli-demo-");
mkdirSync(join(root, "site/guide"), { recursive: true });
writeFileSync(join(root, "site/mizzen.yml"), "title: x\n");
writeFileSync(join(root, "site/session.txt"), "$ npm ci\nadded 1 package\n! warn\n");
writeFileSync(join(root, "site/guide/local.txt"), "$ ls\n");
writeFileSync(join(root, "secret.txt"), "$ secret\n");
symlinkSync(join(root, "secret.txt"), join(root, "site/link.txt"));

const PAGE = "site/guide/page.md";

function render(props: Record<string, string>): string {
  const original = process.cwd();
  process.chdir(root);
  try {
    const input = { props, html: "<p>ignored body</p>", page: { lang: "en", source: { file: PAGE, line: 7 } }, site: {} } as unknown as ComponentProps;
    return renderToString(cliDemo(input as never) as never);
  } finally {
    process.chdir(original);
  }
}

test("the site folder is the nearest one with a site config", () => {
  assert.equal(siteFolderOf(PAGE, root), join(root, "site"));
});

test("a file under the site renders as the block, and the body is ignored", () => {
  const out = render({ src: "/session.txt" });
  assert.match(out, /data-line="command"/);
  assert.match(out, /added 1 package/);
  assert.match(out, /cli-demo-label-visible">error</);
  assert.doesNotMatch(out, /ignored body/);
});

test("a relative path is read from the page's folder", () => {
  assert.match(render({ src: "local.txt" }), /<span class="cli-demo-text">ls<\/span>/);
});

test("a missing file is reported with the position of the directive's page", () => {
  const out = render({ src: "/nope.txt" });
  assert.match(out, /cli-demo-diagnostic/);
  assert.match(out, /Session file not found: \/nope\.txt \(site\/guide\/page\.md:7\)/);
});

test("a path outside the site folder is never read", () => {
  for (const src of ["../../secret.txt", "/../secret.txt", join(root, "secret.txt"), "/link.txt"]) {
    const out = render({ src });
    assert.match(out, /cli-demo-diagnostic/, src);
    assert.doesNotMatch(out, /secret<|>secret/, src);
  }
  assert.deepEqual(readSessionFile("../../secret.txt", PAGE, root), { ok: false, reason: "outside" });
});

test("an address or an empty path is invalid", () => {
  for (const src of ["https://example.com/a.txt", "//host/a", "file:///etc/passwd", " "]) {
    assert.deepEqual(readSessionFile(src, PAGE, root), { ok: false, reason: "invalid" }, src);
  }
});
