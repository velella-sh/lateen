/**
 * Line highlighting and line numbers for code blocks. Pure functions over the build-time HTML that Shiki
 * produces, so the code component can call them without any runtime cost.
 */

import { t } from "../../i18n/index.ts";
import { escapeHtml } from "./escape.ts";

/** A run of 1-based line numbers, inclusive: `3-5` is `{ from: 3, to: 5 }`. Same shape as the engine's `LineRange`. */
export type LineRange = { readonly from: number; readonly to: number };

export type LinesOptions = {
  /** Lines to highlight, from the fence's `{1,3-5}`. */
  highlight?: readonly LineRange[];
  /**
   * Number each line. The number is a `data-line` attribute and never text, so copying or selecting the
   * block gets only the code.
   */
  numbers?: boolean;
  /** The id a line's span gets, or `undefined` for none. An annotation uses it as its link target. */
  lineId?: (line: number) => string | undefined;
  /**
   * The block's stable id. When set, every line gets `${block}-L${line}` and a link to that fragment,
   * so one line or a range is shareable without JavaScript.
   */
  block?: string;
  /** Location-derived fragments kept as aliases after a block gets a stable identity. */
  legacyBlock?: string;
  legacyLineId?: (line: number) => string | undefined;
  /** Page language for the line link's label. */
  lang?: string;
};

/** Class on each line's `span`. */
export const LINE_CLASS = "line";

/** Class added to a line that a highlight range covers. */
export const HIGHLIGHT_CLASS = "highlighted";

/** Class on the link that names one line. */
export const LINE_LINK_CLASS = "line-link";

/** The stable fragment id of one line: the block id plus `-L` and its 1-based number. */
export function lineAnchorId(block: string, line: number): string {
  return `${block}-L${line}`;
}

/** The wrapper Shiki puts around each line: `<span class="line">…</span>`. */
const SHIKI_LINE = /^<span class="line">([\s\S]*)<\/span>$/;

/** True when some range covers `line`. */
export function isHighlighted(line: number, ranges: readonly LineRange[]): boolean {
  return ranges.some((range) => line >= range.from && line <= range.to);
}

/** The line's own tokens, without Shiki's wrapper, so the wrapper is not nested twice. */
function unwrapLine(line: string): string {
  return SHIKI_LINE.exec(line)?.[1] ?? line;
}

/**
 * Wraps each line of Shiki's inner HTML (one line per `\n`) in a `span.line`. Covered lines get the
 * `highlighted` class, and with `numbers` every line gets its number as `data-line`. With `block`, each
 * line also gets its shareable id and a focusable link whose glyph is CSS, so the code text is unchanged.
 */
export function decorateLines(innerHtml: string, options: LinesOptions = {}): string {
  const ranges = options.highlight ?? [];
  const block = options.block;
  return innerHtml
    .split("\n")
    .map((line, index) => {
      const number = index + 1;
      const classes = isHighlighted(number, ranges) ? `${LINE_CLASS} ${HIGHLIGHT_CLASS}` : LINE_CLASS;
      const id = options.lineId?.(number);
      const target = id === undefined ? "" : `<span id="${id}"></span>`;
      const anchorId = block === undefined ? undefined : lineAnchorId(block, number);
      const idAttr = anchorId === undefined ? "" : ` id="${anchorId}"`;
      const link =
        anchorId === undefined
          ? ""
          : `<a class="${LINE_LINK_CLASS}" href="#${anchorId}" aria-label="${escapeHtml(
              t(options.lang ?? "en", "code_line_link", { line: number }),
            )}"></a>`;
      const numberAttr = options.numbers ? ` data-line="${number}"` : "";
      const aliases = [
        options.legacyBlock === undefined ? undefined : lineAnchorId(options.legacyBlock, number),
        options.legacyLineId?.(number),
      ].filter((alias) => alias !== undefined && alias !== id && alias !== anchorId)
        .map((alias) => `<span id="${alias}"></span>`).join("");
      const content = `${link}${target}${aliases}${unwrapLine(line)}`;
      const cell = options.numbers
        ? `<span class="line-number" data-line="${number}" aria-hidden="true"></span><span class="line-code">${content}</span>`
        : content;
      return `<span class="${classes}"${idAttr}${numberAttr}>${cell}</span>`;
    })
    .join("\n");
}
