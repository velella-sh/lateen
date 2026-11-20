/** The site's base path, or an empty string when a test passes no site model. */
export function baseOf(site: { readonly config?: { readonly base?: string } } | undefined): string {
  return site?.config?.base ?? "";
}

/**
 * Prefixes a root-relative URL with the site's base path. Absolute, protocol-relative, `data:`, and
 * fragment URLs are left as written, so an external address never becomes a local one.
 */
export function withBase(base: string, url: string): string {
  return url.startsWith("/") && !url.startsWith("//") ? `${base}${url}` : url;
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
