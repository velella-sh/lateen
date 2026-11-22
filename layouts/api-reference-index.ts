import { h } from "preact";
import { isRecord } from "../src/guards.ts";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import { t } from "../i18n/index.ts";
import { articleHtml } from "../src/article-html.ts";
import { articleShell } from "./shared/index.ts";
import { methodClassOf } from "./api-reference.ts";

/**
 * The index page of a pinned OpenAPI reference. The engine writes it at `apiReference.path` with
 * the document's title, version, description, and grouped navigation in `apiReference` front
 * matter: one group per tag, then the untagged operations as top-level links. This layout renders
 * that model with one heading per group and one introduction per operation.
 *
 * The navigation carries only a title and a URL, so the operation's method, path, and description
 * are read from the operation page the engine built beside the index. A link whose page is not in
 * `site.pages` (a hand-written entry) stays a plain link, and an operation without a description
 * shows the request line and its title alone.
 */

/** One navigation link the engine built. */
interface ReferenceLink {
  readonly title: string;
  readonly url: string;
}

/** The part of an operation the index shows before a reader opens its page. */
interface OperationSummary {
  readonly method: string;
  readonly path: string;
  readonly description?: string;
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

/** The operation a generated page carries, or undefined for a hand-written or unrelated page. */
function operationOf(page: LayoutProps["site"]["pages"][number] | undefined): OperationSummary | undefined {
  const reference = page?.frontMatter.apiReference;
  if (!isRecord(reference) || reference.kind !== "operation" || !isRecord(reference.operation)) return undefined;
  const operation = reference.operation;
  if (typeof operation.method !== "string" || typeof operation.path !== "string") return undefined;
  const description =
    typeof operation.description === "string" && operation.description.trim() !== "" ? operation.description : undefined;
  return {
    method: operation.method,
    path: operation.path,
    ...(description === undefined ? {} : { description }),
  };
}

/** The operations this reference built, keyed by the URL the index links to. */
function operationsByUrl(pages: LayoutProps["site"]["pages"]): ReadonlyMap<string, OperationSummary> {
  const operations = new Map<string, OperationSummary>();
  for (const page of pages) {
    const operation = operationOf(page);
    if (operation !== undefined) operations.set(page.url, operation);
  }
  return operations;
}

/** The request line, which is also the title the engine gives an operation without a summary. */
function requestLine(operation: OperationSummary): string {
  return `${operation.method.toUpperCase()} ${operation.path}`;
}

/**
 * One operation entry: the method, path, and description read from its page, with the link title
 * once. A link without a generated page stays a plain title link. When the engine used the request
 * line as the title, showing it again would repeat the method and path.
 */
function operationItem(link: ReferenceLink, operation: OperationSummary | undefined): ComponentChildren {
  if (operation === undefined) {
    return h("li", null, h("a", { class: "api-reference-index-link", href: link.url }, link.title));
  }
  const title = link.title.trim() === requestLine(operation) ? undefined : link.title;
  return h(
    "li",
    { class: "api-reference-index-item" },
    h(
      "a",
      { class: "api-reference-index-link api-reference-index-entry grid", href: link.url },
      h(
        "span",
        { class: "endpoint-line" },
        h("span", { class: `version-badge ${methodClassOf(operation.method)}` }, operation.method.toUpperCase()),
        " ",
        h("code", { class: "endpoint-path", dir: "ltr" }, operation.path),
      ),
      title === undefined ? null : h("strong", { class: "api-reference-index-title" }, title),
      operation.description === undefined
        ? null
        : h("p", { class: "api-reference-index-description" }, operation.description),
    ),
  );
}

/** One group of operation entries under its tag. */
function groupSection(entry: ReferenceGroup, operations: ReadonlyMap<string, OperationSummary>): ComponentChildren {
  return h(
    "section",
    { class: "api-reference-index-group" },
    h("h3", { class: "api-reference-index-group-title" }, entry.title),
    h(
      "ul",
      { class: "api-reference-index-list grid gap-3" },
      ...(entry.children ?? []).map((link) => operationItem(link, operations.get(link.url))),
    ),
  );
}

/** The untagged operations, which the engine publishes as top-level links. */
function otherSection(
  entries: readonly ReferenceGroup[],
  operations: ReadonlyMap<string, OperationSummary>,
  lang: string,
): ComponentChildren {
  if (entries.length === 0) return null;
  return h(
    "section",
    { class: "api-reference-index-group" },
    h("h3", { class: "api-reference-index-group-title" }, t(lang, "api_other_operations")),
    h(
      "ul",
      { class: "api-reference-index-list grid gap-3" },
      ...entries.map((entry) => operationItem({ title: entry.title, url: entry.url ?? "" }, operations.get(entry.url ?? ""))),
    ),
  );
}

/** The page's content: title, version, description, and the grouped operation links. */
function content(props: LayoutProps, model: ApiReferenceIndex): ComponentChildren {
  const lang = props.page.lang;
  const groups = model.navigation.filter((entry) => !isLink(entry));
  const links = model.navigation.filter(isLink);
  const operations = operationsByUrl(props.site.pages);
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
          ...groups.map((group) => groupSection(group, operations)),
          otherSection(links, operations, lang),
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
  return articleShell(props, { main: model === undefined ? fallback(props) : content(props, model) });
};

export default apiReferenceIndex;
