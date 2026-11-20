// Typed fixture factories for the site model (#866): only required fields, so a test names what it
// asserts and nothing else. One fixture shape for every chrome and layout test instead of eighty
// copies of the full literal.
import type { NavTree, Page, Site, SiteConfig } from "@velella/mizzen/contracts";

/** A SiteConfig with every required field at its neutral value. */
export function siteConfig(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Example",
    base: "",
    lang: "en",
    dir: "ltr",
    languages: [],
    source: ".",
    include: [],
    exclude: [],
    navigation: "_data/navigation.yml",
    defaults: [],
    theme: { options: {} },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
    feeds: {},
    ...overrides,
  };
}

export interface SiteOptions {
  /** The pages the site carries; an empty site by default. */
  readonly pages?: readonly Page[];
  /** Overrides for the site config, on top of the neutral fixture config. */
  readonly config?: Partial<SiteConfig>;
  /** The navigation tree; empty by default. */
  readonly nav?: NavTree;
  /** Files from `_data/`, keyed by name. */
  readonly data?: Readonly<Record<string, unknown>>;
  /** Data collections, keyed by name. */
  readonly collections?: Site["collections"];
}

/** A Site built from the fixture config and the options a test names. */
export function siteOf(options: SiteOptions = {}): Site {
  return {
    config: siteConfig(options.config),
    pages: options.pages ?? [],
    nav: options.nav ?? {},
    data: options.data ?? {},
    collections: options.collections ?? {},
  };
}
