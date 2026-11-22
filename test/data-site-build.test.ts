import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { attrs, dataSite, root } from "./integration-helpers.ts";

/** The engine release the fixture was copied from; `fixtures/data-site/README.md` records it too. */
const ENGINE_COMMIT = "86f2871f6b917f67717b64645be4de49103dd2ea";

/**
 * The copied files and their SHA-256 at that commit. The README is not hashed: this repository
 * documents the commit there, and the engine has no copy of it.
 */
const HASHES: ReadonlyArray<readonly [string, string]> = [
  ["mizzen.yml", "31aa6d59a8b52085213b0936bbe0f897ae59371cb316e78b0746fc7ff3480a35"],
  ["_data/components.yml", "81a11336d51292e68dc0f0582ece8bcdf1418193d2bbdb16db78db05bba3a8d2"],
  ["_data/regions.csv", "53a521c79c226a33f0ae93f247f3dd85c68ed65c3d9e54c4fe4e341374150e02"],
  ["_data/releases.json", "7d67f2946a511fb1f89bc5114a1c4525788e56d92507d40eb8c2d5a78330b316"],
  ["_templates/components.md", "58a3c96670f1dc3ca7ae49bc2603567f6564ab26837003003757c1c7b50892e9"],
  ["_templates/regions.md", "acbe2cfd108341a4b36efa6f8049a6a282839bfcf1414b1225c4b65c6f1976c1"],
  ["_templates/releases.md", "7fdc3fd790fd311e5e730c437900bec455c33e03528bdf2b8289b918a2e9fa93"],
];

test("the copy matches the engine's fixture at the recorded commit", () => {
  for (const [file, expected] of HASHES) {
    const actual = createHash("sha256").update(readFileSync(join(root, "fixtures/data-site", file))).digest("hex");
    assert.equal(actual, expected, `fixtures/data-site/${file} drifted from the engine at ${ENGINE_COMMIT}`);
  }
});

test("the helper builds the fixture once and every record gets a page", () => {
  const site = dataSite();
  assert.equal(dataSite(), site, "the second call must reuse the first build");

  assert.match(site.html("/components/button/"), /<h1[^>]*>[\s\S]*?Button[\s\S]*?<\/h1>/);
  assert.match(site.html("/releases/4.0.0/"), /<h1[^>]*>[\s\S]*?4\.0\.0[\s\S]*?<\/h1>/);
  assert.match(site.html("/regions/north/"), /<h1[^>]*>[\s\S]*?North[\s\S]*?<\/h1>/);
  assert.match(site.html("/regions/north/"), /Code: [^<]*<[^>]*>NO</);
});

test("record downloads link to the engine's raw data and verifiable checksums", () => {
  const site = dataSite();
  const page = site.document("/components/button/");
  const files = attrs(page, 'section[aria-labelledby="collection-downloads"] a[download]', "href");
  assert.deepEqual(files, ["/data/components.raw.json", "/data/components.csv", "/data/components.sha256"]);
  const lines = site.file("data/components.sha256").trimEnd().split("\n");
  for (const href of files.slice(0, -1)) {
    const filename = href.split("/").at(-1);
    const hash = createHash("sha256").update(site.file(href.slice(1))).digest("hex");
    assert.ok(lines.includes(`${hash}  ${filename}`));
  }
});
