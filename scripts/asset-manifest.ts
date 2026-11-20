// Publishes every response each route of `fixtures/performance` loads: stylesheets, island modules,
// inline scripts, and font files, with raw and gzip sizes. A global dependency or a repeated download
// then shows up in review and in `test/asset-manifest.test.ts` instead of hiding in a byte total.
// Usage: node scripts/asset-manifest.ts [--report <file>]
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AssetFile, buildFixture, builtPages, routeAssets } from "./performance-budget.ts";
import { commitOf, reportPath, root, schemaAt, versionOf, writeReport } from "./report.ts";

export interface ManifestRoute {
  readonly route: string;
  readonly assets: readonly AssetFile[];
}

export interface Manifest {
  readonly tool: "lateen/asset-manifest";
  readonly version: 1;
  readonly commit: string;
  readonly mizzen: string;
  readonly routes: readonly ManifestRoute[];
}

/** The manifest of a built output folder: routes and their assets both in path order. */
export function manifestOf(dir: string): Manifest {
  const routes = builtPages(dir)
    .map((page) => ({ route: page.url, assets: routeAssets(dir, page) }))
    .sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));
  return {
    tool: "lateen/asset-manifest",
    version: 1,
    commit: commitOf(),
    mizzen: versionOf("@velella/mizzen"),
    routes,
  };
}

export function main(argv = process.argv.slice(2)): void {
  const out = mkdtempSync(join(tmpdir(), "lateen-asset-manifest-"));
  try {
    buildFixture(out);
    const file = reportPath(argv) ?? join(root, "reports/asset-manifest.json");
    writeReport(file, schemaAt("asset-manifest.schema.json"), manifestOf(out));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
