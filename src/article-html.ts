import { JSDOM } from "jsdom";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { anchorMarkdownHeadings } from "../components/heading-anchor/index.ts";
import { mathHtml } from "./math-html.ts";
import { REGION_ATTRIBUTE, WRAPPER_CLASS } from "../components/table/index.ts";
import { resolveImageOptions } from "./options.ts";
import { zoomable } from "./zoom.ts";

/** Images wider than this many pixels are larger than the article column and get a zoom panel. */
export const ZOOM_MIN_WIDTH = 720;

/** Turn on plain-image zoom: `prefix` keeps the panel ids unique when one page is built in several pieces. */
export type ImageZoom = { readonly prefix?: string };

/** A plain fence scrolls sideways, so the keyboard must be able to reach it. */
function focusablePre(html: string): string {
  return html.replace(/<pre((?:\s[^\s=>]+(?:="[^"]*")?)*)>/g, (tag, attrs: string) =>
    /\stabindex[=\s]/.test(`${attrs} `) ? tag : `<pre${attrs} tabindex="0">`,
  );
}

/** Prepare a rendered page body while keeping its source and legacy anchors. */
export function pageHtml(source: string, lang: string): string {
  const html = mathHtml(source, lang);
  if (!/<h[2-4]\b/i.test(html)) return html;
  const fragment = JSDOM.fragment(html);
  if (!anchorMarkdownHeadings(fragment, lang)) return html;
  const container = fragment.ownerDocument.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}

/** The zoom setting for `articleHtml` from `theme.options`: `undefined` unless `images.zoom` is `auto`. */
export function imageZoom(options: unknown, prefix?: string): ImageZoom | undefined {
  if (resolveImageOptions(options).zoom !== "auto") return undefined;
  return prefix === undefined ? {} : { prefix };
}

/**
 * Wrap each plain content image whose `width` attribute is above the article column in the shared zoom
 * panel. Images in links, figures, buttons, panels and components, and images marked `zoom="false"`,
 * stay as they are. Only the dimensions already on the page count; nothing is measured over the network.
 */
function zoomImages(html: string, lang: string, prefix: string): string {
  if (!/<img[\s>]/i.test(html)) return html;
  const fragment = JSDOM.fragment(html);
  const images = Array.from(fragment.querySelectorAll("img")).filter((img) => {
    if (img.getAttribute("zoom") === "false") return false;
    if (img.closest("a, figure, button, [popover], [class*='figure'], [data-component]") !== null) return false;
    const width = Number(img.getAttribute("width"));
    return Number.isInteger(width) && width > ZOOM_MIN_WIDTH && (img.getAttribute("src") ?? "") !== "";
  });
  if (images.length === 0) return html;
  const container = fragment.ownerDocument.createElement("div");
  images.forEach((img, index) => {
    const props: Record<string, string> = {};
    for (const { name, value } of Array.from(img.attributes)) props[name] = value;
    const panel = zoomable({
      id: `${prefix}${index + 1}`,
      lang,
      alt: img.getAttribute("alt") ?? "",
      trigger: h("img", props),
      full: img.getAttribute("src") ?? "",
    });
    img.replaceWith(JSDOM.fragment(renderToString(panel)));
  });
  container.append(fragment);
  return container.innerHTML;
}

/**
 * Keep the table display and its header relationships while the outer box scrolls, and let a plain
 * code fence take focus. With `zoom`, large plain images open larger in the shared zoom panel.
 */
export function articleHtml(source: string, lang = "en", zoom?: ImageZoom): string {
  const html = zoom === undefined ? pageHtml(focusablePre(source), lang) : zoomImages(pageHtml(focusablePre(source), lang), lang, zoom.prefix ?? "image-zoom-");
  if (!/<table[\s>]/i.test(html)) return html;

  const fragment = JSDOM.fragment(html);
  const tables = Array.from(fragment.querySelectorAll("table:not([class]), table[class='table']"))
    .filter((table) => table.closest(`.${WRAPPER_CLASS}`) === null);
  if (tables.length === 0) return html;

  const container = fragment.ownerDocument.createElement("div");
  for (const table of tables) {
    const scroll = container.ownerDocument.createElement("div");
    scroll.className = `${WRAPPER_CLASS} markdown-table-scroll`;
    scroll.setAttribute(REGION_ATTRIBUTE, "");
    scroll.tabIndex = 0;
    const caption = table.querySelector(":scope > caption")?.textContent?.trim();
    if (caption) {
      scroll.setAttribute("role", "region");
      scroll.setAttribute("aria-label", caption);
    }
    table.replaceWith(scroll);
    scroll.append(table);
  }
  container.append(fragment);
  return container.innerHTML;
}
