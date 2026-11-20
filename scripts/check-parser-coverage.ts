// Focused branch gate for the parser and guard modules the debt program calls risky. It stays out of
// `npm test`: a normal run gets the same tests, and this only adds the measurement and threshold.
import { spawnSync } from "node:child_process";

const THRESHOLD = 100;

const MODULES = ["url.ts", "guards.ts", "dates.ts", "evidence.ts", "report-schema.ts"];
const TESTS = [
  "test/url.test.ts",
  "test/guards.test.ts",
  "test/dates.test.ts",
  "test/record-evidence.test.ts",
  "test/report-schemas.test.ts",
];

const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--experimental-test-coverage",
    ...MODULES.map((module) => `--test-coverage-include=src/${module}`),
    "--test-reporter=spec",
    ...TESTS,
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

interface Row {
  readonly branch: number;
  readonly uncovered: string;
}

const rows = new Map<string, Row>();
for (const line of output.split("\n")) {
  const match = /^\s*(?:ℹ\s+)?([\w.-]+\.ts)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(.*)$/.exec(line);
  if (match === null || !MODULES.includes(match[1]!)) continue;
  rows.set(match[1]!, { branch: Number(match[3]), uncovered: match[5]!.trim() });
}

if (result.status !== 0) {
  console.error("the focused parser tests failed");
  console.error(output);
  process.exit(1);
}

let failed = false;
for (const module of MODULES) {
  const row = rows.get(module);
  if (row === undefined) {
    console.error(`${module}: no coverage row`);
    failed = true;
    continue;
  }
  const status = row.branch >= THRESHOLD ? "ok  " : "FAIL";
  console.log(`${status} ${module.padEnd(16)} branch ${row.branch.toFixed(2)}%${row.uncovered === "" ? "" : `  uncovered: ${row.uncovered}`}`);
  if (row.branch < THRESHOLD) failed = true;
}

if (failed) {
  console.error(`parser branch coverage is below ${THRESHOLD}%`);
  process.exit(1);
}
console.log(`all ${MODULES.length} parser modules at ${THRESHOLD}% branch coverage`);
