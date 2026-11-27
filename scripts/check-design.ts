// The design-token gate. Scans the CSS of layouts/, components/, chrome/ and styles/ for raw values that a
// design token should carry: colours, font sizes, shadows, transition times and unscaled z-index values.
// It also reports a declaration written twice in the same rule: a second `property` that overrides an earlier
// value or changes nothing is debt, named by file, selector and line.
// The generated styles/tokens.css is skipped. An exception comes from test/design-allowlist.json, and every
// entry there must carry a written reason; an entry that no longer matches anything is a failure too, so the
// list only holds reviewed, live exceptions. See docs/design/visual-gates.md (#494, #500).
// Usage: node scripts/check-design.ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

/** The folders whose CSS is scanned. */
export const SCANNED = ["layouts", "components", "chrome", "styles"];

/** Sheets that may hold raw values: sailcloth source, its build output, and self-hosted faces. */
export const SKIPPED = new Set([
  "styles/tokens.css",
  "styles/src/ui.css",
  "styles/generated.css",
  "styles/fonts.css",
]);

/** The kinds of raw value the gate finds. */
export type Kind = "colour" | "font-size" | "shadow" | "transition" | "z-index";

/** One raw value found in a stylesheet. */
export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly kind: Kind;
  /** The offending text: the raw value, as written. */
  readonly value: string;
}

/** One reviewed exception. */
export interface AllowEntry {
  readonly file: string;
  readonly kind: Kind;
  readonly value: string;
  readonly reason: string;
}

const KINDS: readonly Kind[] = ["colour", "font-size", "shadow", "transition", "z-index"];

/** The z-index values that need no token: stacking inside one component (`-1`, `0`, `1`) and `auto`. */
const LOCAL_Z = new Set(["auto", "-1", "0", "1"]);

/** Removes comments and string contents, keeping line breaks, so a value in a comment or a `content` is not scanned. */
export function stripNoise(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) => `"${" ".repeat(Math.max(0, m.length - 2))}"`);
}

/** Replaces every `var(...)` call, nested ones included, with blanks: a token reference is the right form. */
function withoutVars(value: string): string {
  let out = value;
  for (let i = 0; i < 6 && out.includes("var("); i++) {
    out = out.replace(/var\([^()]*\)/g, (m) => " ".repeat(m.length));
  }
  return out;
}

/** The raw values in one declaration. A custom property declaration (`--x: ...`) defines a value, so it is scanned too. */
function declarationFindings(property: string, rawValue: string): Array<{ kind: Kind; value: string }> {
  const out: Array<{ kind: Kind; value: string }> = [];
  const value = withoutVars(rawValue);
  const name = property.toLowerCase();

  for (const m of value.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/gi)) {
    out.push({ kind: "colour", value: m[0].trim() });
  }

  if (name === "font-size") {
    for (const m of value.matchAll(/-?\d*\.?\d+(?:px|rem|em|pt|ch|ex|vw|vh|%)/gi)) {
      out.push({ kind: "font-size", value: m[0] });
    }
  } else if (name === "font") {
    const size = value.match(/(?:^|\s)(-?\d*\.?\d+(?:px|rem|em|pt))(?:\s*\/|\s)/i);
    if (size?.[1]) out.push({ kind: "font-size", value: size[1] });
  }

  if (/^(?:box-shadow|text-shadow)$/.test(name) && !/^\s*(?:none|inherit|initial|unset|revert)?\s*$/.test(value)) {
    out.push({ kind: "shadow", value: rawValue.trim() });
  }
  if (name === "filter" || name === "backdrop-filter") {
    for (const m of value.matchAll(/drop-shadow\([^)]*\)/gi)) out.push({ kind: "shadow", value: m[0] });
  }

  if (/^(?:transition|transition-duration|transition-delay|animation|animation-duration|animation-delay)$/.test(name)) {
    for (const m of value.matchAll(/(?<![\w.-])\d*\.?\d+m?s\b/gi)) {
      if (/^0*\.?0*m?s$/i.test(m[0])) continue; // `0s` switches motion off; it is not a time to scale.
      out.push({ kind: "transition", value: m[0] });
    }
  }

  if (name === "z-index") {
    const v = value.trim();
    if (v && !LOCAL_Z.has(v) && !/^(?:inherit|initial|unset|revert)$/.test(v)) out.push({ kind: "z-index", value: v });
  }
  return out;
}

/** One `property: value` declaration, wherever it appears. */
const DECLARATION = /([-\w]+)\s*:\s*((?:[^;{}()]|\([^)]*(?:\([^)]*\)[^)]*)*\))*)(?=[;}]|$)/g;

