// Browser tests share one server per fixture root, and the helper closes it once the run ends
// (#870). Without the sharing, every case paid for its own listen and the processes crowded the
// loopback ports under parallel jobs.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { serve, tempDir } from "./integration-helpers.ts";

test("one fixture root keeps one server, and another fixture gets a port of its own", async () => {
  const first = tempDir("serve-first-");
  const second = tempDir("serve-second-");
  writeFileSync(join(first, "index.html"), "<!doctype html><title>first</title>");
  writeFileSync(join(second, "index.html"), "<!doctype html><title>second</title>");

  const server = await serve(first);
  assert.equal(await serve(first), server, "the same fixture root reuses its server");
  assert.match(await (await fetch(`${server.url}/`)).text(), /<title>first<\/title>/);

  const other = await serve(second);
  assert.notEqual(other.url, server.url, "a second fixture listens on its own free port");
});
