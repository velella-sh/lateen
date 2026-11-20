// Proves the security- and correctness-critical guard tests fail when their guard is reversed.
// Opt-in and slow: `npm run test:mutation` (never part of `npm test`). Each mutation edits one
// source file in place, runs one focused test, requires a real assertion failure, then restores
// the file in `finally`. Built output is never touched.
// Usage: node scripts/mutation-check.ts [--list]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

interface Mutation {
  /** The guarantee under test, so a failure report names it. */
  readonly guard: "url" | "path" | "duplicate-id" | "evidence";
  readonly name: string;
  readonly file: string;
  /** The guard text; it must occur exactly once so a mutation cannot hit the wrong line. */
  readonly find: string;
  readonly replace: string;
  readonly test: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    guard: "url",
    name: "safeHref returns every value, including javascript: and data:",
    file: "src/url.ts",
    find: "  return href !== undefined && new RegExp(safeHrefSource(protocols, relative), \"i\").test(href) ? href : undefined;",
    replace: "  return href;",
    test: "test/url.test.ts",
  },
  {
    guard: "path",
    name: "basePath keeps the trailing slash, so a base joins paths twice",
    file: "src/url.ts",
    find: "  return base.endsWith(\"/\") ? base.slice(0, -1) : base;",
    replace: "  return base;",
    test: "test/url.test.ts",
  },
  {
    guard: "duplicate-id",
    name: "uniqueNodeId drops the numeric suffix for a repeated path",
    file: "components/file-tree/index.ts",
    find: "  for (let n = 2; used.has(unique); n += 1) unique = `${id}-${n}`;\n",
    replace: "",
    test: "test/component-file-tree.test.ts",
  },
  {
    guard: "evidence",
    name: "claimsOf accepts an unsafe evidence URL",
    file: "src/evidence.ts",
    find: "    if (typeof url !== \"string\" || !SAFE_URL.test(url)) continue;",
    replace: "    if (typeof url !== \"string\") continue;",
    test: "test/record-evidence.test.ts",
  },
];

if (process.argv.includes("--list")) {
  for (const mutation of MUTATIONS) console.log(`${mutation.guard}\t${mutation.name}`);
  process.exit(0);
}

/** The file currently mutated, so a signal restores it before the process exits. */
let pending: { readonly path: string; readonly original: string } | undefined;

function restore(): void {
  if (pending !== undefined) writeFileSync(pending.path, pending.original);
  pending = undefined;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}

let failures = 0;

for (const mutation of MUTATIONS) {
  const path = join(root, mutation.file);
  const original = readFileSync(path, "utf8");
  const count = original.split(mutation.find).length - 1;
  if (count !== 1) {
    console.error(`✗ ${mutation.name}: expected 1 match in ${mutation.file}, found ${count}`);
    failures += 1;
    continue;
  }

  try {
    pending = { path, original };
    writeFileSync(path, original.replace(mutation.find, mutation.replace));
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", mutation.test], {
      cwd: root,
      encoding: "utf8",
    });
    const output = `${run.stdout}${run.stderr}`;
    if (run.status === 0) {
      console.error(`✗ ${mutation.name}: ${mutation.test} passed under mutation`);
      failures += 1;
    } else if (!/^not ok /m.test(output)) {
      console.error(`✗ ${mutation.name}: ${mutation.test} did not fail an assertion (exit ${run.status})`);
      failures += 1;
    } else {
      console.log(`✓ ${mutation.guard}: ${mutation.name} — ${mutation.test} failed as required`);
    }
  } finally {
    restore();
  }

  if (readFileSync(path, "utf8") !== original) {
    console.error(`✗ ${mutation.name}: ${mutation.file} was not restored`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} mutation check(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${MUTATIONS.length} mutations were caught by their focused tests`);