/** Yields every rule block, at-rules included, and the blocks nested inside them. */
function* ruleBlocks(css: string, offset = 0): Generator<{ selector: string; body: string; start: number }> {
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] !== "{") continue;
    const selector = css.slice(start, i).trim();
    const bodyStart = i + 1;
    let depth = 1;
    let j = bodyStart;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}" && --depth === 0) break;
    }
    const body = css.slice(bodyStart, j);
    yield { selector, body, start: offset + bodyStart };
    yield* ruleBlocks(body, offset + bodyStart);
    i = j;
    start = j + 1;
  }
}

/** A declaration that repeats an earlier one in the same rule. */
export interface Repeat {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  readonly property: string;
  /** The repeated value. */
  readonly value: string;
  /** The value of the earlier declaration it duplicates, as written. */
  readonly earlier: string;
  /** True when the second declaration sets a different value, so the first is overridden. */
  readonly conflict: boolean;
}

/** Every declaration written twice in one rule: a second `property` either overrides an earlier value or does nothing. */
export function scanDuplicates(file: string, css: string): Repeat[] {
  const text = stripNoise(css);
  const repeats: Repeat[] = [];
  for (const { selector, body, start } of ruleBlocks(text)) {
    if (selector.startsWith("@")) continue;
    const seen = new Map<string, string>(); // property -> first value
    for (const m of body.matchAll(DECLARATION)) {
      const property = (m[1] ?? "").toLowerCase();
      const value = (m[2] ?? "").trim();
      const earlier = seen.get(property);
      if (earlier === undefined) {
        seen.set(property, value);
        continue;
      }
      const line = text.slice(0, start + (m.index ?? 0)).split("\n").length;
      const conflict = earlier.replace(/\s+/g, " ") !== value.replace(/\s+/g, " ");
      repeats.push({ file, line, selector, property, value, earlier, conflict });
    }
  }
  return repeats;
}

/** Every raw value in one stylesheet's text. */
export function scanCss(file: string, css: string): Finding[] {
  const text = stripNoise(css);
  const findings: Finding[] = [];
  for (const m of text.matchAll(DECLARATION)) {
    const property = m[1] ?? "";
    const value = m[2] ?? "";
    const line = text.slice(0, m.index).split("\n").length;
    for (const f of declarationFindings(property, value)) findings.push({ file, line, ...f });
  }
  return findings;
}

/** Every CSS file under the scanned folders, as repo-relative paths, sorted, without the generated token sheet.
    The sailcloth source directory (styles/src/, split by #863) may hold raw values, like its entry sheet, except theme.css (#1288). */
export function cssFiles(base: string = root): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".css")) out.push(relative(base, path).split("\\").join("/"));
    }
  };
  for (const dir of SCANNED) if (existsSync(join(base, dir))) walk(join(base, dir));
  return out.filter((f) => !SKIPPED.has(f) && (!f.startsWith("styles/src/") || f === "styles/src/theme.css")).sort();
}

/** Shared sheets whose selectors must name their cascade owner; a bare element here reaches every unit. */
export const SCOPED_SHEETS = ["styles/src/overrides.css", "styles/src/primitives.css"];

/** One selector in a shared sheet that does not name its root. */
export interface UnscopedSelector {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
}

