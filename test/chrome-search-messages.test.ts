import assert from "node:assert/strict";
import { test } from "node:test";
import { stringsOf } from "../i18n/index.ts";
import {
  countMessage,
  emptyMessage,
  fillMessage,
  langFrom,
  MESSAGES,
  messagesFrom,
  PLURAL_CATEGORIES,
  pluralCategory,
  type MessageSource,
  type SearchMessages,
} from "../chrome/search/messages.ts";

test("English counts take the singular for one and the plural for zero and many", () => {
  assert.equal(countMessage(0), "0 results.");
  assert.equal(countMessage(1), "1 result.");
  assert.equal(countMessage(2), "2 results.");
  assert.equal(countMessage(21), "21 results.");
  assert.equal(emptyMessage("cache"), "No results for “cache”.");
});

test("the plural category follows the page language's CLDR rules", () => {
  assert.deepEqual([...PLURAL_CATEGORIES], ["zero", "one", "two", "few", "many", "other"]);
  assert.equal(pluralCategory("en", 1), "one");
  assert.equal(pluralCategory("en", 0), "other");
  assert.equal(pluralCategory("fa", 0), "one", "Persian counts zero with one: i = 0..1");
  assert.equal(pluralCategory("fa", 1), "one");
  assert.equal(pluralCategory("fa", 7), "other");
  assert.equal(pluralCategory("ar", 0), "zero");
  assert.equal(pluralCategory("ar", 1), "one");
  assert.equal(pluralCategory("ar", 2), "two");
  assert.equal(pluralCategory("ar", 3), "few");
  assert.equal(pluralCategory("ar", 11), "many");
  assert.equal(pluralCategory("ar", 100), "other");
});

/** The dialog's messages for a shipped language, built from the real catalog. */
function messagesFor(lang: "fa" | "ar"): SearchMessages {
  const text = stringsOf(lang);
  return {
    ...MESSAGES,
    empty: text.search_results_empty ?? "",
    counts: {
      zero: text.search_count_zero ?? "",
      one: text.search_count_one ?? "",
      two: text.search_count_two ?? "",
      few: text.search_count_few ?? "",
      many: text.search_count_many ?? "",
      other: text.search_count_other ?? "",
    },
  };
}

test("Persian counts every number the same way, in the catalog's own words", () => {
  const persian = messagesFor("fa");
  for (const count of [0, 1, 2, 5, 11, 100]) {
    const pattern = persian.counts[pluralCategory("fa", count)];
    assert.equal(countMessage(count, "fa", persian), pattern.replace("{n}", String(count)));
  }
  assert.equal(emptyMessage("کش", persian), persian.empty.replace("{query}", "کش"));
});

test("Arabic counts pick zero, one, two, few, many, and other from the catalog", () => {
  const arabic = messagesFor("ar");
  const expected: ReadonlyArray<readonly [number, string]> = [
    [0, arabic.counts.zero],
    [1, arabic.counts.one],
    [2, arabic.counts.two],
    [3, arabic.counts.few],
    [11, arabic.counts.many],
    [100, arabic.counts.other],
  ];
  for (const [count, pattern] of expected) {
    assert.equal(countMessage(count, "ar", arabic), pattern.replace("{n}", String(count)));
  }
});

test("a language tag the runtime cannot parse falls back to other, never throws", () => {
  assert.equal(pluralCategory("!!not-a-tag!!", 3), "other");
  assert.equal(countMessage(3, "!!not-a-tag!!"), "3 results.");
});

test("fillMessage fills named placeholders and empties the ones it has no value for", () => {
  assert.equal(fillMessage("{n} of {total}", { n: 2, total: 5 }), "2 of 5");
  assert.equal(fillMessage("{query}!", {}), "!");
  assert.equal(fillMessage("{n} {n}", { n: 1 }), "1 1");
});

test("messagesFrom reads the dialog's attributes and keeps the English fallback for missing ones", () => {
  const source: MessageSource = {
    getAttribute(name: string) {
      const attributes: Record<string, string> = {
        "data-search-lang": "ar",
        "data-search-failed": "البحث غير متاح الآن.",
        "data-search-count-zero": "{n} نتيجة",
        "data-search-count-two": "{n} نتيجتان",
      };
      return attributes[name] ?? null;
    },
  };
  const messages = messagesFrom(source);

  assert.equal(langFrom(source), "ar");
  assert.equal(messages.failed, "البحث غير متاح الآن.");
  assert.equal(messages.counts.zero, "{n} نتيجة");
  assert.equal(messages.counts.two, "{n} نتيجتان");
  assert.equal(messages.loading, MESSAGES.loading, "a missing attribute falls back to English");
  assert.equal(messages.counts.other, MESSAGES.counts.other);
});

test("an empty or absent attribute is a missing one, and a bare dialog speaks English", () => {
  assert.equal(langFrom({ getAttribute: () => "" }), "en");
  assert.equal(langFrom({ getAttribute: () => null }), "en");
  assert.deepEqual(messagesFrom({ getAttribute: () => null }), MESSAGES);
  assert.deepEqual(messagesFrom({ getAttribute: () => "" }), MESSAGES);
});