import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** The file whose folder marks the root of a site: the one place a session file may be read from. */
export const SITE_CONFIG = "mizzen.yml";

/** The largest session file the component reads, so a wrong path cannot pull a huge file into a page. */
export const MAX_BYTES = 262_144;

/** Why a session file could not be read. `outside` and `missing` are reported to the reader; the text names the file. */
export type SourceResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: "missing" | "outside" | "invalid" };

/**
 * The site folder that holds a page: the nearest folder at or above the page file that has a site config.
 * `file` is relative to `root`, as a page's source position is. Without a config the page's own folder is
 * the site, so a file next to the page still works and nothing above it can be reached.
 */
export function siteFolderOf(file: string, root: string): string {
  let dir = resolve(root, dirname(file));
  const top = resolve(root);
  for (;;) {
    if (existsSync(join(dir, SITE_CONFIG))) return dir;
    const parent = dirname(dir);
    if (parent === dir || relative(top, parent).startsWith("..")) break;
    dir = parent;
  }
  return resolve(root, dirname(file));
}

function inside(folder: string, path: string): boolean {
  const rel = relative(folder, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel) && !rel.split(sep).includes(".."));
}

/**
 * Reads a session file named by `src`. A path starting with `/` is relative to the site folder; any other
 * path is relative to the page's own folder. A path that leaves the site folder, by `..`, by an absolute
 * path, or through a link, is refused and nothing outside is read. Only text is read, never fetched.
 */
export function readSessionFile(src: string, pageFile: string, root: string = process.cwd()): SourceResult {
  const raw = src.trim();
  if (raw === "" || raw.includes("\0") || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) {
    return { ok: false, reason: "invalid" };
  }

  const site = siteFolderOf(pageFile, root);
  const base = raw.startsWith("/") ? site : resolve(root, dirname(pageFile));
  const path = resolve(base, raw.replace(/^\/+/, ""));
  if (!inside(site, path)) return { ok: false, reason: "outside" };

  try {
    if (!statSync(path).isFile()) return { ok: false, reason: "missing" };
    if (!inside(realpathSync(site), realpathSync(path))) return { ok: false, reason: "outside" };
    if (statSync(path).size > MAX_BYTES) return { ok: false, reason: "invalid" };
    return { ok: true, text: readFileSync(path, "utf8").replace(/\r\n?/g, "\n").replace(/\n+$/, "") };
  } catch {
    return { ok: false, reason: "missing" };
  }
}
