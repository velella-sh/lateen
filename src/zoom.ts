import { h } from "preact";
import { ChevronLeft, ChevronRight } from "lucide";
import { icon } from "./icon.ts";
import type { ComponentChild } from "preact";
import { t } from "../i18n/index.ts";

/** What the zoom panel needs: the trigger content, the address of the full-size image, and its name. */
export type ZoomOptions = {
  /** The id of the panel; the button's `popovertarget` points at it. The caller makes it unique per page. */
  id: string;
  /** The page language, for the button, the panel and its two links. */
  lang: string;
  /** The text alternative of the image. Empty for a decorative image. */
  alt: string;
  /** The inline content the button wraps, usually the image itself. */
  trigger: ComponentChild;
  /** The address of the full-size image, shown in the panel and offered as "Open full size". */
  full: string;
  /** The full-size image for dark mode. With it the panel holds one image and link per scheme, and shows the active one. */
  fullDark?: string;
  /** Set for one image of a multi-image figure: the ids of the previous and next panels, and this image's place. */
  gallery?: { readonly prev: string; readonly next: string; readonly position: number; readonly total: number };
};

/**
 * The zoom control: a button that opens a native popover panel with the image larger, plus an
 * "Open full size" link and a close button. It works without JavaScript. The markup and class names
 * are the figure's; later callers reuse them so every zoomable image looks and behaves the same.
 */
export function zoomable({ id, lang, alt, trigger, full, fullDark, gallery }: ZoomOptions) {
  const place = gallery === undefined ? "" : t(lang, "figure_zoom_position", { n: gallery.position, total: gallery.total });
  const paired = fullDark !== undefined && fullDark !== "" && fullDark !== full;
  // Class names are written out whole so the style coverage check finds them in source.
  const imageClass = { light: "figure-zoom-img figure-zoom-img-light", dark: "figure-zoom-img figure-zoom-img-dark" };
  const linkClass = { light: "figure-zoom-full figure-zoom-full-light", dark: "figure-zoom-full figure-zoom-full-dark" };
  const image = (src: string, scheme: "light" | "dark") =>
    h("img", { class: paired ? imageClass[scheme] : "figure-zoom-img", src, alt, loading: "lazy", decoding: "async" });
  const link = (href: string, scheme: "light" | "dark") =>
    h("a", { class: paired ? linkClass[scheme] : "figure-zoom-full", href }, t(lang, "figure_zoom_full"));
  return h(
    "div",
    { class: "figure-zoomable" },
    h(
      "button",
      { type: "button", class: "figure-zoom", popovertarget: id, "aria-label": `${t(lang, "figure_zoom")}${alt === "" ? "" : `: ${alt}`}` },
      trigger,
    ),
    h(
      "div",
      { id, popover: "auto", class: "figure-zoom-panel", role: "dialog", "aria-label": `${alt === "" ? t(lang, "figure_zoom") : alt}${place === "" ? "" : `, ${place}`}` },
      image(full, "light"),
      paired ? image(fullDark, "dark") : null,
      h(
        "div",
        { class: "figure-zoom-bar" },
        gallery === undefined
          ? null
          : h(
              "div",
              { class: "figure-zoom-nav" },
              h("button", { type: "button", class: "figure-zoom-prev", popovertarget: gallery.prev, "aria-label": t(lang, "figure_zoom_prev") }, icon({ node: ChevronLeft, class: "figure-zoom-nav-icon" })),
              h("span", { class: "figure-zoom-position" }, place),
              h("button", { type: "button", class: "figure-zoom-next", popovertarget: gallery.next, "aria-label": t(lang, "figure_zoom_next") }, icon({ node: ChevronRight, class: "figure-zoom-nav-icon" })),
            ),
        link(full, "light"),
        paired ? link(fullDark, "dark") : null,
        h("button", { type: "button", class: "figure-zoom-close", popovertarget: id, popovertargetaction: "hide" }, t(lang, "figure_zoom_close")),
      ),
    ),
  );
}
