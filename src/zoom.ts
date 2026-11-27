import { h } from "preact";
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
};

/**
 * The zoom control: a button that opens a native popover panel with the image larger, plus an
 * "Open full size" link and a close button. It works without JavaScript. The markup and class names
 * are the figure's; later callers reuse them so every zoomable image looks and behaves the same.
 */
export function zoomable({ id, lang, alt, trigger, full }: ZoomOptions) {
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
      { id, popover: "auto", class: "figure-zoom-panel", role: "dialog", "aria-label": alt === "" ? t(lang, "figure_zoom") : alt },
      h("img", { class: "figure-zoom-img", src: full, alt, loading: "lazy", decoding: "async" }),
      h(
        "div",
        { class: "figure-zoom-bar" },
        h("a", { class: "figure-zoom-full", href: full }, t(lang, "figure_zoom_full")),
        h("button", { type: "button", class: "figure-zoom-close", popovertarget: id, popovertargetaction: "hide" }, t(lang, "figure_zoom_close")),
      ),
    ),
  );
}
