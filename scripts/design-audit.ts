// Design audit helpers (epic design-audit, #1256). `node scripts/design-audit.ts` builds the visual
// fixture and prints each theme unit that never renders in any captured page, with the reason.
// The list feeds the gallery work in visual-regression-5 and the defect list in design-audit-3.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { PAGES } from "../test/visual/fixtures/pages.ts";
import { expandMatrix, loadMatrix, type MatrixTarget, type VisualMatrix } from "../visual/index.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** One shot of the audit: the case file name without `.png`, and what it shows. */
export interface AuditShot {
  readonly case: string;
  readonly layout: string;
  readonly theme: "light" | "dark";
  readonly dir: "ltr" | "rtl";
  readonly lang: string;
  readonly width: number;
}

/**
 * The matrix of the audit: every layout and every gallery page of the visual matrix, in the
 * default-look fixture, in both themes, at every width. The Arabic pages are left out; `fa` is the
 * right-to-left sample.
 */
export function auditMatrix(matrix: VisualMatrix = loadMatrix()): VisualMatrix {
  const keep = (target: MatrixTarget): boolean => target.lang !== "ar" && target.open === undefined;
  const mark = (target: MatrixTarget): MatrixTarget => ({ ...target, fixture: "default" });
  return {
    ...matrix,
    layouts: matrix.layouts.filter(keep).map(mark),
    gallery: {
      widths: Object.keys(matrix.widths),
      pages: matrix.gallery.pages.filter(keep).map(mark),
      print: { width: matrix.gallery.print.width, pages: [] },
      forcedColors: { width: matrix.gallery.forcedColors.width, pages: [] },
    },
  };
}

/** The index of the shots the audit matrix produces, one row per case. */
export function auditIndex(matrix: VisualMatrix = auditMatrix()): AuditShot[] {
  return expandMatrix(matrix).map((entry) => ({
    case: entry.case,
    layout: entry.name,
    theme: entry.theme,
    dir: entry.dir,
    lang: entry.lang,
    width: entry.width,
  }));
}

/** Shoots the audit matrix into `out` and writes `index.json` next to the shots. Offline. */
export async function shootAudit(out: string): Promise<AuditShot[]> {
  const { runVisual } = await import("./test-visual.ts");
  const matrix = auditMatrix();
  const dir = resolve(out);
  await runVisual({ matrix, out: dir, shotsOnly: true });
  const index = auditIndex(matrix);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

export type Reason = "directive only" | "needs data" | "client only" | "inventory page only" | "not found in any page";

export interface Unrendered {
  readonly unit: string;
  readonly kind: "component" | "chrome";
  readonly reason: Reason;
}

interface InventoryEntry {
  readonly name: string;
  readonly selector: string;
  readonly page?: string;
}

function pageFile(build: string, path: string): string {
  return join(build, path.endsWith(".html") ? path : join(path, "index.html"));
}

function folders(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** The page paths the screenshot matrix captures. */
export function capturedPaths(): Set<string> {
  return new Set(PAGES.map((page) => page.path));
}

function classify(dir: string, name: string): Reason {
  const files = readdirSync(join(ROOT, dir, name));
  if (!files.includes("index.ts") && files.includes("client.ts")) return "client only";
  if (dir === "chrome") return "needs data";
  const source = readFileSync(join(ROOT, dir, name, "index.ts"), "utf8");
  return /\bdirective\b|::[a-z]/.test(source) ? "directive only" : "needs data";
}

/** Every component and chrome unit that no captured page of the built fixture at `build` renders. */
export function findUnrendered(build: string): Unrendered[] {
  const captured = capturedPaths();
  const docs = new Map<string, Document>();
  const doc = (path: string): Document | null => {
    const file = pageFile(build, path);
    if (!existsSync(file)) return null;
    let found = docs.get(path);
    if (found === undefined) {
      found = new JSDOM(readFileSync(file, "utf8")).window.document;
      docs.set(path, found);
    }
    return found;
  };
  const inventory = JSON.parse(readFileSync(join(ROOT, "test/visual/inventory.json"), "utf8")) as { components: InventoryEntry[] };
  const byName = new Map(inventory.components.map((entry) => [entry.name, entry]));
  const out: Unrendered[] = [];

  for (const name of folders("components")) {
    const entry = byName.get(name);
    const page = entry?.page ?? "/gallery/";
    if (entry !== undefined && captured.has(page) && doc(page)?.querySelector(entry.selector)) continue;
    const reason: Reason = entry !== undefined && !captured.has(page) && doc(page)?.querySelector(entry.selector) ? "inventory page only" : classify("components", name);
    out.push({ unit: name, kind: "component", reason });
  }

  const html = [...captured].map((path) => doc(path)?.documentElement.outerHTML ?? "").join("\n");
  for (const name of folders("chrome")) {
    const marker = new RegExp(`(class="[^"]*\\b${name}\\b|data-${name}\\b|\\b${name}-[a-z])`);
    if (marker.test(html)) continue;
    out.push({ unit: name, kind: "chrome", reason: classify("chrome", name) });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--shoot")) {
  const at = process.argv.indexOf("--out");
  const out = at === -1 ? join(ROOT, "test/visual/out/audit") : (process.argv[at + 1] ?? "");
  const index = await shootAudit(out);
  console.log(`wrote ${index.length} audit shots and index.json to ${resolve(out)}`);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { buildFixture } = await import("../test/visual/fixtures/build.ts");
  const { tempDir } = await import("../test/integration-helpers.ts");
  const build = tempDir("design-audit-");
  buildFixture(build);
  for (const row of findUnrendered(build)) console.log(`${row.kind}\t${row.unit}\t${row.reason}`);
}
