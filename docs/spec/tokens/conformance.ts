// Checks that a package declares every public token of the spec (v1.md) with a value of the right type.
// It reads `docs/spec/tokens/v1.md` and `styles/tokens.css` from the package directory, so it runs against a
// checkout or against an installed copy: `node node_modules/@velella/lateen/docs/spec/tokens/conformance.ts`.
// Usage: node conformance.ts [package-dir]   (default: the package this file is in)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** One public token of the spec. */
export interface SpecToken {
  readonly name: string;
  readonly type: string;
}

const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\(.*\)|hsla?\(.*\)|oklch\(.*\)|color-mix\(.*\)|transparent|currentcolor)$/i;
const LENGTH = /^(0|-?[\d.]+(rem|px|em|vw|vh|ch|%)|clamp\(.*\)|calc\(.*\)|min\(.*\)|max\(.*\))$/;

const CHECKS: Record<string, (value: string) => boolean> = {
  color: (value) => {
    const light = /^light-dark\((.*)\)$/.exec(value);
    if (light === null) return COLOUR.test(value);
    const parts = splitTop(light[1] ?? "");
    return parts.length === 2 && parts.every((part) => COLOUR.test(part) || part.startsWith("var("));
  },
  length: (value) => LENGTH.test(value) || value === "normal",
  number: (value) => /^-?[\d.]+$/.test(value),
  duration: (value) => /^-?[\d.]+m?s$/.test(value) || value === "0s",
  easing: (value) => /^(cubic-bezier\(.*\)|linear\(.*\)|ease|ease-in|ease-out|ease-in-out|linear)$/.test(value),
  shadow: (value) => value === "none" || /\d/.test(value),
  "font-family": (value) => value.length > 0 && !value.startsWith("var("),
  integer: (value) => /^-?\d+$/.test(value),
  keyword: (value) => value.length > 0,
};

function splitTop(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out;
}

/** The public tokens listed under `## Tokens` of the spec. */
export function specTokens(markdown: string): SpecToken[] {
  const body = markdown.split("\n## Tokens")[1]?.split("\n## Deprecated names")[0] ?? "";
  const rows: SpecToken[] = [];
  for (const line of body.split("\n")) {
    const match = /^\| `(--[a-z0-9-]+)` \| ([a-z-]+) \|/.exec(line);
    if (match !== null) rows.push({ name: match[1] as string, type: match[2] as string });
  }
  return rows;
}

/** The deprecated names listed in the spec. */
export function deprecatedNames(markdown: string): string[] {
  const body = markdown.split("\n## Deprecated names")[1] ?? "";
  return [...body.matchAll(/^\| `(--[a-z0-9-]+)` \| `--[a-z0-9-]+` \|/gm)].map((match) => match[1] as string);
}

/** The declarations of the `:root` block of the generated token sheet. */
export function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of css.matchAll(/^\s+(--[a-z0-9-]+):\s*(.+);$/gm)) out.set(match[1] as string, (match[2] as string).trim());
  return out;
}

/** Follows `var(--x)` pointers until a literal; a `light-dark()` of pointers stays as it is. */
export function resolve(name: string, values: ReadonlyMap<string, string>, seen: readonly string[] = []): string | undefined {
  const value = values.get(name);
  if (value === undefined || seen.includes(name)) return undefined;
  const pointer = /^var\((--[a-z0-9-]+)\)$/.exec(value);
  return pointer === null ? value : resolve(pointer[1] as string, values, [...seen, name]);
}

/** Every way the package falls short of the spec; empty when it conforms. */
export function conformance(dir: string): string[] {
  const spec = join(dir, "docs/spec/tokens/v1.md");
  const sheet = join(dir, "styles/tokens.css");
  if (!existsSync(spec)) return [`missing ${spec}`];
  if (!existsSync(sheet)) return [`missing ${sheet}`];
  const values = declarations(readFileSync(sheet, "utf8"));
  const problems: string[] = [];
  const tokens = specTokens(readFileSync(spec, "utf8"));
  if (tokens.length === 0) problems.push("the spec lists no tokens");
  for (const { name, type } of tokens) {
    const check = CHECKS[type];
    if (check === undefined) {
      problems.push(`${name}: the spec uses an unknown type "${type}"`);
      continue;
    }
    const value = values.get(name);
    if (value === undefined) {
      problems.push(`${name}: not declared in styles/tokens.css`);
      continue;
    }
    const literal = type === "color" && value.startsWith("light-dark(")
      ? value.replace(/var\((--[a-z0-9-]+)\)/g, (_all, ref: string) => resolve(ref, values)?.replace(/^light-dark\((.*)\)$/, (_x, inner: string) => splitTop(inner)[0] ?? "") ?? "")
      : resolve(name, values);
    if (literal === undefined || !check(literal)) problems.push(`${name}: "${value}" is not a ${type}`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? fileURLToPath(new URL("../../../", import.meta.url));
  const problems = conformance(dir);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(`${problems.length} token problem(s) in ${dir}`);
    process.exit(1);
  }
  console.log(`token spec v1: conforms (${dir})`);
}
