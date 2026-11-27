// Design audit helpers (epic design-audit, #1256). `node scripts/design-audit.ts` builds the visual
// fixture and prints each theme unit that never renders in any captured page, with the reason.
// The list feeds the gallery work in visual-regression-5 and the defect list in design-audit-3.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { PAGES } from "../test/visual/fixtures/pages.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { buildFixture } = await import("../test/visual/fixtures/build.ts");
  const { tempDir } = await import("../test/integration-helpers.ts");
  const build = tempDir("design-audit-");
  buildFixture(build);
  for (const row of findUnrendered(build)) console.log(`${row.kind}\t${row.unit}\t${row.reason}`);
}
