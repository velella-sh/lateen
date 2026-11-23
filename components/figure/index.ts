import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { parseJson, textOf as trimmed } from "../../src/guards.ts";
import { t } from "../../i18n/index.ts";
import { instanceId } from "../../src/page-ids.ts";
import { baseOf, safeHref, srcsetWithBase, withBase } from "../../src/url.ts";

/** Class on the `<figure>` element. */
export const FIGURE_CLASS = "figure";

/** Class added to a figure that has a dark image, so its styles can swap the pair. */
export const PAIRED_CLASS = "figure-paired";

/** The class of the paired figure's dark image; `style.css` keeps it out of view in every theme. */
export const DARK_IMAGE_CLASS = "figure-img figure-img-dark";

/** The wrapper that owns a pair's one accessible identity; both images inside it are presentational. */
export const PAIR_CLASS = "figure-pair";

/** Props from the directive: `:::figure{src=… alt=… caption=…}` or `::figure{src=…}`. Every value is a string. */
export type FigureProps = {
  /** The image. Without it (or `images`) the figure renders nothing. */
  src?: string;
  /** A JSON list of `{ "src", "alt" }` images, shown together with one shared caption instead of `src`. */
  images?: string;
  /** A stable id for linking to the figure. Repeated ids get a numeric suffix on the page. */
  id?: string;
  /** The image shown in dark mode. Without it, or when equal to `src`, one image is shown in both modes. */
  src_dark?: string;
  /** Text alternative for the image. Empty when missing, which marks the image as decorative. In a paired figure it names the wrapper, and both images stay presentational. */
  alt?: string;
  /** Caption text. When missing, the body of the directive is the caption. */
  caption?: string;
  /** Who made the image, shown under the caption. */
  credit?: string;
  /** Link for the credit. Only `http` and `https` addresses become links. */
  credit_url?: string;
  /** Address of the full-size image. An `https` address or a same-site path wraps the image in a link. */
  href?: string;
  /** Responsive image candidates for `src` (the light image), passed to `srcset`. */
  srcset?: string;
  /** Layout hint for `srcset`, passed to `sizes`. */
  sizes?: string;
  /** Intrinsic width in pixels, so the layout does not shift when the image loads. */
  width?: string;
  /** Intrinsic height in pixels, so the layout does not shift when the image loads. */
  height?: string;
  /** Set to `true` to let the image open larger in place. Works without JavaScript; the `href` link stays as the fallback. */
  zoom?: string;
  /** `lazy` (the default) or `eager`. Use `eager` for an image above the fold. */
  loading?: string;
  /** `async` (the default), `sync`, or `auto`. */
  decoding?: string;
};

const LOADING = ["lazy", "eager"] as const;
const DECODING = ["async", "sync", "auto"] as const;

/** A whole number above zero, or `undefined` when the value is not one. */
export function dimension(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;
  const number = Number(value.trim());
  return number > 0 ? number : undefined;
}

/** The credit link, or `undefined` unless it is an `http` or `https` address. */
export function creditHref(value: unknown): string | undefined {
  return safeHref(value);
}

/** The full-size image link, or `undefined` unless it is an `https` address or a root-relative same-site path. */
export function fullSizeHref(base: string, value: unknown): string | undefined {
  const href = safeHref(value, ["https:"]);
  return href === undefined ? undefined : withBase(base, href);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function text(value: unknown): string {
  return trimmed(value) ?? "";
}

/** The images in a JSON `images` prop, keeping only entries with a usable `src`. Invalid JSON gives none. */
export function imageList(value: unknown): { src: string; alt: string }[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { src, alt } = entry as { src?: unknown; alt?: unknown };
    const address = text(src);
    return address === "" ? [] : [{ src: address, alt: typeof alt === "string" ? alt : "" }];
  });
}

/** The id an author gave, reduced to letters, digits, `-` and `_`; "" when nothing usable is left. */
export function idBase(raw: unknown): string {
  return typeof raw === "string"
    ? raw
        .trim()
        .replace(/[^\p{L}\p{N}_-]+/gu, "-")
        .replace(/^-+|-+$/g, "")
    : "";
}

/** The caption and credit under the image, or `null` when there is neither. */
function captionOf(props: FigureProps, html: string) {
  const caption = text(props.caption);
  const credit = text(props.credit);
  const href = creditHref(props.credit_url);

  let body = null;
  if (caption !== "") body = h("div", { class: "figure-text" }, caption);
  else if (html.trim() !== "") body = h("div", { class: "figure-text", dangerouslySetInnerHTML: { __html: html } });

  const creditNode =
    credit === ""
      ? null
      : h(
          "div",
          { class: "figure-credit" },
          href === undefined ? credit : h("a", { href, rel: "noopener" }, credit),
        );

  if (body === null && creditNode === null) return null;
  return h("figcaption", { class: "figure-caption" }, body, creditNode);
}

