import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import code from "../code/index.ts";
import { absoluteUrl, embeddedOf, isEmbedded } from "../../layouts/embedded.ts";
import { t } from "../../i18n/index.ts";
import { frameSnippet, htmlSnippet, markdownSnippet, SANDBOX, type FrameInfo, type SnippetInfo } from "./snippet.ts";

/** The options the directive reads, documented on `site/components/embed-code.md`. */
export const OPTIONS = ["src", "title"] as const;

/** Class on the root: the choices, the three formats and the preview. */
export const EMBED_CODE_CLASS = "embed-code";

/** Class on the message shown when the site has no `url`. */
export const DIAGNOSTIC_CLASS = "embed-code-diagnostic";

/** Class on one format's panel. */
export const PANEL_CLASS = "embed-code-panel";

/** Class on the choice of variant. */
export const VARIANTS_CLASS = "embed-code-variants";

/** Class on one variant's frame code. */
export const VARIANT_CLASS = "embed-code-variant";

/** Class on the note that copies do not update. */
export const NOTE_CLASS = "embed-code-note";

/** Class on the preview area. */
export const PREVIEW_CLASS = "embed-code-preview";

/** Class on the button that loads the preview. It starts `hidden`; the island reveals it. */
export const PREVIEW_BUTTON_CLASS = "embed-code-preview-load";

/** Class on the link to the embedded page, which stays as the no-JavaScript way to see it. */
export const PREVIEW_LINK_CLASS = "embed-code-preview-link";

/** Props from the directive: `::embed-code{src=… title=…}`. */
export type EmbedCodeProps = {
  /** The embedded page: its site path (`/lateen/embed/guide/`) or an absolute address. */
  src?: string;
  /** Accessible name of the frame. Defaults to the embedded page's title. */
  title?: string;
};

/** One published variant of the embedded view: an embedded page and what it declares. */
export interface Variant extends FrameInfo {
  readonly scheme: string;
}

/** The pages of the site, found by path ignoring a trailing slash. */
function findPage(site: Site, src: string): Page | undefined {
  const path = (value: string): string => {
    try {
      return new URL(value, "https://x.invalid").pathname.replace(/\/+$/, "");
    } catch {
      return value;
    }
  };
  const wanted = path(src);
  return site.pages.find((page) => path(page.url) === wanted);
}

/** Short facts for the copies: the page's `description` and the `embedded.facts` list, as text. */
export function factsOf(page: Page | undefined): string[] {
  if (page === undefined) return [];
  const facts: string[] = [];
  const description = page.frontMatter.description;
  if (typeof description === "string" && description.trim() !== "") facts.push(description.trim());
  const embedded = page.frontMatter.embedded;
  const listed = typeof embedded === "object" && embedded !== null ? (embedded as { facts?: unknown }).facts : undefined;
  if (Array.isArray(listed)) {
    for (const fact of listed) if (typeof fact === "string" && fact.trim() !== "") facts.push(fact.trim());
  }
  return facts;
}

/**
 * The variants to offer for an embedded page: every embedded page of the site that shows the same full
 * page (`embedded.of`), in URL order, so a site that publishes a light and a dark view offers both. A
 * page that names no full page is its own only variant. A variant whose address cannot be made absolute
 * is left out.
 */
export function variantsOf(site: Site, target: Page | undefined, src: string, title: string): Variant[] {
  const frame = (page: Page | undefined, address: string): Variant | undefined => {
    const settings = page === undefined ? undefined : embeddedOf(page);
    const absolute = absoluteUrl(site.config, address);
    if (absolute === undefined) return undefined;
    return { src: absolute, title, height: settings?.height ?? 360, scheme: settings?.scheme ?? "auto" };
  };
  const of = target === undefined || !isEmbedded(target) ? undefined : embeddedOf(target).of;
  const siblings =
    of === undefined
      ? [target]
      : site.pages.filter((page) => isEmbedded(page) && embeddedOf(page).of === of).sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const variants: Variant[] = [];
  for (const page of siblings.length === 0 ? [target] : siblings) {
    const variant = frame(page, page?.url ?? src);
    if (variant !== undefined) variants.push(variant);
  }
  return variants;
}

