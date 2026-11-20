import { h } from "preact";
import type { ComponentChildren } from "preact";
import { textOf } from "../../src/guards.ts";
import { hrefOf } from "../cards/index.ts";
import tile from "./tile.ts";

/** The card itself: the whole card is one link, so the focus ring covers it. */
export const GALLERY_CARD_CLASS = "gallery-card";

/** The cover image or logo, kept to one ratio so cards line up before images load. */
export const COVER_CLASS = "gallery-card-cover";

/** Wraps the text under the cover, so the cover can run to the card's edges. */
export const BODY_CLASS = "gallery-card-body";

/** Class on the title. */
export const TITLE_CLASS = "gallery-card-title";

/** Class on the short summary. */
export const SUMMARY_CLASS = "gallery-card-summary";

/** Class on the status. */
export const STATUS_CLASS = "gallery-card-status";

/** The cards in the desktop grid's first row; four fills one row, so they load eagerly. */
export const FIRST_ROW = 4;

/** A positive whole pixel size, or undefined so the theme's 16:9 cover ratio reserves the space. */
function pixels(value: unknown): number | undefined {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d+$/.test(text)) return undefined;
  const number = Number(text);
  return number > 0 ? number : undefined;
}

export type GalleryCardProps = {
  /** Where the whole card goes. Only safe destinations become links; see hrefOf. */
  href: string;
  /** The record's id, which gives a coverless card its stable tile tone. Falls back to the href. */
  id?: string;
  /** The item's name. A blank title renders static content, never an unnamed link. */
  title: string;
  /** The cover image or logo. Decorative, because the title already names the item. */
  cover?: string;
  /** Intrinsic cover width in pixels, when the record carries one. */
  width?: number | string;
  /** Intrinsic cover height in pixels, when the record carries one. */
  height?: number | string;
  /** The engine's responsive candidates for `cover`, passed to `srcset`. */
  srcset?: string;
  /** Layout hint for `srcset`, passed to `sizes`. */
  sizes?: string;
  /** Zero-based place in the grid: the first row loads eagerly, the rest lazily. */
  index?: number;
  /** One short line about the item. */
  summary?: string;
  /** The item's state, as plain text. */
  status?: string;
};

/**
 * One gallery card: a single link holding a decorative cover, the title, an optional summary, and an
 * optional status. The cover reserves its space with the record's dimensions or the theme's ratio,
 * loads eagerly in the first row and lazily after it, and uses the engine's responsive candidates
 * when the record has them. Without a safe href or a title it renders as static content instead, so
 * a malformed card never becomes an unlabeled or `javascript:` link.
 */
export default function galleryCard({
  href,
  id,
  title,
  cover,
  width,
  height,
  srcset,
  sizes,
  index,
  summary,
  status,
}: GalleryCardProps) {
  const safeHref = hrefOf(href);
  const heading = textOf(title);
  const image = textOf(cover);
  const body = textOf(summary);
  const state = textOf(status);
  const lazy = typeof index === "number" && index >= FIRST_ROW;

  const parts: ComponentChildren[] = [
    image === undefined
      ? heading === undefined
        ? null
        : tile({ title: heading, id: textOf(id) ?? href })
      : h("img", {
          class: COVER_CLASS,
          src: image,
          alt: "",
          width: pixels(width),
          height: pixels(height),
          srcset: textOf(srcset),
          sizes: textOf(sizes),
          loading: lazy ? "lazy" : "eager",
        }),
    h(
      "span",
      { class: BODY_CLASS },
      heading === undefined ? null : h("span", { class: TITLE_CLASS }, heading),
      body === undefined ? null : h("span", { class: SUMMARY_CLASS }, body),
      state === undefined ? null : h("span", { class: STATUS_CLASS }, state),
    ),
  ];

  if (safeHref === undefined || heading === undefined) {
    return h("div", { class: GALLERY_CARD_CLASS }, ...parts);
  }
  return h("a", { class: GALLERY_CARD_CLASS, href: safeHref }, ...parts);
}
