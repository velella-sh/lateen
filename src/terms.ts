import { publicFieldsOf } from "./public-fields.ts";
import type { Site } from "@velella/mizzen/contracts";
import { optionOf } from "./options.ts";

/**
 * One glossary term in the page's language. The term, definition and other names are read from the
 * collection named by `theme.options.glossary.collection`, whose fields are `term`, `definition` and
 * `aliases`; a localized field is a mapping keyed by language, such as `{ en: "Network", fa: "شبکه" }`.
 */
export interface Term {
  /** The record's id, which also finds the term. */
  readonly id: string;
  /** The term as the glossary shows it. */
  readonly term: string;
  /** The definition as the source writes it, Markdown included. */
  readonly definition: string;
  /** Other names the term answers to, in this language. */
  readonly aliases: readonly string[];
}

/** The Arabic/Persian letters writers use interchangeably, mapped to the Persian form compared in. */
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
};

const VARIANT = new RegExp(`[${Object.keys(LETTER_VARIANTS).join("")}]`, "g");

/** Arabic diacritics and the tatweel that joins letters without a sound. */
const DIACRITICS = /[\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/g;

/** Zero-width characters, including the Persian ZWNJ that joins two parts of one word. */
const ZERO_WIDTH = /[\u200b-\u200d\ufeff]/g;

/**
 * Text as the lookup compares it: NFC, no diacritics, tatweel or zero-width characters, Persian
 * letter forms, and lower case. `كتاب` and `کتاب`, or `می‌رود` and `میرود`, are one term.
 */
export function normalizeTerm(text: string): string {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(DIACRITICS, "")
    .replace(VARIANT, (letter) => LETTER_VARIANTS[letter] ?? letter)
    .trim()
    .toLowerCase();
}

/** True for a plain object, never an array or `null`. */
function isMapping(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A field's value in `lang`, else in the site's default language; untranslated data stays as is. */
function localized(value: unknown, lang: string, defaultLang: string): unknown {
  if (!isMapping(value)) return value;
  if (Object.hasOwn(value, lang)) return value[lang];
  if (Object.hasOwn(value, defaultLang)) return value[defaultLang];
  return value;
}

/** A scalar as text; a value a term cannot show reads as empty. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}

/** The other names as a list, from a list or a single name. */
function aliasesOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((item) => {
    const name = typeof item === "string" ? item.trim() : "";
    return name === "" ? [] : [name];
  });
}

/** The collection `theme.options.glossary.collection` names, or `undefined` when no option does. */
export function glossaryCollectionName(site: Site): string | undefined {
  const glossary = optionOf(site.config.theme?.options, "glossary");
  if (!isMapping(glossary)) return undefined;
  const name = glossary.collection;
  return typeof name === "string" && name.trim() !== "" ? name.trim() : undefined;
}

/**
 * The page address from `theme.options.glossary.page` in `pageLang`: a string shared by every
 * language, or a mapping such as `{ en: "/glossary/", fa: "/fa/glossary/" }`. The value is returned
 * as the site wrote it, without the site base; a caller adding a link applies the base.
 */
export function glossaryPage(site: Site, pageLang: string): string | undefined {
  const glossary = optionOf(site.config.theme?.options, "glossary");
  if (!isMapping(glossary)) return undefined;

  const defaultLang = site.config.lang;
  const lang = pageLang.trim() === "" ? defaultLang : pageLang.trim();
  const value = localized(glossary.page, lang, defaultLang);
  const page = typeof value === "string" ? value.trim() : "";
  return page === "" ? undefined : page;
}

/**
 * Every term of the glossary collection in `pageLang`, falling back to the site's default language
 * for a record or field with no translation. A site with no glossary option, or one naming a
 * collection the site does not declare, has no terms; the caller renders no glossary instead of
 * failing the build.
 */
export function selectTerms(site: Site, pageLang: string): readonly Term[] {
  const name = glossaryCollectionName(site);
  if (name === undefined) return [];
  const collection = site.collections[name];
  if (collection === undefined) return [];

  const defaultLang = site.config.lang;
  const lang = pageLang.trim() === "" ? defaultLang : pageLang.trim();

  return collection.records.flatMap((record) => {
    const fields = publicFieldsOf(site, name, record.fields);
    const term = textOf(localized(fields.term, lang, defaultLang)).trim();
    if (term === "") return [];
    return [
      {
        id: record.id,
        term,
        definition: textOf(localized(fields.definition, lang, defaultLang)),
        aliases: aliasesOf(localized(fields.aliases, lang, defaultLang)),
      },
    ];
  });
}

/**
 * The term that answers to `query`, by its id, its text, or another name, ignoring case and the
 * Arabic/Persian letter forms. An empty query, or one no term answers to, is `undefined`.
 */
export function findTerm(terms: readonly Term[], query: string): Term | undefined {
  const wanted = normalizeTerm(query);
  if (wanted === "") return undefined;
  return (
    terms.find((term) => normalizeTerm(term.id) === wanted) ??
    terms.find((term) => normalizeTerm(term.term) === wanted) ??
    terms.find((term) => term.aliases.some((alias) => normalizeTerm(alias) === wanted))
  );
}
