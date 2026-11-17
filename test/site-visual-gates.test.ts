import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const docs = readFileSync(new URL("../site/visual-gates.md", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../site/_data/navigation.yml", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/test-visual.ts", import.meta.url), "utf8");
const scripts = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> }).scripts;

/** Every line of the page's fenced shell examples. */
const commands = [...docs.matchAll(/```bash\n([\s\S]*?)```/g)]
  .flatMap((block) => (block[1] ?? "").split("\n"))
  .map((line) => line.trim())
  .filter((line) => line.startsWith("npm run ") || line.startsWith("node scripts/test-visual.ts"));

test("every npm command on the page is a script package.json defines", () => {
  assert.ok(commands.length > 0);
  for (const command of commands.filter((line) => line.startsWith("npm run "))) {
    const name = command.split(/\s+/)[2] ?? "";
    assert.equal(typeof scripts[name], "string", `${name} is not a package.json script`);
  }
});

test("test:visual runs the file the page tells a reader to run", () => {
  assert.ok(commands.includes("node scripts/test-visual.ts --update"));
  assert.ok(commands.includes("node scripts/test-visual.ts --only gallery"));
  assert.equal(scripts["test:visual"], "node scripts/test-visual.ts");
});

test("every flag the page shows for the runner is one the runner reads, and the reverse", () => {
  const shown = docs.split("\n").filter((line) => line.includes("scripts/test-visual.ts")).join("\n");
  const documented = new Set([...docs.matchAll(/`(--[a-z][a-z-]*)\b/g)].map((match) => match[1] as string));
  for (const match of shown.matchAll(/--[a-z][a-z-]*/g)) if (match[0] !== undefined) documented.add(match[0]);
  const read = [...new Set([...runner.matchAll(/"--([a-z][a-z-]*)"/g)].map((match) => `--${match[1]}`))].sort();
  assert.deepEqual([...documented].sort(), read);
});

test("the page has a navigation entry", () => {
  assert.match(navigation, /title: Visual gates\n\s+url: \/visual-gates\//);
});
