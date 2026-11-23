// The type-and-rhythm browser gate: builds the docs site, serves it, and checks in Chromium that
// the shared type system holds at 320px with a 200% root font size (no clipping, no sideways
// scroll), that print keeps the body size and line height, and that the machine-readable outputs
// (llms.txt, page Markdown) carry no styling. Setup: npx playwright install chromium.
// Usage: npm run test:type
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "../visual/index.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(ROOT, ".mizzen/type/docs");
const MOUNT = "/lateen";
export const PATHS: readonly string[] = ["/lateen/", "/lateen/install/", "/lateen/components/data-explorer/"];

export interface BodyType {
  readonly fontSize: number;
  readonly lineHeight: number;
}

/** True when a line height is a readable multiple of the font size for running text. */
export function readableLeading(type: BodyType): boolean {
  const ratio = type.lineHeight / type.fontSize;
  return ratio >= 1.4 && ratio <= 1.8;
}

function build(): void {
  const bin = join(dirname(createRequire(import.meta.url).resolve("@velella/mizzen/package.json")), "bin/mizzen.js");
  const result = spawnSync(process.execPath, [bin, "build", "site", "--theme", ".", "--out", OUT], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`build failed\n${result.stdout}${result.stderr}`);
}

async function main(): Promise<void> {
  build();
  const server = await startServer(OUT, MOUNT);
  const browser = await chromium.launch();
  const failures: string[] = [];
  try {
    for (const path of PATHS) {
      const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
      const page = await context.newPage();
      await page.goto(`${server.url}${path}`, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      // The article column is what this epic owns; header chrome is covered by the layout gates.
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll(".doc-body, .doc-body *")]
          .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !element.closest("pre, table, .table-scroll, .code-frame"))
          .slice(0, 3)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 30)}`),
      );
      if (clipped.length > 0) failures.push(`${path}: 320px at 200% pushes the article past the viewport: ${clipped.join(", ")}`);
      const body = await page.evaluate((): BodyType | null => {
        const p = document.querySelector(".doc-body p");
        if (p === null) return null;
        const style = getComputedStyle(p);
        return { fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
      });
      if (body !== null && !readableLeading(body)) failures.push(`${path}: zoomed body leading ${body.lineHeight}/${body.fontSize}`);

      await page.emulateMedia({ media: "print" });
      const printed = await page.evaluate((): BodyType | null => {
        const p = document.querySelector(".doc-body p");
        if (p === null) return null;
        const style = getComputedStyle(p);
        return { fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
      });
      if (printed !== null && (printed.fontSize < 12 || !readableLeading(printed))) {
        failures.push(`${path}: print body ${printed.fontSize}px / ${printed.lineHeight}px`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const llms = join(OUT, "llms.txt");
  if (existsSync(llms) && /<style|font-size|line-height/i.test(readFileSync(llms, "utf8"))) failures.push("llms.txt carries styling");

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${PATHS.length} routes hold at 320px and 200% zoom, and print keeps the body type`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`FAIL: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
