import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { languages, stringsOf, type Language } from "../i18n/index.ts";

type Schema = {
  type?: string;
  minProperties?: number;
  propertyNames?: { pattern?: string };
  additionalProperties?: { type?: string; minLength?: number; pattern?: string };
};

const schema = JSON.parse(readFileSync(new URL("../schema/i18n.schema.json", import.meta.url), "utf8")) as Schema;

const english = stringsOf("en");

/** The message file as text, so duplicate keys (which `JSON.parse` hides) are still visible. */
function readText(lang: Language): string {
  return readFileSync(new URL(`../i18n/${lang}.json`, import.meta.url), "utf8");
}

/** The `{name}` placeholders in a message, each once, sorted. */
function placeholders(text: string): string[] {
  return [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
}

/** Checks one catalog against `schema/i18n.schema.json` and returns what is wrong with it. */
function schemaErrors(catalog: Readonly<Record<string, string>>): string[] {
  const errors: string[] = [];
  if (schema.type === "object" && (typeof catalog !== "object" || catalog === null)) errors.push("is not an object");
  const keys = Object.keys(catalog);
  if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
    errors.push(`has ${keys.length} keys, wants at least ${schema.minProperties}`);
  }
  const keyPattern = schema.propertyNames?.pattern === undefined ? undefined : new RegExp(schema.propertyNames.pattern);
  const valueType = schema.additionalProperties?.type;
  const valueLength = schema.additionalProperties?.minLength ?? 0;
  const valuePattern =
    schema.additionalProperties?.pattern === undefined ? undefined : new RegExp(schema.additionalProperties.pattern);
  for (const key of keys) {
    if (keyPattern !== undefined && !keyPattern.test(key)) errors.push(`${key}: key does not match the contract`);
    const text = catalog[key] ?? "";
    if (valueType === "string" && typeof text !== "string") errors.push(`${key}: value is not a string`);
    if (text.length < valueLength) errors.push(`${key}: value is empty`);
    if (valuePattern !== undefined && !valuePattern.test(text)) errors.push(`${key}: value has no text`);
  }
  return errors;
}

test("every catalog satisfies schema/i18n.schema.json", () => {
  for (const lang of languages) assert.deepEqual(schemaErrors(stringsOf(lang)), [], `${lang}.json`);
});

test("every language has every key that English has, and no others", () => {
  for (const lang of languages) {
    const table = stringsOf(lang);
    assert.deepEqual(Object.keys(english).filter((key) => !(key in table)), [], `${lang} is missing keys`);
    assert.deepEqual(Object.keys(table).filter((key) => !(key in english)), [], `${lang} has keys English lacks`);
  }
});

test("every message is non-empty and keeps the placeholders English uses", () => {
  for (const lang of languages) {
    const table = stringsOf(lang);
    for (const [key, text] of Object.entries(table)) {
      assert.notEqual(text.trim(), "", `${lang}.${key} is empty`);
      assert.deepEqual(placeholders(text), placeholders(english[key] ?? ""), `${lang}.${key} placeholders`);
      assert.equal(text.replace(/\{\w+\}/g, "").match(/[{}]/), null, `${lang}.${key} has a stray brace`);
    }
  }
});

test("keys are in alphabetical order in every language file", () => {
  for (const lang of languages) {
    const keys = Object.keys(stringsOf(lang));
    assert.deepEqual(keys, [...keys].sort(), `${lang} keys`);
  }
});

test("no language file repeats a key", () => {
  for (const lang of languages) {
    const written = [...readText(lang).matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g)].map((match) => match[1]);
    assert.deepEqual(written, Object.keys(stringsOf(lang)), `${lang} has a duplicate or unparsed key`);
  }
});

test("the 404 recovery group is complete in every language", () => {
  const recoveryKeys = [
    "not_found_title",
    "not_found_text",
    "search_placeholder",
    "search",
    "home",
  ] as const;  for (const lang of languages) {
    const table = stringsOf(lang);
    for (const key of recoveryKeys) {
      const text = table[key];
      assert.ok(typeof text === "string" && text.trim() !== "", `${lang}.${key} must carry the 404 recovery message`);
      assert.equal(text.replace(/\{\w+\}/g, "").match(/[<>]/), null, `${lang}.${key} must stay plain text`);
    }
  }
});

test("the endpoint parameter metadata group is complete in every language", () => {
  const keys = ["description", "endpoint_in", "no", "required", "type", "yes"] as const;
  for (const lang of languages) {
    const table = stringsOf(lang);
    for (const key of keys) {
      const text = table[key];
      assert.ok(typeof text === "string" && text.trim() !== "", `${lang}.${key} must carry the endpoint label`);
      assert.equal(text.replace(/\{\w+\}/g, "").match(/[<>{}]/), null, `${lang}.${key} must stay plain text`);
      if (lang !== "en") assert.notEqual(text, english[key], `${lang}.${key} must be translated`);
    }
  }
});

/** The text of every theme unit, so a catalog key is live only when a unit reads it. */
function units(): string {
  const text: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) text.push(readFileSync(path, "utf8"));
    }
  };
  for (const dir of ["src", "components", "chrome", "layouts"]) walk(dir);
  return text.join("\n");
}

/** Strings that are the same in every language because they are technical names, not prose. */
const TECHNICAL = new Set([
  "ask_agent_prompt_json",
  "ask_agent_prompt_markdown",
  "budget_report_css",
  "budget_report_gzip",
  "embed_code_html",
  "embed_code_markdown",
]);

test("every message is read by a unit", () => {
  const text = units();
  const unread: string[] = [];
  for (const key of Object.keys(english)) {
    if (text.includes(key)) continue;
    // A key a unit builds at runtime: a family prefix followed by `${`, or a prefix constant.
    const parts = key.split("_");
    let live = false;
    for (let index = parts.length - 1; index > 0 && !live; index -= 1) {
      const prefix = parts.slice(0, index).join("_");
      live = text.includes(`${prefix}_\${`) || text.includes(`"${prefix}_"`) || text.includes(`"${prefix}"`);
    }
    if (!live) unread.push(key);
  }
  assert.deepEqual(unread, []);
});

test("no catalog leaves a message in English", () => {
  const untranslated: string[] = [];
  for (const lang of languages) {
    if (lang === "en") continue;
    for (const [key, text] of Object.entries(stringsOf(lang))) {
      if (text === english[key] && !TECHNICAL.has(key)) untranslated.push(`${lang}.${key}`);
    }
  }
  assert.deepEqual(untranslated, []);
});
