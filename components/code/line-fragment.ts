/**
 * The line fragment a code block shares: `#<block>-L3` for one line and `#<block>-L3-L7` for a range.
 * Pure and dependency-free, so the browser island can read a hash without the highlighter.
 */

/** One line or an inclusive range, scoped to the block id in the fragment. */
export type LineFragment = {
  readonly block: string;
  readonly from: number;
  readonly to: number;
};

/** class added to the lines a fragment names. */
export const TARGET_CLASS = "targeted";

/** The fragment's block and line numbers, or `undefined` for any other hash. */
export function parseLineFragment(hash: string): LineFragment | undefined {
  const match = /^#(.+?)-L([1-9]\d*)(?:-L([1-9]\d*))?$/.exec(hash);
  if (match === null) return undefined;
  const from = Number(match[2]);
  const to = Number(match[3] ?? match[2]);
  return to < from ? undefined : { block: match[1]!, from, to };
}
