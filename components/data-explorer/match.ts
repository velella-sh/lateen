/* The data explorer's matcher: it normalizes the searched text once per row when the index loads,
 * then matches every query token as a prefix of a word. Plain rows in, ranked rows out; the module
 * reads no page module and touches no DOM, so a test needs no browser. */

import type { CollectionIndex, IndexCell, IndexRow } from "./index-loader.ts";

/** Arabic and Persian letters writers use interchangeably, mapped to the form matching compares in. */
const LETTER_VARIANTS: Readonly<Record<string, string>> = {
  "\u0622": "\u0627", // آ → ا
  "\u0623": "\u0627", // أ → ا
  "\u0625": "\u0627", // إ → ا
  "\u0624": "\u0648", // ؤ → و
  "\u0626": "\u06cc", // ئ → ی
  "\u0629": "\u0647", // ة → ه
  "\u0643": "\u06a9", // ك → ک
  "\u0649": "\u06cc", // ى → ی
  "\u064a": "\u06cc", // ي → ی
  "\u0671": "\u0627", // ٱ → ا
  "\u06c0": "\u0647", // ۀ → ه
  "\u06d5": "\u0647", // ە (NFKD's base for ۀ) → ه
};

const VARIANT = new RegExp(`[${Object.keys(LETTER_VARIANTS).join("")}]`, "g");

/** The tatweel that joins letters without a sound. */
const TATWEEL = /\u0640/g;

/** A non-word run: punctuation, whitespace, and zero-width joiners separate words. */
const NON_WORD = /[^\p{L}\p{N}]+/gu;

/** Persian and Arabic digits, mapped to the ASCII digits matching compares. */
function asciiDigits(_digit: string, at: number, text: string): string {
  const code = text.charCodeAt(at);
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
  return String(code - 0x0660);
}

/**
 * Text as matching compares it: NFKD with combining marks removed, Arabic letter forms folded to
 * their Persian form, Persian and Arabic digits as ASCII, lower case, and words separated by single
 * spaces. The result is locale-independent, so the same query matches in any page language.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(TATWEEL, "")
    .replace(VARIANT, (letter) => LETTER_VARIANTS[letter] ?? letter)
    .replace(/[\u06f0-\u06f9]/g, asciiDigits)
    .replace(/[\u0660-\u0669]/g, asciiDigits)
    .toLowerCase()
    .replace(NON_WORD, " ")
    .trim();
}

/** The words of a text, as matching compares them. */
function wordsOf(text: string): string[] {
  const normalized = normalize(text);
  return normalized === "" ? [] : normalized.split(" ");
}

/** A cell as text; `null` and a missing cell are empty, and a list is joined with spaces. */
function textOf(cell: IndexCell | undefined): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") return cell.map((item) => String(item)).join(" ");
  return String(cell);
}

/** One row's searched text and title, normalized once when the index loads. */
export interface PreparedRow {
  /** The raw row, kept by reference and never copied. */
  readonly row: IndexRow;
  /** Every word of the searched fields, including the other names. */
  readonly words: readonly string[];
  /** The title field's words, or none for a collection without a searched title. */
  readonly title: readonly string[];
}

/**
 * Prepares every row of a loaded index for matching. `fields` is the explorer's searched columns in
 * display order; `aliases` names the field that holds a record's other names, which is searched too
 * even though the table never shows it. The title field ranks second when `fields` names it.
 */
export function prepareRows(
  index: CollectionIndex,
  fields: readonly string[],
  aliases?: string,
): PreparedRow[] {
  const positions = fields.map((field) => index.columns.indexOf(field)).filter((at) => at >= 0);
  const aliasAt = aliases === undefined ? -1 : index.columns.indexOf(aliases);
  if (aliasAt >= 0 && !positions.includes(aliasAt)) positions.push(aliasAt);
  const titleAt = fields.includes("title") ? index.columns.indexOf("title") : -1;

  return index.rows.map((row) => ({
    row,
    words: positions.flatMap((at) => wordsOf(textOf(row[at]))),
    title: titleAt < 0 ? [] : wordsOf(textOf(row[titleAt])),
  }));
}

/** True when `token` is a whole word of `words`. */
function isWord(token: string, words: readonly string[]): boolean {
  return words.includes(token);
}

/** True when `token` starts any word of `words`. */
function startsWord(token: string, words: readonly string[]): boolean {
  return words.some((word) => word.startsWith(token));
}

/**
 * The rows that match every query token, in rank order: exact matches, then rows whose every token
 * starts a title word, then the rest. Rows within a tier keep the index's source order. An empty
 * query matches every row in source order, and a token never matches the middle of a word.
 */
export function matchRows(prepared: readonly PreparedRow[], query: string): readonly IndexRow[] {
  const tokens = wordsOf(query);
  if (tokens.length === 0) return prepared.map((entry) => entry.row);

  const exact: IndexRow[] = [];
  const title: IndexRow[] = [];
  const rest: IndexRow[] = [];
  for (const entry of prepared) {
    if (!tokens.every((token) => startsWord(token, entry.words))) continue;
    if (tokens.every((token) => isWord(token, entry.words))) exact.push(entry.row);
    else if (tokens.every((token) => startsWord(token, entry.title))) title.push(entry.row);
    else rest.push(entry.row);
  }
  return [...exact, ...title, ...rest];
}