/** A selector owns its cascade when its leftmost compound is a class, an id, or a data attribute. */
function rootScoped(selector: string): boolean {
  const s = selector.trim();
  if (s === "") return false;
  if (/^(?:html|body|:root)\b/.test(s)) return true; // the document root, not a unit
  if (/^[.#]/.test(s)) return true;
  if (/^\[data-[\w-]+/.test(s)) return true;
  if (/^[\w*-]+[.#]/.test(s)) return true; // a type-qualified class, like `a.home-btn`
  const fn = /^:(?:where|is)\(([^)]*)\)/.exec(s);
  return fn?.[1] !== undefined && fn[1].split(",").every(rootScoped);
}

/** Selectors at the top level of one prelude, keeping commas inside :is()/:where()/:not() together. */
function selectorsOf(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < prelude.length; i += 1) {
    const ch = prelude[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      out.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  out.push(prelude.slice(start));
  return out.map((s) => s.trim()).filter((s) => s !== "");
}

/** The selectors in one shared sheet that do not name their unit root. */
export function unscopedSelectors(file: string, css: string): UnscopedSelector[] {
  const text = stripNoise(css);
  const found: UnscopedSelector[] = [];
  for (const m of text.matchAll(/([^{}]+)\{/g)) {
    const prelude = (m[1] ?? "").trim();
    if (prelude.startsWith("@")) continue;
    if (/^(?:from|to|-?\d*\.?\d+%)$/i.test(prelude)) continue; // keyframe steps
    const lead = (m[1] ?? "").indexOf(prelude);
    const rawPrelude = css.slice(m.index + lead, m.index + lead + prelude.length);
    const clean = selectorsOf(prelude);
    const line = text.slice(0, m.index + lead).split("\n").length;
    selectorsOf(rawPrelude).forEach((selector, i) => {
      if (!rootScoped(clean[i] ?? selector)) found.push({ file, line, selector });
    });
  }
  return found;
}

/** Every unscoped selector in the shared sheets of a checkout. */
export function globalSelectorFindings(base: string = root): UnscopedSelector[] {
  return SCOPED_SHEETS.flatMap((file) =>
    existsSync(join(base, file)) ? unscopedSelectors(file, readFileSync(join(base, file), "utf8")) : [],
  );
}

/** The problems with the allowlist itself: bad shape, an unknown kind, an empty reason, a duplicate. */
export function allowlistProblems(entries: unknown): string[] {
  if (!Array.isArray(entries)) return ["the allowlist must be a JSON array"];
  const problems: string[] = [];
  const seen = new Set<string>();
  entries.forEach((entry: unknown, i) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const where = `allowlist entry ${i + 1}`;
    for (const key of ["file", "kind", "value", "reason"]) {
      if (typeof e[key] !== "string" || (e[key] as string).trim() === "") {
        problems.push(key === "reason" ? `${where} has no written reason` : `${where} needs a non-empty "${key}"`);
      }
    }
    if (typeof e.kind === "string" && !KINDS.includes(e.kind as Kind)) problems.push(`${where} has an unknown kind "${e.kind}"`);
    const id = `${String(e.file)}|${String(e.kind)}|${String(e.value)}`;
    if (seen.has(id)) problems.push(`${where} duplicates an earlier entry`);
    seen.add(id);
  });
  return problems;
}

/** Applies the allowlist: the findings it does not cover, and the entries that cover nothing. */
export function applyAllowlist(findings: readonly Finding[], entries: readonly AllowEntry[]): { violations: Finding[]; stale: AllowEntry[] } {
  const used = new Set<AllowEntry>();
  const violations = findings.filter((f) => {
    const hit = entries.find((e) => e.file === f.file && e.kind === f.kind && e.value === f.value);
    if (hit) used.add(hit);
    return !hit;
  });
  return { violations, stale: entries.filter((e) => !used.has(e)) };
}

/** Runs the whole gate over a checkout and returns the lines to print; none means it passes. */
export function check(base: string = root, allowlistPath: string = join(base, "test/design-allowlist.json")): string[] {
  const lines: string[] = [];
  let entries: unknown = [];
  if (existsSync(allowlistPath)) {
    try {
      entries = JSON.parse(readFileSync(allowlistPath, "utf8"));
    } catch (error) {
      return [`the allowlist is not valid JSON: ${(error as Error).message}`];
    }
  }
  const shape = allowlistProblems(entries);
  if (shape.length > 0) return shape;

  const sheets = cssFiles(base).map((file) => ({ file, css: readFileSync(join(base, file), "utf8") }));
  const findings = sheets.flatMap(({ file, css }) => scanCss(file, css));
  const { violations, stale } = applyAllowlist(findings, entries as AllowEntry[]);
  for (const v of violations) lines.push(`${v.file}:${v.line}: raw ${v.kind} \`${v.value}\`; use a design token or add a reviewed entry to test/design-allowlist.json`);
  for (const r of sheets.flatMap(({ file, css }) => scanDuplicates(file, css))) {
    const what = r.conflict
      ? `conflicting declaration \`${r.property}: ${r.value}\` overrides \`${r.property}: ${r.earlier}\``
      : `duplicate declaration \`${r.property}: ${r.value}\` changes nothing`;
    lines.push(`${r.file}:${r.line}: ${what} in \`${r.selector}\`; keep one`);
  }
  for (const e of stale) lines.push(`stale allowlist entry: ${e.file} ${e.kind} \`${e.value}\` matches nothing; remove it`);
  for (const s of globalSelectorFindings(base)) lines.push(`${s.file}:${s.line}: unscoped selector \`${s.selector}\`; scope it to its unit root`);
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = check();
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(`\ncheck:design failed with ${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
    process.exit(1);
  }
  console.log("check:design passed.");
}
