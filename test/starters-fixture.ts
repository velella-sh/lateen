// Shared by the starters tests, which are split by file because each real build runs serially inside
// a file and files run in parallel. Not a test file itself.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A folder to hold a temporary starters folder. */
export function scratch(): string {
  return mkdtempSync(join(tmpdir(), "lateen-starters-test-"));
}

/** Writes a minimal starter whose home page carries the given body. */
export function writeStarter(dir: string, name: string, body: string): void {
  const base = join(dir, name);
  mkdirSync(base, { recursive: true });
  writeFileSync(join(base, "starter.json"), JSON.stringify({ title: "Fixture", description: "A fixture starter." }));
  writeFileSync(
    join(base, "mizzen.yml"),
    'title: Fixture\ndescription: A fixture.\nlang: en\nurl: https://example.com\nbase: ""\ntheme:\n  name: "@velella/lateen"\n',
  );
  writeFileSync(join(base, "index.md"), `---\ntitle: Fixture\ndescription: A fixture page.\nlayout: doc\npermalink: /\n---\n\n${body}\n`);
}
