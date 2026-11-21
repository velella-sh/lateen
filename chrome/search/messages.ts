/*
 * The search dialog's localization: every message it shows in the page language, the CLDR plural
 * category a count takes, and the reading of both from the dialog's `data-search-*` attributes.
 *
 * The module is pure: `chrome/search/index.ts` writes the translated strings into the dialog,
 * `client.ts` reads them back with `messagesFrom`/`langFrom` and announces counts and empty states
 * with `countMessage`/`emptyMessage`, so tests need no browser and no dialog.
 */

/** The CLDR plural categories a count message can have, matching `i18n/*.json`. */
export const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

/**
 * Every message the dialog shows, in the page language. `chrome/search/index.ts` writes them into
 * `data-search-*` attributes; these English values are the fallback when a page carries none. The
 * empty message takes `{query}` and each count takes `{n}`.
 */
export interface SearchMessages {
  readonly loading: string;
  readonly searching: string;
  readonly failed: string;
  readonly copied: string;
  readonly copyFailed: string;
  readonly empty: string;
  /** Announced when a reader's retry succeeds. */
  readonly ready: string;
  /** Announced when a reader's retry fails; it differs from `failed` so it is heard again. */
  readonly retryFailed: string;
  readonly counts: Readonly<Record<PluralCategory, string>>;
  readonly otherSection: string;
  readonly actions: string;
  readonly askHeading: string;
  readonly askLabel: string;
  readonly askHint: string;
}

export const MESSAGES: SearchMessages = {
  loading: "Loading search…",
  searching: "Searching…",
  failed: "Search is unavailable right now.",
  copied: "Copied",
  copyFailed: "Copy failed.",
  empty: "No results for “{query}”.",
  ready: "Search is available again.",
  retryFailed: "Search is still unavailable.",
  counts: {
    zero: "{n} results.",
    one: "{n} result.",
    two: "{n} results.",
    few: "{n} results.",
    many: "{n} results.",
    other: "{n} results.",
  },
  otherSection: "Other",
  actions: "Actions",
  askHeading: "Ask your agent",
  askLabel: "Ask your agent about “{query}”",
  askHint: "Copy a prompt for your own agent",
};

/** The dialog as the island reads its translated messages from. */
export interface MessageSource {
  getAttribute(name: string): string | null;
}

/** One data attribute's non-empty value, or undefined when the page does not carry it. */
function attributeOf(element: MessageSource, name: string): string | undefined {
  const value = element.getAttribute(name);
  return value === null || value === "" ? undefined : value;
}

/** The dialog's messages in the page language, with the English defaults for anything missing. */
export function messagesFrom(element: MessageSource): SearchMessages {
  return {
    loading: attributeOf(element, "data-search-loading") ?? MESSAGES.loading,
    searching: attributeOf(element, "data-search-searching") ?? MESSAGES.searching,
    failed: attributeOf(element, "data-search-failed") ?? MESSAGES.failed,
    copied: attributeOf(element, "data-search-copied") ?? MESSAGES.copied,
    copyFailed: attributeOf(element, "data-search-copy-failed") ?? MESSAGES.copyFailed,
    empty: attributeOf(element, "data-search-empty") ?? MESSAGES.empty,
    ready: attributeOf(element, "data-search-ready") ?? MESSAGES.ready,
    retryFailed: attributeOf(element, "data-search-retry-failed") ?? MESSAGES.retryFailed,
    otherSection: attributeOf(element, "data-search-other-section") ?? MESSAGES.otherSection,
    actions: attributeOf(element, "data-search-actions") ?? MESSAGES.actions,
    askHeading: attributeOf(element, "data-search-ask-heading") ?? MESSAGES.askHeading,
    askLabel: attributeOf(element, "data-search-ask-label") ?? MESSAGES.askLabel,
    askHint: attributeOf(element, "data-search-ask-hint") ?? MESSAGES.askHint,
    counts: {
      zero: attributeOf(element, "data-search-count-zero") ?? MESSAGES.counts.zero,
      one: attributeOf(element, "data-search-count-one") ?? MESSAGES.counts.one,
      two: attributeOf(element, "data-search-count-two") ?? MESSAGES.counts.two,
      few: attributeOf(element, "data-search-count-few") ?? MESSAGES.counts.few,
      many: attributeOf(element, "data-search-count-many") ?? MESSAGES.counts.many,
      other: attributeOf(element, "data-search-count-other") ?? MESSAGES.counts.other,
    },
  };
}

/** The page language the dialog carries, which picks the plural rules. */
export function langFrom(element: MessageSource): string {
  return attributeOf(element, "data-search-lang") ?? "en";
}

/** Fills one message's placeholders from already-escaped text values. */
export function fillMessage(pattern: string, values: Readonly<Record<string, string | number>>): string {
  return pattern.replace(/\{(\w+)\}/g, (_placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : "",
  );
}

/**
 * The plural category of `count` in `lang`, chosen by the browser's CLDR rules. A language tag the
 * runtime does not know reads as `other`, and an unknown category falls back to `other`.
 * Reading time keeps its own helper: an invalid tag there falls back to English, not `other`.
 */
/** One `Intl.PluralRules` per language. Building it on every keystroke was the expensive part. */
const pluralRules = new Map<string, Intl.PluralRules | null>();

function rulesFor(lang: string): Intl.PluralRules | undefined {
  if (pluralRules.has(lang)) return pluralRules.get(lang) ?? undefined;
  try {
    const created = new Intl.PluralRules(lang);
    pluralRules.set(lang, created);
    return created;
  } catch {
    pluralRules.set(lang, null);
    return undefined;
  }
}

export function pluralCategory(lang: string, count: number): PluralCategory {
  const set = rulesFor(lang);
  if (set === undefined) return "other";
  const category = set.select(Math.abs(Math.trunc(count)));
  return (PLURAL_CATEGORIES as readonly string[]).includes(category) ? (category as PluralCategory) : "other";
}

/** The text announced when a query finds nothing. */
export function emptyMessage(query: string, messages: SearchMessages = MESSAGES): string {
  return fillMessage(messages.empty, { query });
}

/** The text announced for a result count, in the page language's plural form. */
export function countMessage(count: number, lang = "en", messages: SearchMessages = MESSAGES): string {
  const pattern = messages.counts[pluralCategory(lang, count)] ?? messages.counts.other;
  return fillMessage(pattern, { n: count });
}