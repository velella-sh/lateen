// Renders the per-preset contrast table of site/tokens.md from the token files and the presets, so the page
// cannot drift from the build. `node scripts/token-contrast.ts` checks the page; `--write` rewrites the table.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { brandTokens, DEFAULT_COLORS, presetNames, resolveBrand } from "../src/brand.ts";
import { contrast, parseHex } from "../src/color.ts";

const PAGE = fileURLToPath(new URL("../site/tokens.md", import.meta.url));
export const START = "<!-- token-contrast:start -->";
export const END = "<!-- token-contrast:end -->";

/** The pairs a preset must keep: foreground role, background role. */
export const PAIRS = [
  ["brand", "canvas"],
  ["on-brand", "brand"],
  ["text", "brand-subtle"],
  ["brand", "brand-subtle"],
] as const;

/** The contrast ratio of one pair under a preset and a scheme. */
export function ratio(preset: string, scheme: "light" | "dark", fg: string, bg: string): number {
  const { brand } = resolveBrand({ preset });
  if (brand === undefined) throw new Error(`unknown preset ${preset}`);
  const tokens = brandTokens(brand);
  const pick = (role: string): string => tokens[`color-${role}`]?.[scheme] ?? (DEFAULT_COLORS[scheme] as Record<string, string>)[role] ?? "";
  const a = parseHex(pick(fg));
  const b = parseHex(pick(bg));
  if (a === undefined || b === undefined) throw new Error(`${preset} ${scheme}: ${fg} or ${bg} is not a hex colour`);
  return contrast(a, b);
}

/** The Markdown table: one row per preset, one column per pair and scheme. */
export function contrastTable(): string {
  const head = ["Preset", ...PAIRS.flatMap(([fg, bg]) => [`${fg} on ${bg} (light)`, `${fg} on ${bg} (dark)`])];
  const rows = presetNames().map((name) => [
    name,
    ...PAIRS.flatMap(([fg, bg]) => (["light", "dark"] as const).map((scheme) => `${ratio(name, scheme, fg, bg).toFixed(2)}:1`)),
  ]);
  const line = (cells: string[]): string => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
}

/** The page with its table replaced by the current one. */
export function renderPage(page: string): string {
  const from = page.indexOf(START);
  const to = page.indexOf(END);
  if (from < 0 || to < from) throw new Error("site/tokens.md has no token-contrast markers");
  return `${page.slice(0, from + START.length)}\n${contrastTable()}\n${page.slice(to)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const page = readFileSync(PAGE, "utf8");
  const next = renderPage(page);
  if (process.argv.includes("--write")) writeFileSync(PAGE, next);
  else if (next !== page) {
    console.error("site/tokens.md is stale: run node scripts/token-contrast.ts --write");
    process.exit(1);
  }
}
