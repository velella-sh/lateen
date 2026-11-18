// Builds every starter in `starters/` with the installed engine and this theme, runs the engine's check on it,
// and fails on any error or warning diagnostic, any broken internal link, any file over the size limit, or a build over the time
// limit. A starter that declares optional languages is also built without them, so the installer can leave
// them out. A failing starter is never skipped. See starters/README.md for what a starter is.
// Usage: node scripts/check-starters.ts [starters-folder]
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const startersDir = join(root, "starters");

/** The installed engine. A clean checkout gets it from `npm ci`; no sibling checkout is needed. */
const MIZZEN = join(root, "node_modules/@velella/mizzen/bin/mizzen.js");

/** The largest source file a starter may carry, in bytes. A new site should not start with a heavy file. */
export const MAX_FILE_BYTES = 256 * 1024;

/** The longest a build or check may take, in milliseconds. */
export const MAX_BUILD_MS = 60_000;

/** One reason a starter fails. */
export interface Problem {
  readonly starter: string;
  readonly variant: string;
  readonly message: string;
}

interface Manifest {
  readonly title?: unknown;
  readonly description?: unknown;
  readonly languages?: { readonly default?: unknown; readonly optional?: unknown };
}

/** The folders directly under the starters folder, sorted. A missing folder holds no starters. */
export function listStarters(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

/** Every file under a folder, as paths relative to it. */
function filesUnder(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(path, base));
    else out.push(relative(base, path));
  }
  return out;
}

/** The problems with the manifest itself: a title and a description, and well-formed languages. */
export function manifestProblems(dir: string): { problems: string[]; optionalPrefixes: string[] } {
  const problems: string[] = [];
  const optionalPrefixes: string[] = [];
  if (!existsSync(join(dir, "mizzen.yml"))) problems.push("mizzen.yml is missing");
  let manifest: Manifest = {};
  try {
    manifest = JSON.parse(readFileSync(join(dir, "starter.json"), "utf8")) as Manifest;
  } catch (error) {
    problems.push(`starter.json is missing or is not JSON: ${(error as Error).message}`);
    return { problems, optionalPrefixes };
  }
  for (const key of ["title", "description"] as const) {
    const value = manifest[key];
    if (typeof value !== "string" || value.trim() === "") problems.push(`starter.json needs a non-empty "${key}"`);
  }
  const optional = manifest.languages?.optional;
  if (optional !== undefined) {
    if (!Array.isArray(optional)) problems.push('starter.json "languages.optional" must be a list');
    else {
      for (const item of optional as Array<{ code?: unknown; prefix?: unknown }>) {
        if (typeof item?.code !== "string" || typeof item?.prefix !== "string" || !item.prefix.startsWith("/")) {
          problems.push('each optional language needs a "code" and a "prefix" that starts with "/"');
        } else optionalPrefixes.push(item.prefix.slice(1));
      }
    }
  }
  return { problems, optionalPrefixes };
}

/** Removes the `languages:` block from a config, which is how a site declares one language. */
export function withoutLanguages(config: string): string {
  const lines = config.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (/^languages:/.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && (/^\s/.test(line) || line === "")) continue;
    skipping = false;
    out.push(line);
  }
  return out.join("\n");
}

/** The internal links and assets in built HTML that point at no built file. */
export function brokenLinks(out: string): string[] {
  const broken: string[] = [];
  for (const file of filesUnder(out).filter((name) => name.endsWith(".html"))) {
    const html = readFileSync(join(out, file), "utf8");
    for (const match of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const raw = match[1] as string;
      if (raw === "" || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) continue;
      const path = decodeURIComponent(raw.split("#")[0]!.split("?")[0]!);
      if (path === "") continue;
      const target = path.startsWith("/") ? path.slice(1) : join(file, "..", path);
      const candidates = path.endsWith("/") || target === "" ? [join(target, "index.html")] : [target, join(target, "index.html")];
      if (!candidates.some((candidate) => existsSync(join(out, candidate)))) broken.push(`${file}: ${raw}`);
    }
  }
  return broken;
}

