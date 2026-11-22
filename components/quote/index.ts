import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { importedCallout } from "../callout/index.ts";
import { textOf as trimmed } from "../../src/guards.ts";

/** The Markdown directive this component handles: `::quote{name="…" source="…"}`. */
export const directive = "quote";

/** Class on the figure, and on a bare blockquote when there is no attribution. */
export const ROOT_CLASS = "quote";

/** Class on the blockquote inside an attributed figure. */
export const BODY_CLASS = "quote-body";

/** Class on the attribution under the quote. */
export const CAPTION_CLASS = "quote-source";

/** Props from the directive: the words, an optional attribution name, and an optional source address. */
export type QuoteProps = {
  /** The words quoted. Without it the body of the directive is used. */
  text?: string;
  /** The person or work the words are attributed to, rendered as text. */
  name?: string;
  /** The source address. Only an absolute `http` or `https` address becomes a link; anything else is left out. */
  source?: string;
  title?: string;
  collapsible?: string | boolean;
  open?: string | boolean;
};

/** An absolute `http(s)` address with no space, quote, angle bracket, or backslash. */
const SAFE_URL = /^https?:\/\/[^\s"'<>\\]+$/i;

const textOf = (value: unknown): string => trimmed(value) ?? "";

/** The source link, or `undefined` when the address is not absolute `http(s)`. */
export function sourceHref(value: unknown): string | undefined {
  const url = textOf(value);
  return SAFE_URL.test(url) ? url : undefined;
}

/** The name and the source link under the quote, or `null` when there is neither. */
function captionOf(name: string, href: string | undefined) {
  if (name === "" && href === undefined) return null;
  const parts: ComponentChildren[] = [];
  if (name !== "") parts.push(name);
  if (href !== undefined) {
    if (name !== "") parts.push(", ");
    parts.push(h("a", { href, rel: "noopener" }, href));
  }
  return h("figcaption", { class: CAPTION_CLASS }, ...parts);
}

/**
 * A quotation with an optional attribution. With a name or a safe source it is a `figure` holding a
 * `blockquote` and a `figcaption`; without one it is a bare `blockquote`. The name is text, the source
 * is a link only when it is an absolute `http(s)` address, and the text wraps in its column.
 */
const quoteCallout = importedCallout("quote");

export default function quote(input: ComponentProps<QuoteProps>) {
  const { props, html } = input;
  const bareBody = props.text === undefined && props.name === undefined && props.source === undefined && html.trim() !== "";
  if (props.collapsible !== undefined || props.title !== undefined || bareBody) {
    return quoteCallout({ ...input, html: `<blockquote class="quote">${html}</blockquote>` });
  }
  const written = textOf(props.text);
  const name = textOf(props.name);
  const href = sourceHref(props.source);
  const caption = captionOf(name, href);

  const bodyOf = (className: string) => {
    const attrs = { class: className, ...(href === undefined ? {} : { cite: href }) };
    if (written !== "") return h("blockquote", attrs, h("p", null, written));
    if (html.trim() === "") return null;
    return h("blockquote", { ...attrs, dangerouslySetInnerHTML: { __html: html } });
  };

  if (caption === null) return bodyOf(ROOT_CLASS);
  const body = bodyOf(BODY_CLASS);
  if (body === null) return null;
  return h("figure", { class: ROOT_CLASS }, body, caption);
}
