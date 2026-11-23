// The type ratchet. Counts raw `font-size` and `line-height` values and Tailwind `text-*` size utilities in
// the sailcloth source (`styles/src/`), which the design-token gate does not scan. The counts may only fall:
// a new raw value fails, and a lower count must be written to test/type-ratchet.json so it cannot grow back.
// Usage: node scripts/check-type-ratchet.ts [--write]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripNoise } from "./check-design.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const SOURCE = join(root, "styles/src");
const BASELINE = join(root, "test/type-ratchet.json");
const SKIPPED = new Set(["ui.css"]);

export interface Counts {
  readonly "font-size": number;
  readonly "line-height": number;
  readonly "text-utility": number;
}

const KEYWORDS = /^(inherit|initial|unset|revert|normal|none)$/;

/** Counts the raw values in one stylesheet's text. */
export function countRaw(css: string): Counts {
  const text = stripNoise(css);
  let fontSize = 0;
  let lineHeight = 0;
  for (const match of text.matchAll(/(?<![\w-])(font-size|line-height)\s*:\s*([^;}]+)/g)) {
    const value = (match[2] ?? "").trim();
    if (value.includes("var(") || KEYWORDS.test(value)) continue;
    if (match[1] === "font-size") fontSize += 1;
    else lineHeight += 1;
  }
  let utility = 0;
  for (const match of text.matchAll(/@apply\s+([^;}]+)/g)) {
    utility += (match[1] ?? "").split(/\s+/).filter((name) => /^(?:[\w-]+:)*text-(?:xs|sm|base|lg|xl|[2-9]xl)$/.test(name)).length;
  }
  return { "font-size": fontSize, "line-height": lineHeight, "text-utility": utility };
}

/** Counts the raw values across the sailcloth source. */
export function countSource(dir = SOURCE): Counts {
  const total = { "font-size": 0, "line-height": 0, "text-utility": 0 };
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".css") && !SKIPPED.has(name)).sort()) {
    const counts = countRaw(readFileSync(join(dir, file), "utf8"));
    for (const key of Object.keys(total) as (keyof Counts)[]) total[key] += counts[key];
  }
  return total;
}

/** The problems of a count against its baseline; empty when it holds. */
export function compare(counts: Counts, baseline: Counts): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(baseline) as (keyof Counts)[]) {
    if (counts[key] > baseline[key]) problems.push(`${key}: ${counts[key]} raw values, over the baseline of ${baseline[key]}. Use a --type-* token.`);
    else if (counts[key] < baseline[key]) problems.push(`${key}: ${counts[key]} raw values, under the baseline of ${baseline[key]}. Lower test/type-ratchet.json (node scripts/check-type-ratchet.ts --write).`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const counts = countSource();
  if (process.argv.includes("--write")) {
    writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`wrote ${BASELINE}`);
  } else {
    const problems = compare(counts, JSON.parse(readFileSync(BASELINE, "utf8")) as Counts);
    if (problems.length > 0) {
      for (const problem of problems) console.error(problem);
      process.exit(1);
    }
    console.log("check:type-ratchet passed.");
  }
}
