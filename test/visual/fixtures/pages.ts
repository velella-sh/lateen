// The page set of the visual fixture site, in one list so the screenshot matrix (#499) can read it.
// Every entry is a URL path, the layout it uses and its language. Pages come from two places: the
// accessibility fixture (`from: "accessibility"`, reused as is) and this folder (`from: "gallery"`).
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type FixtureLang = "en" | "fa" | "ar";
export type FixtureLayout = "api" | "changelog" | "doc" | "home" | "not-found" | "search-results" | "tutorial" | "versions";

export interface FixturePage {
  readonly name: string;
  /** URL path of the built page, with a trailing slash except for `/404.html`. */
  readonly path: string;
  /** Source file, relative to the folder it comes from. */
  readonly file: string;
  readonly from: "accessibility" | "gallery";
  readonly layout: FixtureLayout;
  readonly lang: FixtureLang;
}

const LANGS: readonly { readonly lang: FixtureLang; readonly prefix: string }[] = [
  { lang: "en", prefix: "" },
  { lang: "fa", prefix: "fa/" },
  { lang: "ar", prefix: "ar/" },
];

/** A page of the accessibility fixture, in every language it exists in. */
function shared(name: string, slug: string, layout: FixtureLayout, langs: readonly FixtureLang[]): FixturePage[] {
  return LANGS.filter((l) => langs.includes(l.lang)).map((l) => ({
    name: l.lang === "en" ? name : `${name} ${l.lang}`,
    path: `/${l.prefix}${slug === "index" ? "" : `${slug}/`}`,
    file: `${l.prefix}${slug}.md`,
    from: "accessibility" as const,
    layout,
    lang: l.lang,
  }));
}

export const ALL_LANGS: readonly FixtureLang[] = ["en", "fa", "ar"];

/** The fixture's pages: the layouts, the accessibility pages and the component gallery. */
export const PAGES: readonly FixturePage[] = [
  ...shared("home", "index", "home", ALL_LANGS).map((p) => (p.lang === "en" ? p : { ...p, layout: "doc" as const })),
  ...shared("document", "doc", "doc", ["en"]),
  ...shared("api", "api", "api", ["en"]),
  ...shared("changelog", "changelog", "changelog", ["en"]),
  ...shared("search results", "search", "search-results", ["en"]),
  ...shared("tutorial", "tutorial", "tutorial", ["en"]),
  ...shared("versions", "versions", "versions", ["en"]),
  ...shared("reports", "reports", "doc", ALL_LANGS),
  ...shared("cli demo", "cli-demo", "doc", ALL_LANGS),
  ...shared("brand", "brand", "doc", ALL_LANGS),
  ...shared("refinement", "refinement", "doc", ALL_LANGS),
  { name: "not found", path: "/404.html", file: "404.md", from: "accessibility", layout: "not-found", lang: "en" },
  ...LANGS.map((l): FixturePage => ({
    name: l.lang === "en" ? "gallery" : `gallery ${l.lang}`,
    path: `/${l.prefix}gallery/`,
    file: `${l.prefix}gallery.md`,
    from: "gallery",
    layout: "doc",
    lang: l.lang,
  })),
];

/** The gallery pages, one per language. */
export const GALLERY_PAGES: readonly FixturePage[] = PAGES.filter((p) => p.from === "gallery");

/** The component folders of the theme, sorted: the names the gallery must show. */
export function componentNames(): string[] {
  const dir = fileURLToPath(new URL("../../../components/", import.meta.url));
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
