// #919: a sailcloth selector must be reachable from a rendered fixture page or named by theme source.
// The visual fixture renders every layout and every component in three languages; anything its HTML
// never carries and no source file ever names cannot apply, so the sheet drops it instead of carrying it.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildFixture } from "./visual/fixtures/build.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BUILD = join(ROOT, ".mizzen/css-coverage");
const SRC = join(ROOT, "styles/src");
const SKIP = new Set(["node_modules", ".git", ".mizzen", "styles", "test", "coverage", "dist"]);
const SOURCE = /\.(ts|tsx|js|mjs|json|md|html|yml|yaml)$/;

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

function walk(dir: string, files: (path: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(path, files, out);
    } else if (files(path) && !path.endsWith("chart.min.js")) out.push(path);
  }
  return out;
}

/** The selector list of one rule, split on the commas outside `()` and `[]`. */
function selectors(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of prelude) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Classes, ids and attribute names a selector needs; tag names and states cannot prove reachability. */
function keys(selector: string): string[] {
  const withoutNot = selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "");
  const found = [
    ...withoutNot.matchAll(/\.([A-Za-z_][\w-]*)/g),
    ...withoutNot.matchAll(/#([A-Za-z_][\w-]*)/g),
    ...withoutNot.matchAll(/\[([A-Za-z_][\w-]*)/g),
  ].map((match) => match[1] ?? "");
  return [...new Set(found.filter((key) => key && !key.includes("\\")))];
}

const camel = (name: string): string => name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

test("every sailcloth selector reaches a rendered fixture or a source reference", () => {
  buildFixture(BUILD);

  const pages = walk(BUILD, (path) => path.endsWith(".html"));
  const rendered = pages.map((path) => readFileSync(path, "utf8")).join("\n");
  const referenced = walk(ROOT, (path) => SOURCE.test(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const reachable = (key: string): boolean => rendered.includes(key) || referenced.includes(key) || referenced.includes(camel(key));

  const dead: { file: string; selector: string; keys: string[] }[] = [];
  for (const file of readdirSync(SRC).filter((name) => name.endsWith(".css") && name !== "ui.css").sort()) {
    const css = stripComments(readFileSync(join(SRC, file), "utf8"));
    for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const prelude = (block[1] ?? "").trim();
      if (prelude.startsWith("@")) continue;
      for (const selector of selectors(prelude)) {
        const needed = keys(selector);
        // shortcut: :is(...) alternatives still need every key, so a rule may stay that only partly applies.
        if (needed.length > 0 && needed.every((key) => !reachable(key))) dead.push({ file, selector, keys: needed });
      }
    }
  }

  const report = join(BUILD, "report.json");
  writeFileSync(report, `${JSON.stringify({ renderedPages: pages.length, dead }, null, 2)}\n`);

  assert.deepEqual(
    dead.map((entry) => `${entry.file}: ${entry.selector}`),
    [],
    `selectors no rendered fixture or source file reaches. Delete the rule, or name the class in the source that applies it. Report: ${relative(ROOT, report)}`,
  );
});
