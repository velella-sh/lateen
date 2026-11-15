/*
 * The Markdown twin rule, with no imports, so the island that builds an agent prompt can name the
 * same file the copy button and the command palette name. The rule matches the engine's
 * `outputs/twins.ts`: a pretty URL (`/guide/install/`) gives `/guide/install/index.md`, the site
 * root gives `/index.md`, and `/404.html` gives `/404.md`.
 */

/** The Markdown twin of a page URL; a URL that names another file has no twin. */
export function twinUrl(url: string): string | undefined {
  const last = url.slice(url.lastIndexOf("/") + 1);
  if (/\.html?$/i.test(last)) return `${url.slice(0, url.length - last.length)}${last.replace(/\.html?$/i, ".md")}`;
  if (last.includes(".")) return undefined;
  return `${url.endsWith("/") ? url : `${url}/`}index.md`;
}

/** The page URL with the site's base in front, only when the URL does not already carry it. */
export function pageUrl(url: string, base = ""): string {
  const root = base.replace(/\/+$/, "");
  if (root === "" || url === root || url.startsWith(`${root}/`)) return url;
  return `${root}${url}`;
}

/**
 * The page's Markdown twin as the published site serves it: the twin rule applied to the
 * base-aware page URL, so the base goes in exactly once.
 */
export function markdownTwin(url: string, base = ""): string | undefined {
  return twinUrl(pageUrl(url, base));
}
