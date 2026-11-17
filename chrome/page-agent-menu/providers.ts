/*
 * The agent provider list, shared by the page agent menu and the ask-agent panel: a title and a URL
 * template. The page menu fills the page's Markdown twin into `{markdown}`; the ask panel fills a
 * prompt into `{prompt}`. A provider whose template asks for a value the caller cannot supply is
 * left out rather than shown as a half-filled link.
 */

import type { Page, SiteConfig } from "@velella/mizzen/contracts";

/** A provider the reader can open in: a title and a URL template. */
export interface Provider {
  readonly title: string;
  readonly url: string;
}

/** The `theme.options.pageAgent` block as the config wrote it. */
interface PageAgentOptions {
  readonly providers?: unknown;
}

/**
 * The three agents the menu offers when the site sets no list. Each URL takes the page's Markdown
 * twin through `{markdown}`, so an agent reads the same text as the copy button.
 */
export const DEFAULT_PROVIDERS: readonly Provider[] = [
  { title: "Claude", url: "https://claude.ai/new?q=Read+{markdown}" },
  { title: "ChatGPT", url: "https://chatgpt.com?q=Read+{markdown}" },
  { title: "Cursor", url: "https://cursor.com/link/prompt?text=Read+{markdown}" },
];

/** Only these schemes are linked; a config value cannot inject `javascript:` or `data:`. */
export const SAFE_SCHEME = /^(?:https?|cursor|claude|codex|vscode):/i;

/** A non-empty string from the config, trimmed; anything else is not shown. */
function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** The configured providers, or the three defaults when the site sets none. */
export function providersOf(config: SiteConfig): readonly Provider[] {
  const options = config.theme.options?.pageAgent;
  const value = typeof options === "object" && options !== null ? (options as PageAgentOptions).providers : undefined;
  if (value === undefined) return DEFAULT_PROVIDERS;
  if (!Array.isArray(value)) return DEFAULT_PROVIDERS;
  const providers: Provider[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { title, url } = entry as { title?: unknown; url?: unknown };
    const name = text(title);
    const href = text(url);
    if (name !== undefined && href !== undefined) providers.push({ title: name, url: href });
  }
  return providers;
}

/**
 * The URL path a page's JSON is served at, by the engine's own rule in `outputs/page-json.ts`: a
 * pretty URL gives `<url>/index.json`, `/404.html` gives `/404.json`, and a URL that names another
 * file has none. Mirrored here because the theme imports no engine output module.
 */
export function jsonUrl(url: string): string | undefined {
  const last = url.slice(url.lastIndexOf("/") + 1);
  if (/\.html?$/i.test(last)) return `${url.slice(0, url.length - last.length)}${last.replace(/\.html?$/i, ".json")}`;
  if (last.includes(".")) return undefined;
  return `${url.endsWith("/") ? url : `${url}/`}index.json`;
}

/** The site's base path without a trailing slash; `""` at a domain root. */
function baseOf(config: SiteConfig): string {
  return config.base.replace(/\/+$/, "");
}

/**
 * The site's origin and any path it carries, without the base the page URLs already include.
 * Returns `undefined` when the config names no usable site.
 */
export function originOf(config: SiteConfig): string | undefined {
  const configured = text(config.url);
  if (configured === undefined) return undefined;

  let site: URL;
  try {
    site = new URL(configured);
  } catch {
    return undefined;
  }

  const path = site.pathname.replace(/\/+$/, "");
  const base = baseOf(config);
  const at = path.length - base.length;
  const pathAlreadyCarriesBase =
    base !== "" && at >= 0 && path.slice(at) === base && (at === 0 || path[at - 1] === "/");
  return `${site.origin}${pathAlreadyCarriesBase ? path.slice(0, at) : path}`;
}

/**
 * A site-relative URL as an absolute one, joined by URL parts rather than by string concatenation.
 * The site's own path stays in front of the page URL once; when that path ends in the site's base,
 * the page URL already carries it, so copying it again would give `/docs/docs/…`.
 */
function absolute(config: SiteConfig, url: string): string | undefined {
  const origin = originOf(config);
  return origin === undefined ? undefined : `${origin}${url}`;
}

/**
 * Fills a provider template's placeholders in one pass, encoding every value once. `{url}`,
 * `{markdown}` and `{json}` are absolute page addresses, `{lang}` the page language, `{source}` its
 * source file, `{title}` its title, and `{version}` the version its front matter declares. A template that uses a
 * value the caller cannot supply returns nothing, so the provider is omitted rather than shown as a
 * half-filled link: `{version}` on a page that declares none, `{prompt}` in the page menu, or an
 * absolute address when the config names no published site. One pass means a value that contains
 * braces is copied as text and never read as another placeholder.
 */
export function expand(config: SiteConfig, page: Page, template: string, markdown: string): string | undefined {
  const json = jsonUrl(page.url);
  const values: Readonly<Record<string, string | undefined>> = {
    markdown: absolute(config, markdown),
    json: json === undefined ? undefined : absolute(config, json),
    url: absolute(config, page.url),
    title: page.title,
    lang: text(page.lang),
    source: text(page.source.file),
    version: text(page.frontMatter.version),
    // A prompt is built in the browser from a query, so the page menu cannot fill one.
    prompt: undefined,
  };

  for (const [name, value] of Object.entries(values)) {
    if (value === undefined && template.includes(`{${name}}`)) return undefined;
  }

  return template.replace(/\{([a-z]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? encodeURIComponent(values[name] ?? "") : placeholder,
  );
}
