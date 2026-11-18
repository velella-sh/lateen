import { h } from "preact";
import type { ComponentChildren } from "preact";
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

/** Text trimmed, or undefined when it is missing, blank, or not a string. */
function textOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text === "" ? undefined : text;
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
  /** One short line about the item. */
  summary?: string;
  /** The item's state, as plain text. */
  status?: string;
};

/**
 * One gallery card: a single link holding a decorative cover, the title, an optional summary, and an
 * optional status. Without a safe href or a title it renders as static content instead, so a
 * malformed card never becomes an unlabeled or `javascript:` link.
 */
export default function galleryCard({ href, id, title, cover, summary, status }: GalleryCardProps) {
  const safeHref = hrefOf(href);
  const heading = textOf(title);
  const image = textOf(cover);
  const body = textOf(summary);
  const state = textOf(status);

  const parts: ComponentChildren[] = [
    image === undefined
      ? heading === undefined
        ? null
        : tile({ title: heading, id: textOf(id) ?? href })
      : h("img", { class: COVER_CLASS, src: image, alt: "" }),
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
