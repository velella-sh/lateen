import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  CalendarLink,
  ChangeEvent,
  ChangelogEventType,
  Collection,
  DataRecord,
  LayoutProps,
  ListProps,
  Page,
  PageRecord,
  PageStale,
  PageStaleFile,
  RecordProps,
  Site,
} from "@velella/mizzen/contracts";

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/** A key a type may omit: `true` when `{}` is assignable to the type with only that key. */
type Optional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;

// Compile-time only: `npm run typecheck` fails if the engine drops one of these members or changes
// its type, which is the point at which the theme's record layouts must be revisited.
type DataContract = [
  Assert<Same<Site["collections"], Readonly<Record<string, Collection>>>>,
  Assert<Same<Page["record"], PageRecord | undefined>>,
  Assert<Same<LayoutProps["record"], RecordProps | undefined>>,
  Assert<Same<LayoutProps["list"], ListProps | undefined>>,
];

// Derived date values (#530): a record carries the engine's values beside its fields.
type DerivedContract = [
  Assert<Same<DataRecord["derived"], Readonly<Record<string, unknown>> | undefined>>,
  Assert<Same<RecordProps["derived"], Readonly<Record<string, unknown>> | undefined>>,
  Assert<Optional<DataRecord, "derived">>,
  Assert<Optional<RecordProps, "derived">>,
];

// Calendar addresses (#533): a record page links the `.ics` file and the calendars it belongs to.
type CalendarContract = [
  Assert<Same<RecordProps["calendar"], string | undefined>>,
  Assert<Same<RecordProps["calendars"], readonly CalendarLink[] | undefined>>,
  Assert<Same<CalendarLink, {
    readonly name: string;
    readonly title: string;
    readonly url: string;
    readonly webcal: string;
  }>>,
  Assert<Optional<RecordProps, "calendar">>,
  Assert<Optional<RecordProps, "calendars">>,
];

// Record history (#536): one record's events, and the read-only `<name>.changes` collection.
type HistoryContract = [
  Assert<Same<RecordProps["changes"], readonly ChangeEvent[] | undefined>>,
  Assert<Same<PageRecord["changes"], readonly ChangeEvent[] | undefined>>,
  Assert<Same<ChangeEvent["type"], ChangelogEventType>>,
  Assert<Same<ChangeEvent["record"], string>>,
  Assert<Same<ChangeEvent["date"], string>>,
  Assert<Same<ChangeEvent["field"], string | undefined>>,
  Assert<Same<ChangeEvent["from"], string | undefined>>,
  Assert<Same<ChangeEvent["count"], number | undefined>>,
  Assert<Same<ChangeEvent["ref"], string | undefined>>,
  Assert<Same<ChangeEvent["fields"], Readonly<Record<string, unknown>> | undefined>>,
  Assert<Optional<RecordProps, "changes">>,
  Assert<Optional<PageRecord, "changes">>,
  Assert<Same<Collection["readonly"], boolean | undefined>>,
];

// Stale pages (#540): the review date and the covered files that changed since it.
type StaleContract = [
  Assert<Same<Page["stale"], PageStale | undefined>>,
  Assert<Same<PageStale["reviewed"], string | undefined>>,
  Assert<Same<PageStale["files"], readonly PageStaleFile[]>>,
  Assert<Same<PageStaleFile["path"], string>>,
  Assert<Same<PageStaleFile["change"], "changed" | "removed" | "added">>,
  Assert<Optional<Page, "stale">>,
  Assert<Optional<PageStale, "reviewed">>,
];

const root = fileURLToPath(new URL("../", import.meta.url));
const SOURCE = new Set([".ts", ".tsx", ".mts", ".js", ".mjs"]);
const SPECIFIER = /\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name !== "node_modules") walk(join(dir, e.name), out);
    } else if (SOURCE.has(extname(e.name))) out.push(join(dir, e.name));
  }
  return out;
}

// The theme reaches the engine only through `@velella/mizzen/contracts`, by package name,
// so it keeps working when the two packages live in separate repositories.
test("the theme imports the engine only as @velella/mizzen/contracts, never by relative path", () => {
  const bad: string[] = [];
  for (const file of walk(root)) {
    // This fixture is copied to a standalone consumer project and exercises the installed producer.
    if (file === join(root, "test/acceptance/collect-report.mjs")) continue;
    for (const m of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
      const spec = m[1] ?? "";
      const relativeEngine = spec.startsWith(".") && /(?:^|\/)engine(?:\/|$)/.test(spec);
      const otherEngineEntry = spec.startsWith("@velella/mizzen") && spec !== "@velella/mizzen/contracts";
      if (relativeEngine || otherEngineEntry) bad.push(`${file.slice(root.length)}: ${spec}`);
    }
  }
  assert.deepEqual(bad, []);
});
