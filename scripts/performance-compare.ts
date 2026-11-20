// Compares the asset manifests of two commits: the gzip bytes each route loads, split into CSS,
// JavaScript, fonts, and a total, with every changed asset named. The CI job builds main and the pull
// request from the same fixture routes, so a difference belongs to this change. A new asset, a route
// that appears on one side only, a duplicate path, or growth past the tolerance fails the run.
// Usage: node scripts/performance-compare.ts --base <file> --head <file> [--tolerance <bytes>] [--report <file>]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSET_CLASSES, type AssetClass } from "./performance-budget.ts";
import { reportPath, schemaAt, writeReport } from "./report.ts";

export const MANIFEST_TOOL = "lateen/asset-manifest";
export const REPORT_TOOL = "lateen/performance-compare";
const COMMIT = /^[0-9a-f]{7,40}$/;

export interface ManifestAsset {
  readonly path: string;
  readonly class: AssetClass;
  readonly raw: number;
  readonly gzip: number;
}

export interface ManifestRoute {
  readonly route: string;
  readonly assets: readonly ManifestAsset[];
}

export interface AssetManifest {
  readonly tool: string;
  readonly version: number;
  readonly commit: string;
  readonly mizzen: string;
  readonly routes: readonly ManifestRoute[];
}

/** One asset's gzip bytes on each side; a side that does not load it is absent. */
export interface ComparedAsset {
  readonly path: string;
  readonly class: AssetClass;
  readonly base?: number;
  readonly head?: number;
  readonly delta: number;
}

export interface ChangeTotals {
  readonly css: number;
  readonly javascript: number;
  readonly font: number;
  readonly total: number;
}

export interface RouteComparison extends ChangeTotals {
  readonly route: string;
  /** Only the assets whose gzip size changed, sorted by path. */
  readonly assets: readonly ComparedAsset[];
}

export interface ManifestComparison {
  readonly routes: readonly RouteComparison[];
  readonly totals: ChangeTotals;
  readonly problems: readonly string[];
}

type MutableTotals = { css: number; javascript: number; font: number; total: number };