/** Runs the engine on a copy of a starter and returns what is wrong with it. */
function checkVariant(name: string, variant: string, source: string): Problem[] {
  const problem = (message: string): Problem => ({ starter: name, variant, message });
  const problems: Problem[] = [];
  const env = { ...process.env, NODE_V8_COVERAGE: "", NODE_NO_WARNINGS: "1" };
  const start = Date.now();
  const check = spawnSync(process.execPath, [MIZZEN, "check", source, "--theme", root, "--format", "json"], {
    encoding: "utf8",
    env,
    timeout: MAX_BUILD_MS,
  });
  let diagnostics: Array<{ file?: string; line?: number; code?: string; message?: string; severity?: string }> = [];
  try {
    diagnostics = (JSON.parse(check.stdout) as { diagnostics: typeof diagnostics }).diagnostics;
  } catch {
    problems.push(problem(`the engine's check gave no readable result: ${check.stderr || check.stdout || check.error?.message}`));
  }
  // Info lines report sizes the build wrote; a starter with a collection index always has one.
  for (const d of diagnostics.filter((entry) => entry.severity !== "info"))
    problems.push(problem(`${d.file ?? "site"}:${d.line ?? 0} ${d.code ?? ""} ${d.message ?? ""}`.trim()));

  const out = mkdtempSync(join(tmpdir(), "lateen-starter-out-"));
  try {
    const build = spawnSync(process.execPath, [MIZZEN, "build", source, "--out", out, "--theme", root], {
      encoding: "utf8",
      env,
      timeout: MAX_BUILD_MS,
    });
    if (build.status !== 0) problems.push(problem(`the build failed: ${build.stderr || build.stdout || build.error?.message}`));
    else for (const link of brokenLinks(out)) problems.push(problem(`broken link in ${link}`));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  const elapsed = Date.now() - start;
  if (elapsed > MAX_BUILD_MS) problems.push(problem(`check and build took ${elapsed} ms, over the ${MAX_BUILD_MS} ms limit`));
  return problems;
}

/** Checks every starter in a folder and returns every problem found. An empty folder has none. */
export function checkStarters(dir = startersDir): Problem[] {
  if (!existsSync(MIZZEN)) throw new Error(`${MIZZEN} is missing; run \`npm ci\` first`);
  const problems: Problem[] = [];
  for (const name of listStarters(dir)) {
    const starter = join(dir, name);
    const manifest = manifestProblems(starter);
    for (const message of manifest.problems) problems.push({ starter: name, variant: "manifest", message });
    for (const file of filesUnder(starter)) {
      const size = statSync(join(starter, file)).size;
      if (size > MAX_FILE_BYTES) problems.push({ starter: name, variant: "files", message: `${file} is ${size} bytes, over the ${MAX_FILE_BYTES} byte limit` });
    }
    if (manifest.problems.length > 0) continue;
    const variants = manifest.optionalPrefixes.length > 0 ? ["all languages", "default language only"] : ["default"];
    for (const variant of variants) {
      const work = mkdtempSync(join(tmpdir(), `lateen-starter-${name}-`));
      try {
        cpSync(starter, work, { recursive: true, filter: (path) => !path.includes(`${join(name, ".mizzen")}`) });
        if (variant === "default language only") {
          for (const prefix of manifest.optionalPrefixes) rmSync(join(work, prefix), { recursive: true, force: true });
          writeFileSync(join(work, "mizzen.yml"), withoutLanguages(readFileSync(join(work, "mizzen.yml"), "utf8")));
        }
        problems.push(...checkVariant(name, variant, work));
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    }
  }
  return problems;
}

export function main(argv = process.argv.slice(2)): number {
  const dir = argv[0] ?? startersDir;
  const problems = checkStarters(dir);
  for (const p of problems) console.error(`${p.starter} (${p.variant}): ${p.message}`);
  const count = listStarters(dir).length;
  if (problems.length > 0) {
    console.error(`${problems.length} problem(s) in ${count} starter(s)`);
    return 1;
  }
  console.log(`${count} starter(s) pass`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
