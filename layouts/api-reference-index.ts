import { Fragment, h } from "preact";
import { isRecord } from "../src/guards.ts";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import drawer from "../chrome/drawer/index.ts";
import shell, { footer as shellFooter } from "../chrome/shell/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import { t } from "../i18n/index.ts";
import { articleHtml } from "../src/article-html.ts";

/**
 * The index page of a pinned OpenAPI reference. The engine writes it at `apiReference.path` with
 * the document's title, version, description, and grouped navigation in `apiReference` front
 * matter: one group per tag, then the untagged operations as top-level links. This layout renders
 * that model with one heading per group and one ordinary link per operation.
 */

/** One navigation link the engine built. */
interface ReferenceLink {
  readonly title: string;
  readonly url: string;
}

/** One navigation group: a tag with its operations, or an untagged operation as a top-level link. */
interface ReferenceGroup {
  readonly title: string;
  readonly url?: string;
  readonly children?: readonly ReferenceLink[];
}

/** The index model from front matter. */
interface ApiReferenceIndex {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
  readonly navigation: readonly ReferenceGroup[];
}

/** The index from front matter, or undefined when the page was not built by the engine. */
function indexOf(frontMatter: LayoutProps["page"]["frontMatter"]): ApiReferenceIndex | undefined {
  const reference = frontMatter.apiReference;
  if (!isRecord(reference) || reference.kind !== "index") return undefined;
  if (typeof reference.title !== "string" || typeof reference.version !== "string" || !Array.isArray(reference.navigation)) {
    return undefined;
  }
  return reference as unknown as ApiReferenceIndex;
}

/** A top-level link is an operation without a tag; a group has children. */
function isLink(entry: ReferenceGroup): boolean {
  return entry.children === undefined && entry.url !== undefined;
}

/** One group of operation links under its tag. */
function groupSection(entry: ReferenceGroup): ComponentChildren {
  return h(
    "section",
    { class: "api-reference-index-group" },
    h("h3", { class: "api-reference-index-group-title" }, entry.title),
    h(
      "ul",
      { class: "api-reference-index-list" },
      ...(entry.children ?? []).map((link) =>
        h("li", null, h("a", { class: "api-reference-index-link", href: link.url }, link.title)),
      ),
    ),
  );
}

/** The untagged operations, which the engine publishes as top-level links. */
function otherSection(entries: readonly ReferenceGroup[], lang: string): ComponentChildren {
  if (entries.length === 0) return null;
  return h(
    "section",
    { class: "api-reference-index-group" },
    h("h3", { class: "api-reference-index-group-title" }, t(lang, "api_other_operations")),
    h(
      "ul",
      { class: "api-reference-index-list" },
      ...entries.map((entry) => h("li", null, h("a", { class: "api-reference-index-link", href: entry.url }, entry.title))),
    ),
  );
}

/** The page's content: title, version, description, and the grouped operation links. */
function content(props: LayoutProps, model: ApiReferenceIndex): ComponentChildren {
  const lang = props.page.lang;
  const groups = model.navigation.filter((entry) => !isLink(entry));
  const links = model.navigation.filter(isLink);
  return h(
    "article",
    { class: "doc api-reference-index", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    h("h1", null, model.title || props.page.title),
    h(
      "p",
      { class: "api-reference-index-version" },
      h("span", { class: "api-reference-index-label" }, t(lang, "api_version")),
      " ",
      h("code", { dir: "ltr" }, model.version),
    ),
    model.description === undefined ? null : h("p", { class: "api-reference-description" }, model.description),
    model.navigation.length === 0
      ? null
      : h(
          "nav",
          { class: "api-reference-index-nav", "aria-labelledby": "api-reference-index-nav-title" },
          h("h2", { id: "api-reference-index-nav-title" }, t(lang, "api_operations")),
          ...groups.map(groupSection),
          otherSection(links, lang),
        ),
  );
}

/** A hand-written page without the engine's index model still renders its title and body. */
function fallback(props: LayoutProps): ComponentChildren {
  return h(
    "article",
    { class: "doc api-reference-index", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    h("h1", null, props.page.title),
    h("div", { class: "doc-body", dangerouslySetInnerHTML: { __html: articleHtml(props.page.html) } }),
  );
}

/** The API reference index page: the docs shell around the generated navigation. */
const apiReferenceIndex: Layout = (props) => {
  const model = indexOf(props.page.frontMatter);
  return base({
    ...props,
    header: h(Fragment, null, shell(props) as ComponentChildren, drawer(props) as ComponentChildren),
    footer: shellFooter(props) as ComponentChildren,
    sidebar: sidebar(props) as ComponentChildren,
    main: model === undefined ? fallback(props) : content(props, model),
    aside: toc(props) as ComponentChildren,
  });
};

export default apiReferenceIndex;
