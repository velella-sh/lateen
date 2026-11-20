// Builds the visual fixture site. The pages of the accessibility fixture are linked into a staging
// folder, not copied, next to the gallery pages of this folder, so there is one copy of each page.
import { spawnSync } from "node:child_process";
import { linkSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "./pages.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const HERE = fileURLToPath(new URL("./", import.meta.url));
const A11Y_SITE = join(ROOT, "test/accessibility/fixtures/site");
const GALLERY_SITE = join(HERE, "site");

/** The accessibility fixture's folders the pages need: data for the reports and the brand fonts. */
const SHARED_FOLDERS = ["_data", "fonts"];

/** The gallery's own folders: its image and its data (the reports, the schema, the variables and the drift evidence). */
const GALLERY_FOLDERS = ["assets", "_data", "_templates"];

/** Hard-links a file, or every file under a folder, to `at`. The engine skips symbolic links; a hard link shares the bytes and is not a copy. */
function link(target: string, at: string): void {
  mkdirSync(dirname(at), { recursive: true });
  if (statSync(target).isDirectory()) {
    for (const entry of readdirSync(target).sort()) link(join(target, entry), join(at, entry));
    return;
  }
  linkSync(target, at);
}

/** Lays out the staging folder at `dir` and returns it. Only the pages in PAGES are linked in. */
export function stageFixture(dir: string): string {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  link(join(HERE, "mizzen.yml"), join(dir, "mizzen.yml"));
  for (const folder of SHARED_FOLDERS) link(join(A11Y_SITE, folder), join(dir, folder));
  for (const page of PAGES) {
    link(join(page.from === "gallery" ? GALLERY_SITE : A11Y_SITE, page.file), join(dir, page.file));
  }
  // The gallery layout has no directive of its own, so its state shots need a page that uses it.
  link(join(A11Y_SITE, "gallery-layout.md"), join(dir, "gallery-layout.md"));
  // The subscribe panel's copy button lives on a list page with a calendar.
  link(join(A11Y_SITE, "data-time.md"), join(dir, "data-time.md"));
  // The inventory page holds states that would change the screenshot matrix, and the stale notice.
  link(join(GALLERY_SITE, "inventory.md"), join(dir, "inventory.md"));
  link(join(A11Y_SITE, "stale.md"), join(dir, "stale.md"));
  for (const entry of readdirSync(GALLERY_SITE, { withFileTypes: true })) {
    if (entry.isDirectory() && GALLERY_FOLDERS.includes(entry.name)) link(join(GALLERY_SITE, entry.name), join(dir, entry.name));
  }
  return dir;
}

/** Builds the fixture into `out` with the theme of this checkout. Throws when the build fails. */
export function buildFixture(out: string, staging = join(ROOT, ".mizzen/visual/fixture-src")): void {
  stageFixture(staging);
  const bin = join(dirname(createRequire(import.meta.url).resolve("@velella/mizzen/package.json")), "bin/mizzen.js");
  const result = spawnSync(process.execPath, [bin, "build", staging, "--theme", ROOT, "--out", out], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`mizzen build failed\n${result.stdout}\n${result.stderr}`);
}
