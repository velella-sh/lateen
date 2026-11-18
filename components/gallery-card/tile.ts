import { h } from "preact";
import type { ComponentChild } from "preact";

/** The tile that stands in for a missing cover. */
export const TILE_CLASS = "gallery-card-tile";

/** The status colour pairs a tile picks from; `style.css` carries one class per entry. */
export const TILE_TONES = ["positive", "caution", "negative", "neutral", "info"] as const;

/** FNV-1a over the id, so the same record always gets the same tone. */
export function toneOf(id: string): number {
  let hash = 0x811c9dc5;
  for (const ch of id) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % TILE_TONES.length;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The title's first grapheme, so a letter in any script and its marks stay whole. */
export function firstLetter(title: string): string {
  const text = title.trim();
  if (text === "") return "";
  return [...graphemes.segment(text)][0]?.segment ?? "";
}

export type TileProps = {
  /** The card's title; its first letter is drawn. */
  title: string;
  /** The record's id, which picks the tone. */
  id: string;
};

/** A decorative tile with the title's first letter, hidden from assistive technology because the title names the card. */
export default function tile({ title, id }: TileProps): ComponentChild {
  const letter = firstLetter(title);
  if (letter === "") return null;
  return h("span", { class: `${TILE_CLASS} ${TILE_CLASS}-${toneOf(id)}`, "aria-hidden": "true" }, letter);
}
