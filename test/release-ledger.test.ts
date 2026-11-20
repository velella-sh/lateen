import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stringify } from "yaml";
import { ledgerOf, releaseLedger, type ReleaseLedger } from "../scripts/release-ledger.ts";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const schema = JSON.parse(readFileSync(new URL("../schema/release-ledger.schema.json", import.meta.url), "utf8")) as JsonSchema;
const commit = "0123456789abcdef0123456789abcdef01234567";
const run = "https://github.com/velella-sh/lateen/actions/runs/123";
const npm = "https://www.npmjs.com/package/@velella/lateen/v/0.2.3";
const sha256 = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

interface FixtureOptions {
  readonly acceptance?: Record<string, unknown>;
  readonly published?: Record<string, unknown> | null;
  readonly a11yHash?: string;
  readonly run?: string | null;
}

/** A temporary release with a real tarball, reports, and an archive index. */
function fixture(options: FixtureOptions = {}): { dir: string; args: string[]; digest: string } {
  const dir = mkdtempSync(join(tmpdir(), "lateen-ledger-"));
  const tarball = join(dir, "lateen-0.2.3.tgz");
  writeFileSync(tarball, "candidate bytes");
  const digest = sha256(tarball);
  const report = { commit, digest, mizzen: "0.2.9", tarball: "lateen-0.2.3.tgz", ok: true, cases: [] };
  const acceptance = join(dir, "acceptance.json");
  writeFileSync(acceptance, JSON.stringify({ ...report, ...options.acceptance }));
  const published = join(dir, "published.json");
  if (options.published !== null) writeFileSync(published, JSON.stringify({ ...report, ...options.published }));

  const a11y = join(dir, "a11y.json");
  const performance = join(dir, "performance.json");
  writeFileSync(a11y, JSON.stringify({ tool: "lateen/a11y-report", version: 1 }));
  writeFileSync(performance, JSON.stringify({ tool: "lateen/performance-report", version: 1 }));
  const reports = join(dir, "site/_data/reports");
  mkdirSync(reports, { recursive: true });
  writeFileSync(
    join(reports, "index.yml"),
    stringify(
      {
        releases: [
          {
            version: "0.2.3",
            a11y: { file: "a11y.json", sha256: options.a11yHash ?? sha256(a11y) },
            performance: { file: "performance.json", sha256: sha256(performance) },
            totals: { javascript: 921751, css: 482144 },
          },
        ],
      },
      { lineWidth: 0 },
    ),
  );

  const args = [
    "--version",
    "0.2.3",
    "--acceptance",
    acceptance,
    "--published",
    published,
    "--tarball",
    tarball,
    "--a11y",
    a11y,
    "--performance",
    performance,
    ...(options.run === null ? [] : ["--run", options.run ?? run]),
    "--out",
    join(dir, "ledger.json"),
  ];
  return { dir, args, digest };
}

function withFixture(options: FixtureOptions, check: (fixture: { dir: string; args: string[]; digest: string }) => void): void {
  const created = fixture(options);
  try {
    check(created);
  } finally {
    rmSync(created.dir, { recursive: true, force: true });
  }
}

test("a complete set of evidence writes one schema-valid ledger", () => {
  withFixture({}, ({ dir, args, digest }) => {
    const ledger = releaseLedger(args, dir);
    const expected: ReleaseLedger = {
      tool: "lateen/release-ledger",
      version: 1,
      release: { version: "0.2.3", commit, mizzen: "0.2.9", npm, run },
      tarball: { candidate: `sha256:${digest}`, published: `sha256:${digest}` },
      evidence: {
        acceptance: run,
        published: run,
        accessibility: "/reports/0.2.3/a11y.json",
        performance: "/reports/0.2.3/performance.json",
      },
      complete: true,
      problems: [],
    };
    assert.deepEqual(ledger, expected);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "ledger.json"), "utf8")), expected);
    assert.deepEqual(validate(schema, ledger), []);
  });
});

test("a tarball whose digest is not the acceptance digest is incomplete", () => {
  withFixture({ acceptance: { digest: "a".repeat(64) }, published: { digest: "a".repeat(64) } }, ({ dir, args }) => {
    const ledger = releaseLedger(args, dir);
    assert.equal(ledger.complete, false);
    assert.match(ledger.problems.join("\n"), /the candidate tarball's sha256 .* is not the acceptance report's digest/);
  });
});

test("a missing or failed published report is incomplete", () => {
  withFixture({ published: null }, ({ dir, args }) => {
    const ledger = releaseLedger(args, dir);
    assert.equal(ledger.complete, false);
    assert.match(ledger.problems.join("\n"), /the published report is missing/);
  });
  withFixture({ published: { ok: false } }, ({ dir, args }) => {
    const ledger = releaseLedger(args, dir);
    assert.equal(ledger.complete, false);
    assert.match(ledger.problems.join("\n"), /the published run did not pass/);
  });
});

test("a commit or Mizzen version that differs between the runs is incomplete", () => {
  withFixture({ published: { commit: "fedcba9876543210fedcba9876543210fedcba98" } }, ({ dir, args }) => {
    const ledger = releaseLedger(args, dir);
    assert.equal(ledger.complete, false);
    assert.match(ledger.problems.join("\n"), /the published report is for commit/);
  });
  withFixture({ published: { mizzen: "0.2.8" } }, ({ dir, args }) => {
    const ledger = releaseLedger(args, dir);
    assert.equal(ledger.complete, false);
    assert.match(ledger.problems.join("\n"), /the published report used Mizzen "0\.2\.8", not "0\.2\.9"/);
  });
  withFixture({ acceptance: { commit: "HEAD", mizzen: "^0.2.9" }, published: { commit: "HEAD", mizzen: "^0.2.9" } }, ({ dir, args }) => {
    const ledger = releaseLedger(args, dir);
    assert.equal(ledger.complete, false);
    assert.match(ledger.problems.join("\n"), /is not 7-40 lowercase hex characters/);
    assert.match(ledger.problems.join("\n"), /is not an exact version/);
  });
});

test("a run or npm URL that is not https is incomplete", () => {
  withFixture({ run: "http://github.com/velella-sh/lateen/actions/runs/123" }, ({ dir, args }) => {
    const ledger = releaseLedger(args, dir);
    assert.equal(ledger.complete, false);
    assert.match(ledger.problems.join("\n"), /is not an https URL/);
  });
});

test("an accessibility report that differs from the archived hash is incomplete", () => {
  withFixture({ a11yHash: "0".repeat(64) }, ({ dir, args }) => {
    const ledger = releaseLedger(args, dir);
    assert.equal(ledger.complete, false);
    assert.match(ledger.problems.join("\n"), /the accessibility report's sha256 .* is not the archived sha256/);
  });
});

test("the ledger schema refuses a ledger with the wrong types", () => {
  const { ledger } = ledgerOf({ version: "0.2.3", run, npm, tarball: "a".repeat(64) });
  assert.deepEqual(validate(schema, ledger), []);
  assert.ok(validate(schema, { ...ledger, complete: "yes" }).length > 0);
  assert.ok(validate(schema, { ...ledger, problems: [1] }).length > 0);
  assert.ok(validate(schema, { ...ledger, tool: "lateen/other" }).length > 0);
});
