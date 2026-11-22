import type { Page } from "@velella/mizzen/contracts";

/** A version folder name, by the engine's rule: `v1`, `v1.2`, or `v1.2.3`. */
const VERSION_FOLDER = /^v\d+(?:\.\d+){0,2}$/;

/** A version's home page source: `index.md`, `index.mdx`, or `index.markdown`. */
export const INDEX_FILE = /^index\.(?:md|mdx|markdown)$/i;

/** The version name that means the current docs rather than a released folder. */
export const CURRENT = "current";

/** The page's source path with `./` and `\` normalized, so the first segment is the version folder. */
function sourcePath(page: Page): string {
  return page.source.file.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** The page's version folder, or undefined for the current docs. */
export function versionOf(page: Page): string | undefined {
  const first = sourcePath(page).split("/")[0] ?? "";
  return VERSION_FOLDER.test(first) ? first : undefined;
}

/** The path inside the page's version, such as `guide/install.md`; the current docs keep their whole path. */
export function versionPath(page: Page): string {
  const source = sourcePath(page);
  const version = versionOf(page);
  return version === undefined ? source : source.slice(version.length + 1);
}
