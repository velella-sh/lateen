// The documented way to start a site is the command a reader runs, so every starter is installed into
// an empty folder with `mizzen init` and built from there.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { listStarters, root, startersDir } from "../scripts/check-starters.ts";

const MIZZEN = join(root, "node_modules/@velella/mizzen/bin/mizzen.js");

test("every starter installs with mizzen init and builds from the empty folder", () => {
  const names = listStarters(startersDir);
  assert.deepEqual(names, ["changelog", "data", "docs", "mixed", "report"]);
  for (const name of names) {
    const work = mkdtempSync(join(tmpdir(), `lateen-init-${name}-`));
    const out = mkdtempSync(join(tmpdir(), `lateen-init-${name}-out-`));
    try {
      const init = spawnSync(process.execPath, [MIZZEN, "init", work, "--theme", root, "--starter", name], {
        encoding: "utf8",
        timeout: 60_000,
      });
      assert.equal(init.status, 0, `${name}: ${init.stderr || init.stdout}`);
      assert.ok(existsSync(join(work, "mizzen.yml")), `${name} wrote no config`);
      assert.ok(existsSync(join(work, "index.md")), `${name} wrote no home page`);
      assert.ok(!existsSync(join(work, "starter.json")), `${name} kept its starter.json`);

      const check = spawnSync(process.execPath, [MIZZEN, "check", work, "--theme", root], {
        encoding: "utf8",
        timeout: 60_000,
      });
      assert.equal(check.status, 0, `${name}: ${check.stderr || check.stdout}`);

      const build = spawnSync(process.execPath, [MIZZEN, "build", work, "--theme", root, "--out", out], {
        encoding: "utf8",
        timeout: 60_000,
      });
      assert.equal(build.status, 0, `${name}: ${build.stderr || build.stdout}`);
      assert.ok(existsSync(join(out, "index.html")), `${name} built no home page`);
      const read = (path: string) => readFileSync(join(out, path), "utf8");
      if (name === "report") {
        assert.match(read("index.html"), /class="[^"]*gallery[^"]*"/);
        assert.match(read("archive/2026-05/index.html"), /North Bank/);
        assert.match(read("data/may.raw.json"), /"capturedAt"\s*:\s*"2026-05-31"/);
      }
      if (name === "mixed") {
        assert.match(read("guide/index.html"), /href="[^"]*stations\/ridge\/"/);
        assert.match(read("stations/ridge/index.html"), /Wind gauge/);
      }
      if (name === "data") {
        assert.match(read("calendars/kit-updates.ics"), /BEGIN:VEVENT/);
        assert.match(read("feeds/kit-updates.xml"), /<feed/);
        assert.match(read("feeds/kit-updates.rss.xml"), /<rss/);
        assert.match(read("feeds/kit-updates.json"), /jsonfeed.org/);
        assert.match(read("changes/kits/index.html"), /spirit-stove/);
        assert.match(read("search-facets.json"), /"category"/);
        assert.match(read("kits/shelter-tarp/notes/index.html"), /Shelter tarp field notes/);
        assert.match(read("kits/spirit-stove/index.html"), /Spirit stove/);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  }
});