/** A code block of HTML or Markdown text, drawn by the `code` component so it highlights and copies like any other. */
function block(props: ComponentProps<EmbedCodeProps>, text: string, lang: string) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return code({ ...props, props: { lang }, html: `<pre><code class="language-${lang}">${escaped}</code></pre>` });
}

/**
 * `::embed-code{src=… title=…}` shows the code that embeds a page. The first panel is the `iframe`; the
 * second is a static HTML copy and the third the same as Markdown, for sites that block frames, with a
 * note that copies do not update. Each block is a `code` block, so highlighting and the copy button
 * come from there. A site that publishes several embedded views of one page gets a choice of variant:
 * the code and the preview change together. The preview loads the embedded page only when the reader
 * asks; without JavaScript a link opens it. Without a site `url` the address cannot be absolute, so
 * the component says so instead of showing code.
 */
export default function embedCode(args: ComponentProps<EmbedCodeProps>) {
  const { props, site, page } = args;
  const lang = page.lang;
  const src = typeof props.src === "string" ? props.src.trim() : "";
  if (src === "") return null;

  const target = findPage(site, src);
  const title = (typeof props.title === "string" ? props.title.trim() : "") || target?.title || page.title;
  const variants = variantsOf(site, target, src, title);
  const first = variants[0];
  if (first === undefined) {
    return h("p", { class: DIAGNOSTIC_CLASS, role: "note" }, t(lang, "embed_code_no_url"));
  }

  const fullOf = target === undefined || !isEmbedded(target) ? undefined : embeddedOf(target).of;
  const fullHref = (fullOf === undefined ? undefined : absoluteUrl(site.config, fullOf)) ?? first.src;
  const info: SnippetInfo = { title, facts: factsOf(target), href: fullHref };

  const label = (variant: Variant) => t(lang, "embed_code_variant", { scheme: t(lang, `embed_code_scheme_${variant.scheme}`), height: variant.height });
  const many = variants.length > 1;

  const panel = (id: string, name: string, children: ComponentChildren) =>
    h("section", { class: PANEL_CLASS, id: `embed-code-${id}`, "data-embed-panel": id }, h("h3", { class: "embed-code-panel-title" }, name), children);

  return h(
    "div",
    { class: EMBED_CODE_CLASS, "data-embed-code": "", "data-sandbox": SANDBOX },
    h("div", { class: "embed-code-tablist", role: "tablist", hidden: true, "aria-label": t(lang, "embed_code_formats") }),
    many
      ? h(
          "div",
          { class: VARIANTS_CLASS, hidden: true, "data-embed-variants": "" },
          h("label", null, t(lang, "embed_code_choose"), " ", h("select", { "data-embed-variant-select": "" }, variants.map((variant, i) => h("option", { value: String(i) }, label(variant))))),
        )
      : null,
    panel(
      "frame",
      t(lang, "embed_code_frame"),
      variants.map((variant, i) =>
        h(
          "div",
          { class: VARIANT_CLASS, "data-embed-variant": String(i), "data-src": variant.src, "data-height": String(variant.height) },
          many ? h("p", { class: "embed-code-variant-label" }, label(variant)) : null,
          block(args, frameSnippet(variant), "html"),
        ),
      ),
    ),
    panel("html", t(lang, "embed_code_html"), block(args, htmlSnippet(info), "html")),
    panel("markdown", t(lang, "embed_code_markdown"), block(args, markdownSnippet(info), "markdown")),
    h("p", { class: NOTE_CLASS }, t(lang, "embed_code_stale")),
    h(
      "div",
      { class: PREVIEW_CLASS, "data-embed-preview": "", "data-title": title },
      h("button", { type: "button", class: PREVIEW_BUTTON_CLASS, hidden: true, "data-embed-preview-load": "" }, t(lang, "embed_code_preview")),
      h("a", { class: PREVIEW_LINK_CLASS, href: first.src, target: "_blank", rel: "noopener noreferrer" }, t(lang, "embed_code_preview_link")),
    ),
  );
}
