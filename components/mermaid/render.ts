/* The build-side renderer: runs a diagram through the child process and caches the result in memory and,
 * when enabled, on disk. The child itself lives in `child.ts`; this module only spawns it and reads its
 * one JSON result. */

import { spawnSync } from "node:child_process";
import { clearDiagramReadMemo, diagramCacheDir, readDiagramCache, writeDiagramCache } from "./cache.ts";
import { CHILD_ENV, CHILD_OPTIONS, diagramKey, normalizeSource, RENDER_OPTIONS, type RenderOptions } from "./key.ts";

export type RenderResult =
  | { readonly ok: true; readonly svg: string }
  | { readonly ok: false; readonly error: string };

/** One render per normalized source and options, for the life of the build process. */
const cache = new Map<string, RenderResult>();

/** Child renders this process has started; the cache is what keeps it from growing. */
let renders = 0;

/** How many child renders this process started. Tests use it to prove that a cached diagram is not rendered again. */
export function diagramRenderCount(): number {
  return renders;
}

/** Forgets every cached diagram, as a fresh build process would. */
export function clearDiagramCache(): void {
  cache.clear();
  clearDiagramReadMemo();
}

/**
 * The child's start-up script. Node strips types from a `.ts` file on its own, but not from one inside `node_modules`,
 * where this theme is installed; the hook strips them there, then the script imports this module. The URL pathname,
 * not the whole URL, decides: an engine that keys a changed entry module by a `?v=<digest>` query still ends in `.ts`.
 * Exported so the query-URL case can be tested.
 */
export const CHILD_BOOT = `
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith("file:")) {
      const parsed = new URL(url);
      if (parsed.pathname.includes("/node_modules/") && parsed.pathname.endsWith(".ts")) {
        const source = stripTypeScriptTypes(readFileSync(fileURLToPath(parsed), "utf8"), { mode: "strip" });
        return { format: "module", source, shortCircuit: true };
      }
    }
    return nextLoad(url, context);
  },
});
await import(process.env.LATEEN_MERMAID_MODULE);
`;

/** Renders a diagram through the child renderer, or returns the result cached for the same source and options. */
export function renderDiagram(source: string, options: RenderOptions = RENDER_OPTIONS): RenderResult {
  const normalized = normalizeSource(source);
  const key = diagramKey(normalized, options);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const result = renderUncached(normalized, key, options);
  cache.set(key, result);
  return result;
}

/**
 * A memory-cache miss: the persistent cache may still hold the SVG, and only a true miss renders.
 * The persistent cache is opt-in and best-effort: a miss or a corrupt entry is just a normal render,
 * and only a successful render is worth storing.
 */
function renderUncached(source: string, key: string, options: RenderOptions): RenderResult {
  const dir = diagramCacheDir();
  if (dir !== null) {
    const stored = readDiagramCache(dir, key);
    if (stored !== null) return { ok: true, svg: stored };
  }
  const result = runRenderer(source, options);
  if (dir !== null && result.ok) writeDiagramCache(dir, key, result.svg);
  return result;
}

function runRenderer(source: string, options: RenderOptions): RenderResult {
  renders += 1;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", CHILD_BOOT], {
    env: {
      ...process.env,
      [CHILD_ENV]: "1",
      LATEEN_MERMAID_MODULE: new URL("./index.ts", import.meta.url).href,
      [CHILD_OPTIONS]: JSON.stringify(options),
    },
    input: source,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120_000,
  });
  if (child.error) return { ok: false, error: child.error.message };
  const stdout = typeof child.stdout === "string" ? child.stdout : "";
  if (child.status !== 0) {
    const stderr = typeof child.stderr === "string" ? child.stderr.trim() : "";
    return { ok: false, error: stderr === "" ? `renderer exited with ${String(child.status)}` : stderr };
  }
  try {
    const parsed = JSON.parse(stdout) as { ok?: unknown; svg?: unknown; error?: unknown };
    if (parsed.ok === true && typeof parsed.svg === "string") return { ok: true, svg: parsed.svg };
    return { ok: false, error: typeof parsed.error === "string" ? parsed.error : "renderer returned no SVG" };
  } catch {
    return { ok: false, error: "renderer produced invalid output" };
  }
}
