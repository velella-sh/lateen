/**
 * Turns an lcov report into the JSON that shields.io's endpoint badge reads.
 *
 *   node scripts/coverage-badge.ts coverage/lcov.info coverage/coverage.json
 *
 * CI runs this on main and publishes the JSON to the `badges` branch, which the README badge points
 * at, so the number follows the code without anyone editing the README.
 */
import { readFile, writeFile } from "node:fs/promises";

/** Count each instrumented source line once, even when Node lists the same source more than once. */
export function lineCoverage(lcov: string): number | undefined {
  const sources = new Map<string, Map<string, boolean>>();
  let lines: Map<string, boolean> | undefined;
  for (const entry of lcov.split(/\r?\n/)) {
    if (entry.startsWith("SF:")) {
      const source = entry.slice(3);
      lines = sources.get(source) ?? new Map();
      sources.set(source, lines);
    } else if (entry === "end_of_record") {
      lines = undefined;
    } else if (lines && entry.startsWith("DA:")) {
      const [line, hits] = entry.slice(3).split(",", 2);
      if (line && hits !== undefined) lines.set(line, lines.get(line) === true || Number(hits) > 0);
    }
  }

  let found = 0;
  let hit = 0;
  for (const source of sources.values()) {
    found += source.size;
    for (const covered of source.values()) if (covered) hit++;
  }
  return found > 0 ? (hit / found) * 100 : undefined;
}

function colorFor(percent: number): string {
  if (percent >= 95) return "4C6F9A";
  if (percent >= 90) return "97CA00";
  if (percent >= 75) return "DFB317";
  return "E05D44";
}

const [input, output, extra] = process.argv.slice(2);
if (!input || !output || extra !== undefined) {
  process.stderr.write("Usage: coverage-badge <lcov.info> <badge.json>\n");
  process.exit(1);
}
const percent = lineCoverage(await readFile(input, "utf8"));
if (percent === undefined) {
  process.stderr.write("The lcov report has no instrumented lines.\n");
  process.exit(1);
}
const badge = { schemaVersion: 1, label: "coverage", message: `${Math.floor(percent)}%`, color: colorFor(percent) };
await writeFile(output, `${JSON.stringify(badge)}\n`);
process.stdout.write(`Line coverage by source file: ${percent.toFixed(2)}%\n`);
