// The public acceptance gate: packs this checkout (or a published theme), installs the tarball and
// an exact Mizzen version into an empty project, builds test/acceptance/site with the installed
// `mizzen` command, serves the output and runs the acceptance cases from test/acceptance/cases.ts.
// Nothing in the build reaches back into the checkout, so a case cannot pass on a repository-only
// shortcut.
//
// `npm run test:acceptance` is the pull-request form. The release workflow runs the same script,
// uploads its report, gates `npm publish` on it, and runs it again with `--theme <published spec>`.
//
// Setup: npm ci && npx playwright install chromium
// Usage: node scripts/acceptance.ts [--report <file>] [--theme <spec>]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { CASES, type Expectation } from "../test/acceptance/cases.ts";
import { gateProblems, ledgerProblems, changelogProblems, type AcceptanceReport, type FeatureLedger } from "../test/acceptance/ledger.ts";
import { startServer } from "../visual/index.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SITE = join(ROOT, "test/acceptance/site");
const LEDGER = JSON.parse(readFileSync(join(ROOT, "test/acceptance/features.json"), "utf8")) as FeatureLedger;

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function sh(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function pack(spec: string | undefined, into: string): string {
  const args = spec === undefined ? ["pack", "--json", "--pack-destination", into] : ["pack", spec, "--json", "--pack-destination", into];
  const output = JSON.parse(sh("npm", args, ROOT)) as Record<string, { filename: string }>;
  // npm 12 keys pack results by package name. Older versions return an array.
  const [tarball] = Object.values(output);
  if (!tarball) throw new Error("npm pack produced no tarball");
  return join(into, tarball.filename);
}

/** The exact installed engine, not the range in package.json. */
function mizzenVersion(): string {
  const file = join(ROOT, "node_modules/@velella/mizzen/package.json");
  return (JSON.parse(readFileSync(file, "utf8")) as { version: string }).version;
}

function commit(): string {
  return process.env.GITHUB_SHA ?? sh("git", ["rev-parse", "HEAD"], ROOT).trim();
}

async function check(page: Page, expectation: Expectation): Promise<string | undefined> {
  const all = page.locator(expectation.selector);
  const locator = expectation.visible === false ? all : all.filter({ visible: true });
  const count = await locator.count();
  if (expectation.count !== undefined && count !== expectation.count) {
    return `${expectation.selector}: expected ${expectation.count} element(s), found ${count}`;
  }
  if (expectation.count === undefined && count === 0) return `${expectation.selector} is missing`;
  if (expectation.text !== undefined) {
    const text = (await locator.first().textContent()) ?? "";
    if (!text.includes(expectation.text)) return `${expectation.selector}: expected text ${JSON.stringify(expectation.text)}, found ${JSON.stringify(text.trim())}`;
  }
  if (expectation.hrefIncludes !== undefined) {
    const href = (await locator.first().getAttribute("href")) ?? "";
    if (!href.includes(expectation.hrefIncludes)) return `${expectation.selector}: expected an href with ${JSON.stringify(expectation.hrefIncludes)}, found ${JSON.stringify(href)}`;
  }
  return undefined;
}

/** Runs one page check, retrying briefly so an island that settles after the click is seen. */
async function eventually(page: Page, expectation: Expectation): Promise<string | undefined> {
  let problem = await check(page, expectation);
  for (let attempt = 0; problem !== undefined && attempt < 20; attempt += 1) {
    await new Promise((done) => setTimeout(done, 100));
    problem = await check(page, expectation);
  }
  return problem;
}

async function run(browser: Browser, base: string): Promise<AcceptanceReport["cases"]> {
  const results: AcceptanceReport["cases"] = [];
  for (const testCase of CASES) {
    const page = await browser.newPage();
    try {
      await page.goto(`${base}${testCase.path}`, { waitUntil: "load" });
      let problem: string | undefined;
      for (const expectation of testCase.expect) {
        problem = await eventually(page, expectation);
        if (problem !== undefined) break;
      }
      if (problem === undefined && testCase.action !== undefined) {
        const target = page.locator(testCase.action.selector).filter({ visible: true }).first();
        if (testCase.action.fill !== undefined) await target.fill(testCase.action.fill);
        if (testCase.action.click === true) await target.click();
        for (const expectation of testCase.after ?? []) {
          problem = await eventually(page, expectation);
          if (problem !== undefined) break;
        }
      }
      results.push(problem === undefined ? { name: testCase.name, ok: true } : { name: testCase.name, ok: false, error: problem });
    } catch (error) {
      results.push({ name: testCase.name, ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      await page.close();
    }
  }
  return results;
}

const gate = argument("--gate");
if (gate !== undefined) {
  const tarball = argument("--tarball");
  if (tarball === undefined) {
    console.error("--gate needs --tarball <file> so the report's digest can be checked.");
    process.exit(1);
  }
  const expected = { commit: argument("--commit") ?? commit(), digest: sha256(tarball), mizzen: mizzenVersion() };
  const report = JSON.parse(readFileSync(resolve(gate), "utf8")) as AcceptanceReport;
  const problems = gateProblems(report, expected, LEDGER);
  if (problems.length > 0) {
    console.error(`The acceptance report cannot gate publishing:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`The report passes the gate: ${expected.commit}, sha256 ${expected.digest}, Mizzen ${expected.mizzen}.`);
  process.exit(0);
}

const problems = [
  ...ledgerProblems(LEDGER, CASES),
  ...changelogProblems(LEDGER, readFileSync(join(ROOT, "CHANGELOG.md"), "utf8")),
];
if (problems.length > 0) {
  console.error(`The acceptance ledger is inconsistent:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "lateen-acceptance-"));
let browser: Browser | undefined;
try {
  const tarball = pack(argument("--theme"), work);
  const digest = sha256(tarball);
  const mizzen = mizzenVersion();
  const project = join(work, "project");
  mkdirSync(project);
  writeFileSync(join(project, "package.json"), `${JSON.stringify({ name: "lateen-acceptance", private: true, type: "module" }, null, 2)}\n`);
  sh("npm", ["install", "--no-audit", "--no-fund", "--no-save", tarball, `@velella/mizzen@${mizzen}`], project);
  cpSync(SITE, join(project, "site"), { recursive: true });
  sh(join(project, "node_modules/.bin/mizzen"), ["build", "site", "--out", "dist"], project);

  const server = await startServer(join(project, "dist"), "");
  try {
    browser = await chromium.launch();
    const cases = await run(browser, server.url);
    const report: AcceptanceReport = {
      commit: commit(),
      digest,
      mizzen,
      tarball: tarball.slice(tarball.lastIndexOf("/") + 1),
      ok: cases.every((result) => result.ok),
      cases,
    };
    const file = resolve(argument("--report") ?? join(ROOT, "test/acceptance/out/report.json"));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    // The release workflow publishes this file and nothing else, so it travels beside the report.
    cpSync(tarball, join(dirname(file), basename(tarball)));
    for (const result of cases) console.log(`${result.ok ? "ok" : "not ok"}  ${result.name}${result.ok ? "" : `: ${result.error}`}`);
    console.log(`\n${report.ok ? "The acceptance gate passed." : "The acceptance gate failed."} Report: ${file}`);
    process.exitCode = report.ok ? 0 : 1;
  } finally {
    await server.close();
  }
} finally {
  await browser?.close();
  if (existsSync(work)) rmSync(work, { recursive: true, force: true });
}
