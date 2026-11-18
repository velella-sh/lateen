// Builds every starter as a live demo under `<out>/starters/<name>/`. Each demo gets the site's base
// so its assets and page links resolve under the demo path, and `noindex` on every page so the demos
// never enter a search index. A starter that fails the engine's check is never published.
// Usage: node scripts/build-starter-demos.ts --out <built-site> [--base /lateen]
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { listStarters, root, startersDir } from "./check-starters.ts";

const MIZZEN = join(root, "node_modules/@velella/mizzen/bin/mizzen.js");

/** The starter config with the demo's base, and every page marked `noindex`. */
export function demoConfig(config: string, base: string): string {
  const withoutBase = config.replace(/^base:.*$/m, `base: ${base}`);
  return `${withoutBase.trimEnd()}\n\ndefaults:\n  - path: ""\n    values:\n      noindex: true\n`;
}

/** Checks and builds one starter into `out/starters/<name>`. */
function buildDemo(name: string, out: string, base: string): void {
  const work = mkdtempSync(join(tmpdir(), `lateen-demo-${name}-`));
  try {
    cpSync(join(startersDir, name), work, { recursive: true, filter: (path) => !path.includes(`${join(name, ".mizzen")}`) });
    const config = join(work, "mizzen.yml");
    writeFileSync(config, demoConfig(readFileSync(config, "utf8"), `${base}/starters/${name}`));

    const check = spawnSync(process.execPath, [MIZZEN, "check", work, "--theme", root], { encoding: "utf8", timeout: 60_000 });
    if (check.status !== 0) throw new Error(`${name} failed its check:\n${check.stderr || check.stdout}`);
    const build = spawnSync(process.execPath, [MIZZEN, "build", work, "--theme", root, "--out", join(out, "starters", name)], {
      encoding: "utf8",
      timeout: 60_000,
    });
    if (build.status !== 0) throw new Error(`${name} failed its build:\n${build.stderr || build.stdout}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export function buildDemos(out: string, base = "/lateen"): string[] {
  const names = listStarters(startersDir);
  for (const name of names) buildDemo(name, out, base.replace(/\/$/, ""));
  return names;
}

export function main(argv = process.argv.slice(2)): number {
  const at = argv.indexOf("--out");
  const out = at === -1 ? undefined : argv[at + 1];
  if (out === undefined) {
    console.error("usage: node scripts/build-starter-demos.ts --out <built-site> [--base /lateen]");
    return 2;
  }
  const baseAt = argv.indexOf("--base");
  const names = buildDemos(out, baseAt === -1 ? "/lateen" : argv[baseAt + 1]);
  for (const name of names) console.log(`built starters/${name}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