/**
 * An image with an optional caption and credit. It reserves its space with `width` and `height`, loads
 * lazily unless told otherwise, and with `src_dark` swaps to a second image in dark mode (`style.css`).
 * A pair keeps one accessible identity on its wrapper (`role="img"`, `aria-label`), while both images
 * are presentational (`alt=""`, `aria-hidden`), so assistive technology meets the figure exactly once in
 * either theme, with custom CSS, in forced colors, and before the styles load. The caption and credit
 * sit outside the wrapper, so they stay readable and a credit link stays operable. With `href`, the image
 * alone becomes a link to its full-size version, so the caption and credit stay outside the link too.
 * The body arrives already rendered to HTML. An author `id` names the figure for fragment links and is made unique per page.
 */
export default function figure({ props, html, site, page }: ComponentProps<FigureProps>) {
  const authored = text(props.src);
  const gallery = imageList(props.images);
  if (authored === "" && gallery.length < 2) return null;
  const base = baseOf(site);
  const src = withBase(base, authored);
  const alt = typeof props.alt === "string" ? props.alt : "";
  const authoredId = idBase(props.id);
  const id = authoredId === "" ? undefined : instanceId(page, authoredId);
  const authoredDark = text(props.src_dark);
  const darkSrc = authoredDark === "" ? "" : withBase(base, authoredDark);
  const paired = gallery.length < 2 && darkSrc !== "" && darkSrc !== src;
  const shared = {
    width: dimension(props.width),
    height: dimension(props.height),
    loading: oneOf(props.loading, LOADING, "lazy"),
    decoding: oneOf(props.decoding, DECODING, "async"),
  };

  const light = h("img", {
    class: paired ? "figure-img figure-img-light" : "figure-img",
    src,
    alt: paired ? "" : alt,
    "aria-hidden": paired ? "true" : undefined,
    srcset: typeof props.srcset === "string" && props.srcset !== "" ? srcsetWithBase(base, props.srcset) : undefined,
    sizes: typeof props.sizes === "string" && props.sizes !== "" ? props.sizes : undefined,
    ...shared,
  });
  const dark = paired
    ? h("img", { class: DARK_IMAGE_CLASS, src: darkSrc, alt: "", "aria-hidden": "true", ...shared })
    : null;
  const pair = paired
    ? h("div", { class: PAIR_CLASS, role: alt === "" ? undefined : "img", "aria-label": alt === "" ? undefined : alt }, light, dark)
    : light;
  const href = fullSizeHref(base, props.href);
  const zoomed = props.zoom === "true" && gallery.length < 2 && !paired;
  const lang = typeof page.lang === "string" ? page.lang : "en";
  const zoomId = zoomed ? instanceId(page, `${id ?? "figure"}-zoom`) : "";
  const full = href ?? src;
  const single = zoomed
    ? h(
        "div",
        { class: "figure-zoomable" },
        h(
          "button",
          { type: "button", class: "figure-zoom", popovertarget: zoomId, "aria-label": `${t(lang, "figure_zoom")}${alt === "" ? "" : `: ${alt}`}` },
          light,
        ),
        h(
          "div",
          { id: zoomId, popover: "auto", class: "figure-zoom-panel", role: "dialog", "aria-label": alt === "" ? t(lang, "figure_zoom") : alt },
          h("img", { class: "figure-zoom-img", src: full, alt, loading: "lazy", decoding: "async" }),
          h(
            "div",
            { class: "figure-zoom-bar" },
            h("a", { class: "figure-zoom-full", href: full }, t(lang, "figure_zoom_full")),
            h("button", { type: "button", class: "figure-zoom-close", popovertarget: zoomId, popovertargetaction: "hide" }, t(lang, "figure_zoom_close")),
          ),
        ),
      )
    : href === undefined
      ? pair
      : h("a", { class: "figure-link", href }, pair);
  // Every gallery image keeps its own alt; src_dark, href, srcset and sizes describe the single image only.
  const media =
    gallery.length < 2
      ? single
      : h(
          "div",
          { class: "figure-images" },
          gallery.map((image) =>
            h("img", { class: "figure-img", src: withBase(base, image.src), alt: image.alt, ...shared }),
          ),
        );

  return h(
    "figure",
    { class: paired ? `${FIGURE_CLASS} ${PAIRED_CLASS}` : FIGURE_CLASS, ...(id === undefined ? {} : { id }) },
    media,
    captionOf(props, html),
  );
}