const emptyTotals = (): MutableTotals => ({ css: 0, javascript: 0, font: 0, total: 0 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isClass = (value: unknown): value is AssetClass =>
  typeof value === "string" && (ASSET_CLASSES as readonly string[]).includes(value);

/** The bucket a class is reported in; `js/inline` is JavaScript even though it travels in the HTML. */
function groupOf(assetClass: AssetClass): "css" | "javascript" | "font" {
  if (assetClass === "font/self-hosted") return "font";
  return assetClass.startsWith("css/") ? "css" : "javascript";
}

/** A manifest with every rule that later code relies on checked, and the problems that stopped it. */
function parseManifest(label: string, value: unknown): { manifest?: AssetManifest; problems: string[] } {
  const problems: string[] = [];
  if (!isRecord(value)) return { problems: [`${label}: the manifest is not an object`] };
  if (value.tool !== MANIFEST_TOOL) {
    problems.push(`${label}: tool is ${JSON.stringify(value.tool)}, expected ${JSON.stringify(MANIFEST_TOOL)}`);
  }
  if (value.version !== 1) {
    problems.push(`${label}: version is ${JSON.stringify(value.version)}, expected 1`);
  }
  if (typeof value.commit !== "string" || !COMMIT.test(value.commit)) {
    problems.push(`${label}: commit ${JSON.stringify(value.commit)} is not 7-40 lowercase hex characters`);
  }
  if (!Array.isArray(value.routes)) {
    problems.push(`${label}: routes is not an array`);
    return { problems };
  }

  const routes: ManifestRoute[] = [];
  const seenRoutes = new Set<string>();
  value.routes.forEach((route, index) => {
    const where = `${label}: routes[${index}]`;
    if (!isRecord(route)) {
      problems.push(`${where} is not an object`);
      return;
    }
    if (typeof route.route !== "string" || route.route === "") {
      problems.push(`${where}: route is not a non-empty string`);
      return;
    }
    if (seenRoutes.has(route.route)) {
      problems.push(`${label}: route ${route.route} appears more than once`);
      return;
    }
    seenRoutes.add(route.route);
    if (!Array.isArray(route.assets)) {
      problems.push(`${where}: assets is not an array`);
      return;
    }

    const assets: ManifestAsset[] = [];
    const seenPaths = new Set<string>();
    route.assets.forEach((asset, assetIndex) => {
      const at = `${where}: asset ${assetIndex}`;
      if (!isRecord(asset)) {
        problems.push(`${at} is not an object`);
        return;
      }
      if (typeof asset.path !== "string" || asset.path === "") {
        problems.push(`${at}: path is not a non-empty string`);
        return;
      }
      if (seenPaths.has(asset.path)) {
        problems.push(`${label}: route ${route.route}: ${asset.path} is listed more than once`);
        return;
      }
      seenPaths.add(asset.path);
      if (!isClass(asset.class)) {
        problems.push(`${at}: ${JSON.stringify(asset.class)} is not an asset class`);
        return;
      }
      if (typeof asset.gzip !== "number" || !Number.isInteger(asset.gzip) || asset.gzip < 0) {
        problems.push(`${at}: gzip is not a non-negative whole number of bytes`);
        return;
      }
      const raw = typeof asset.raw === "number" && Number.isInteger(asset.raw) && asset.raw >= 0 ? asset.raw : asset.gzip;
      assets.push({ path: asset.path, class: asset.class, raw, gzip: asset.gzip });
    });
    routes.push({ route: route.route, assets });
  });

  if (problems.length > 0) return { problems };
  return {
    manifest: {
      tool: MANIFEST_TOOL,
      version: 1,
      commit: value.commit as string,
      mizzen: typeof value.mizzen === "string" ? value.mizzen : "",
      routes,
    },
    problems,
  };
}

/**
 * Compares two manifests by `route` and then by asset `path`. An asset only on the head side is an
 * added dependency and always a problem; one only on the base side is a removal and passes. Growth
 * of an asset is allowed up to `tolerance` gzip bytes, so a zlib release does not fail the gate.
 */
export function compareManifests(base: unknown, head: unknown, tolerance = 0): ManifestComparison {
  const before = parseManifest("base", base);
  const after = parseManifest("head", head);
  if (before.manifest === undefined || after.manifest === undefined) {
    return { routes: [], totals: emptyTotals(), problems: [...before.problems, ...after.problems] };
  }

  const problems: string[] = [];
  const baseRoutes = new Map(before.manifest.routes.map((route) => [route.route, route]));
  const headRoutes = new Map(after.manifest.routes.map((route) => [route.route, route]));
  const routes = [...new Set([...baseRoutes.keys(), ...headRoutes.keys()])].sort();
  const compared: RouteComparison[] = [];
  const totals = emptyTotals();

  for (const route of routes) {
    const baseRoute = baseRoutes.get(route);
    const headRoute = headRoutes.get(route);
    if (baseRoute === undefined) {
      problems.push(`route ${route}: only in head; both sides must measure the same routes`);
      continue;
    }
    if (headRoute === undefined) {
      problems.push(`route ${route}: only in base; both sides must measure the same routes`);
      continue;
    }

    const baseAssets = new Map(baseRoute.assets.map((asset) => [asset.path, asset]));
    const headAssets = new Map(headRoute.assets.map((asset) => [asset.path, asset]));
    const paths = [...new Set([...baseAssets.keys(), ...headAssets.keys()])].sort();
    const delta = emptyTotals();
    const changed: ComparedAsset[] = [];

    for (const path of paths) {
      const previous = baseAssets.get(path);
      const current = headAssets.get(path);
      const assetClass = current?.class ?? previous?.class;
      if (assetClass === undefined) continue;
      const bytes = (current?.gzip ?? 0) - (previous?.gzip ?? 0);
      if (bytes === 0) continue;

      const group = groupOf(assetClass);
      delta[group] += bytes;
      delta.total += bytes;
      changed.push({
        path,
        class: assetClass,
        ...(previous === undefined ? {} : { base: previous.gzip }),
        ...(current === undefined ? {} : { head: current.gzip }),
        delta: bytes,
      });

      if (previous === undefined) {
        problems.push(`route ${route}: ${path} is a new asset (+${current?.gzip ?? 0} B gzip); a new dependency needs review`);
      } else if (current !== undefined && bytes > tolerance) {
        problems.push(
          `route ${route}: ${path} grew by ${bytes} B gzip (${previous.gzip} B to ${current.gzip} B, tolerance ${tolerance} B)`,
        );
      }
    }

    compared.push({ route, ...delta, assets: changed });
    totals.css += delta.css;
    totals.javascript += delta.javascript;
    totals.font += delta.font;
    totals.total += delta.total;
  }

  return { routes: compared, totals, problems };
}

const count = new Intl.NumberFormat("en-US");

/** Bytes with a sign, so a shrink reads as one: `+1,204 B`, `-80 B`, `0 B`. */
function signed(bytes: number): string {
  const prefix = bytes > 0 ? "+" : bytes < 0 ? "-" : "";
  return `${prefix}${count.format(Math.abs(bytes))} B`;
}

/** The class total a changed asset is shown against: its CSS, JavaScript, or font bucket. */
function classTotal(route: RouteComparison, assetClass: AssetClass): number {
  const group = groupOf(assetClass);
  return group === "css" ? route.css : group === "font" ? route.font : route.javascript;
}

/** One line per route, then one line per changed asset, as CI logs and pull request comments read them. */
export function formatComparison(comparison: ManifestComparison): string {
  const lines: string[] = [];
  for (const route of comparison.routes) {
    lines.push(
      `route ${route.route}: css ${signed(route.css)} gzip, javascript ${signed(route.javascript)} gzip, ` +
        `font ${signed(route.font)} gzip, total ${signed(route.total)} gzip`,
    );
    for (const asset of route.assets) {
      lines.push(`route ${route.route}: ${asset.class} ${signed(classTotal(route, asset.class))} gzip (${asset.path} ${signed(asset.delta)})`);
    }
  }
  return lines.join("\n");
}

function option(argv: readonly string[], name: string): string {
  const index = argv.indexOf(name);
  if (index === -1) throw new Error(`${name} needs a file path`);
  const value = argv[index + 1];
  if (value === undefined || value.trim() === "") throw new Error(`${name} needs a file path`);
  return value;
}

function toleranceOf(argv: readonly string[]): number {
  const index = argv.indexOf("--tolerance");
  if (index === -1) return 0;
  const value = argv[index + 1];
  const bytes = value === undefined || value.trim() === "" ? Number.NaN : Number(value);
  if (!Number.isInteger(bytes) || bytes < 0) throw new Error("--tolerance needs a non-negative whole number of bytes");
  return bytes;
}

function readManifest(file: string): unknown {
  return JSON.parse(readFileSync(resolve(file), "utf8")) as unknown;
}

function commitOf(manifest: unknown): string | undefined {
  if (!isRecord(manifest) || typeof manifest.commit !== "string" || !COMMIT.test(manifest.commit)) return undefined;
  return manifest.commit;
}

export function main(argv = process.argv.slice(2)): void {
  const baseFile = option(argv, "--base");
  const headFile = option(argv, "--head");
  const tolerance = toleranceOf(argv);
  const base = readManifest(baseFile);
  const head = readManifest(headFile);
  const comparison = compareManifests(base, head, tolerance);

  const text = formatComparison(comparison);
  if (text !== "") console.log(text);

  const reportFile = reportPath(argv);
  if (reportFile !== undefined) {
    const baseCommit = commitOf(base);
    const headCommit = commitOf(head);
    if (baseCommit === undefined || headCommit === undefined) {
      console.error(`FAIL: cannot write ${reportFile}: a manifest has no valid commit`);
      process.exitCode = 1;
    } else {
      writeReport(reportFile, schemaAt("performance-compare.schema.json"), {
        tool: REPORT_TOOL,
        version: 1,
        base: baseCommit,
        head: headCommit,
        tolerance,
        routes: comparison.routes,
        problems: comparison.problems,
      });
    }
  }

  if (comparison.problems.length > 0) {
    console.error(`FAIL: ${comparison.problems.length} performance comparison problem(s):`);
    for (const problem of comparison.problems) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: head is within ${tolerance} B gzip of base on every route.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
