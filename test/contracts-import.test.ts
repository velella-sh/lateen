import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  Collection,
  LayoutProps,
  ListProps,
  Page,
  PageRecord,
  RecordProps,
  Site,
} from "@velella/mizzen/contracts";

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

// Compile-time only: `npm run typecheck` fails if the engine drops one of these members or changes
// its type, which is the point at which the theme's record layouts must be revisited.
type DataContract = [
  Assert<Same<Site["collections"], Readonly<Record<string, Collection>>>>,
  Assert<Same<Page["record"], PageRecord | undefined>>,
  Assert<Same<LayoutProps["record"], RecordProps | undefined>>,
  Assert<Same<LayoutProps["list"], ListProps | undefined>>,
];

const root = fileURLToPath(new URL("../", import.meta.url));
const SOURCE = new Set([".ts", ".tsx", ".mts", ".js", ".mjs"]);
const SPECIFIER = /\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name !== "node_modules") walk(join(dir, e.name), out);
    } else if (SOURCE.has(extname(e.name))) out.push(join(dir, e.name));
  }
  return out;
}

// The theme reaches the engine only through `@velella/mizzen/contracts`, by package name,
// so it keeps working when the two packages live in separate repositories.
test("the theme imports the engine only as @velella/mizzen/contracts, never by relative path", () => {
  const bad: string[] = [];
  for (const file of walk(root)) {
    for (const m of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
      const spec = m[1] ?? "";
      const relativeEngine = spec.startsWith(".") && /(?:^|\/)engine(?:\/|$)/.test(spec);
      const otherEngineEntry = spec.startsWith("@velella/mizzen") && spec !== "@velella/mizzen/contracts";
      if (relativeEngine || otherEngineEntry) bad.push(`${file.slice(root.length)}: ${spec}`);
    }
  }
  assert.deepEqual(bad, []);
});
