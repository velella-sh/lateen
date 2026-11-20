// Every shell entry point a release or package gate runs must fail loudly: strict mode, quoted
// expansions, and an explicit directory. The smoke script runs once here with a failing child and a
// temporary path that contains a space, which must exit non-zero and still clean up.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url).pathname;

function shellScripts(): string[] {
  const found: string[] = [];
  for (const dir of ["scripts", "bin"]) {
    const path = join(root, dir);
    if (!existsSync(path)) continue;
    for (const name of readdirSync(path)) if (name.endsWith(".sh")) found.push(join(path, name));
  }
  return found;
}

// Heredoc bodies and multi-line single-quoted arguments (`node -e '...'`) are data for another
// language: skip them, so `$` inside them is not read as a shell expansion.
function shellLines(file: string): string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const kept: string[] = [];
  let heredoc: string | undefined;
  let literal = false;
  for (const line of lines) {
    if (heredoc) {
      if (line.trim() === heredoc) heredoc = undefined;
      continue;
    }
    if (literal) {
      const trim = line.trim();
      if (trim.startsWith("'") || trim.endsWith("'")) literal = false;
      continue;
    }
    if (line.trimStart().startsWith("#")) {
      kept.push("");
      continue;
    }
    let code = "";
    let single = false;
    for (const char of line) {
      if (char === "'") single = !single;
      else if (!single) code += char;
    }
    if (single) literal = true;
    else heredoc = /<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?/.exec(line)?.[1];
    kept.push(code);
  }
  return kept;
}

test("every shell entry point sets strict mode", () => {
  const files = shellScripts();
  assert.ok(files.length > 0, "expected at least one shell entry point");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.match(text, /^#!\/usr\/bin\/env bash\n/, `${file} uses the bash shebang`);
    assert.match(text, /^set -[a-z]*e/m, `${file} exits on a failed command`);
    assert.match(text, /^set -[a-z]*u/m, `${file} rejects unset variables`);
    assert.match(text, /\bpipefail\b/, `${file} fails a pipeline on any failed command`);
  }
});

// A `$name` or `${name}` outside double quotes word-splits on spaces.
function unquotedExpansions(line: string): string[] {
  const found: string[] = [];
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\\" && quoted) i += 1;
    else if (char === '"') quoted = !quoted;
    else if (char === "$" && !quoted) {
      const match = /^\$\{?[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?\}?/.exec(line.slice(i));
      if (match) found.push(match[0]);
    }
  }
  return found;
}

test("every shell entry point quotes variable expansions outside single quotes", () => {
  for (const file of shellScripts()) {
    shellLines(file).forEach((line, index) => {
      const unquoted = unquotedExpansions(line);
      assert.deepEqual(unquoted, [], `${file}:${index + 1} quotes ${unquoted.join(", ")}: ${line.trim()}`);
    });
  }
});

test("a failing child command fails the smoke script, even from a temporary path with a space", () => {
  const stub = mkdtempSync(join(tmpdir(), "lateen-npm-stub-"));
  const work = mkdtempSync(join(tmpdir(), "lateen tmp "));
  try {
    writeFileSync(join(stub, "npm"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(stub, "npm"), 0o755);
    assert.throws(
      () =>
        execFileSync("bash", [join(root, "scripts/smoke-package.sh")], {
          env: { ...process.env, PATH: `${stub}:${process.env.PATH}`, TMPDIR: work },
          stdio: "pipe",
        }),
      /Command failed/,
    );
    assert.deepEqual(readdirSync(work), [], "the trap removes the temporary tree");
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(stub, { recursive: true, force: true });
  }
});
