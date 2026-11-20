import { textOf } from "./guards.ts";

/** The site's base path, or an empty string when a test passes no site model. */
export function baseOf(site: { readonly config?: { readonly base?: string } } | undefined): string {
  return site?.config?.base ?? "";
}

/** A base path without a trailing slash, so paths join with one `/`. The root is the empty string. */
export function basePath(base: string): string {
  if (base === "" || base === "/") return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

/**
 * Prefixes a root-relative URL with the site's base path exactly once. Absolute, protocol-relative,
 * `data:`, and fragment URLs are left as written, so an external address never becomes a local one.
 */
export function withBase(base: string, url: string): string {
  if (!url.startsWith("/") || url.startsWith("//")) return url;
  const prefix = basePath(base);
  if (prefix === "" || url === prefix || url.startsWith(`${prefix}/`)) return url;
  return `${prefix}${url}`;
}

/** The protocols a link may use by default: `http` and `https`. */
export const WEB_PROTOCOLS = ["http:", "https:"] as const;

/**
 * A safe link as a regular-expression source: a root-relative path (`/x`, not protocol-relative
 * `//host` or `/\host`) or an absolute URL with one of `protocols`. Whitespace, quotes, angle
 * brackets, and backslashes are refused, so a value cannot close an attribute. With `relative`, a
 * Pagefind-style `./` or `../` path is also accepted. Exported as source because the search results
 * page script is built as a string and cannot import this module.
 */
export function safeHrefSource(protocols: readonly string[] = WEB_PROTOCOLS, relative = false): string {
  const path = relative ? String.raw`(?:\.{1,2}\/|\/(?![/\\]))` : String.raw`\/(?![/\\])`;
  const schemes = protocols.map((protocol) => (protocol === "http:" || protocol === "https:" ? `${protocol}//` : protocol));
  return `^(?:${path}|${schemes.join("|")})[^\\s"'<>\\\\]*$`;
}

/**
 * A link the page may use, trimmed: a root-relative path or an absolute URL with one of `protocols`;
 * anything else, including `javascript:` and `data:`, is `undefined`.
 */
export function safeHref(
  value: unknown,
  protocols: readonly string[] = WEB_PROTOCOLS,
  relative = false,
): string | undefined {
  const href = textOf(value);
  return href !== undefined && new RegExp(safeHrefSource(protocols, relative), "i").test(href) ? href : undefined;
}

/** One parameter's new value: a value, several to repeat in order, or `null` to remove the name. */
export type ParamValue = string | readonly string[] | null;

/**
 * The URL with its query rewritten: `drop` names the parameters to remove, then each change replaces
 * a name with one value, repeats it, or removes it. Every other parameter and the fragment stay,
 * and the address keeps the form it came in: absolute, root-relative, or query and fragment alone.
 */
export function withParams(
  url: string,
  changes: Readonly<Record<string, ParamValue>> = {},
  drop: (name: string) => boolean = () => false,
): string {
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
  const parsed = new URL(url, "https://lateen.invalid");
  for (const name of [...parsed.searchParams.keys()]) {
    if (drop(name)) parsed.searchParams.delete(name);
  }
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) {
      parsed.searchParams.delete(name);
    } else if (typeof value === "string") {
      parsed.searchParams.set(name, value);
    } else {
      parsed.searchParams.delete(name);
      for (const item of value) parsed.searchParams.append(name, item);
    }
  }
  if (absolute) return parsed.toString();
  if (url === "" || url.startsWith("?") || url.startsWith("#")) return `${parsed.search}${parsed.hash}`;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Prefixes every root-relative candidate in a `srcset` list, keeping each descriptor. */
export function srcsetWithBase(base: string, srcset: string): string {
  return srcset
    .split(",")
    .map((candidate) => {
      const [url = "", ...descriptor] = candidate.trim().split(/\s+/);
      return [withBase(base, url), ...descriptor].join(" ");
    })
    .join(", ");
}
