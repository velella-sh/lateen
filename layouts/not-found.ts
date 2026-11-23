import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps, SiteConfig } from "@velella/mizzen/contracts";
import { stateView } from "../components/state/index.ts";
import { hrefFor, resolvedLanguages } from "../chrome/language-switcher/index.ts";
import shell, { footer } from "../chrome/shell/index.ts";
import { t } from "../i18n/index.ts";
import { baseOf, withBase } from "../src/url.ts";
import { renderBase } from "./shared/base.ts";

/** The configured site base without trailing slashes, so joining a root path never doubles one. */
function siteBase(config: SiteConfig): string {
  return baseOf({ config }).replace(/\/+$/, "");
}

/** A language tag in the matching form: trimmed, lower case, `_` read as `-`. */
function tagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, "-");
}

/**
 * The home URL for a page language: the configured language whose code equals `lang`, else the one
 * whose primary subtag equals it (`fa-IR` reads `fa`), built with that language's configured prefix
 * under the site base exactly once. A language nothing configures gets no guessed prefix: its home
 * is the site home.
 */
export function homeHref(config: SiteConfig, lang: string): string {
  const base = siteBase(config);
  const languages = resolvedLanguages(config);
  const wanted = tagKey(lang);
  const wantedPrimary = wanted.split("-")[0] ?? "";
  const match =
    languages.find((language) => tagKey(language.code) === wanted) ??
    languages.find((language) => (tagKey(language.code).split("-")[0] ?? "") === wantedPrimary);
  return match === undefined ? withBase(base, "/") : hrefFor({ ...config, base }, match, "/");
}

/** The 404 content, in the page's own language: a code, a message, and home/search actions. */
function content(props: LayoutProps) {
  const { config, pages } = props.site;
  const lang = props.page.lang;
  const searchPage = config.search === false || config.outputs.search === false
    ? undefined
    : pages.find((page) => page.url === "/search/" || page.frontMatter.layout === "search-results");
  return stateView({
    kind: "not-found",
    code: "404",
    title: t(lang, "not_found_title"),
    description: t(lang, "not_found_text"),
    actions: [
      { href: homeHref(config, lang), label: t(lang, "not_found_home") },
      ...(searchPage === undefined
        ? []
        : [{ href: withBase(siteBase(config), searchPage.url), label: t(lang, "search_placeholder") }]),
    ],
  });
}

/**
 * The 404 page: the base document shell around recovery content written in the page's own language
 * (the shell carries that language's `lang` and `dir`). The home link resolves the configured
 * current language's prefix under the site base. When search is enabled and has a results page,
 * the secondary link leads there.
 */
const notFound: Layout = (props) =>
  renderBase({
    ...props,
    header: shell(props) as ComponentChildren,
    footer: footer(props) as ComponentChildren,
    main: content(props),
  });

export default notFound;
