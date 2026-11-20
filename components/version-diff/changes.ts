/**
 * Version diff changes: the pure part of the `version-diff` component. JSON parsing, change-kind
 * guards, evidence selection, and version pairing happen here, at build time, with no markup
 * dependencies; `index.ts` only renders what this module normalizes. Empty, malformed, partial, and
 * repeated evidence keeps its written order and produces the same states, counts, and ids.
 */

/** The four kinds of section difference, in the order the viewer lists them in data. */
export const KINDS = ["added", "removed", "changed", "moved"] as const;

export type ChangeKind = (typeof KINDS)[number];

/**
 * The states an explicit comparison can be in; absent input renders nothing instead. `incomplete`
 * sits between `changes` and `unchanged`: usable evidence was read, but some of it was dropped, so
 * the comparison is never presented as complete.
 */
export const STATES = ["changes", "incomplete", "unchanged", "unavailable"] as const;

export type DiffState = (typeof STATES)[number];

/** The id prefix used when the directive gives none. */
export const DEFAULT_ID = "version-diff";

/** One section difference, as the data records it. */
export interface VersionChange {
  /** `added`, `removed`, `changed`, or `moved`; any other value is dropped. */
  readonly kind: ChangeKind;
  /** The section's heading; a blank one drops the entry. */
  readonly title: string;
  /** For `moved`, the section's old position, as the data wrote it. */
  readonly from?: string;
  /** For `moved`, the section's new position, as the data wrote it. */
  readonly to?: string;
  /** The section's text in the older version, when the data has it. */
  readonly before?: string;
  /** The section's text in the newer version, when the data has it. */
  readonly after?: string;
}

/** One page's diff between two versions, and whether the evidence could be read. */
export interface VersionDiff {
  /**
   * `changes` when every change entry was readable, `incomplete` when usable entries were read but
   * others were dropped, `unchanged` for a verified empty one, `unavailable` when nothing readable
   * was left.
   */
  readonly state: DiffState;
  /** The older version folder, such as `v1`, when the data named a usable one. */
  readonly from?: string;
  /** The newer version folder, such as `v2`, when the data named a usable one. */
  readonly to?: string;
  /** The section differences, in the order the data lists them. */
  readonly changes: readonly VersionChange[];
  /** Change entries written in the evidence that were dropped as unusable; zero when all were read. */
  readonly dropped: number;
}

/**
 * Props from the directive:
 * `::version-diff{from=v1 to=v2 changes='[{"kind":"added","title":"Install"}]'}`.
 *
 * The `data` attribute takes the whole object instead:
 * `::version-diff{data='{"from":"v1","to":"v2","changes":[...]}'}`.
 */
export type VersionDiffProps = {
  /** The older version; ignored when `data` gives one. */
  from?: string;
  /** The newer version; ignored when `data` gives one. */
  to?: string;
  /** JSON array of changes, each `{ kind, title, from?, to?, before?, after? }`. */
  changes?: string;
  /** JSON object `{ from, to, changes }`; it wins over the separate attributes. */
  data?: string;
  /** Prefix for this viewer's element ids; give each viewer on a page its own id. */
  id?: string;
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-empty trimmed string, or a finite number as text; everything else is undefined. */
function textOf(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** The kind of a change, without case or surrounding spaces; anything else is undefined. */
export function kindOf(value: unknown): ChangeKind | undefined {
  if (typeof value !== "string") return undefined;
  const kind = value.trim().toLowerCase();
  return (KINDS as readonly string[]).includes(kind) ? (kind as ChangeKind) : undefined;
}

/** The JSON value in a directive attribute, or undefined when it is missing, blank, or not JSON. */
export function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** One change from a record, or undefined when it has no known kind or no section title. */
export function changeOf(value: unknown): VersionChange | undefined {
  if (!isRecord(value)) return undefined;
  const kind = kindOf(value.kind);
  if (kind === undefined) return undefined;
  const title = textOf(value.title) ?? textOf(value.heading);
  if (title === undefined) return undefined;

  const from = textOf(value.from);
  const to = textOf(value.to);
  const before = textOf(value.before) ?? textOf(value.oldText);
  const after = textOf(value.after) ?? textOf(value.newText);
  return {
    kind,
    title,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  };
}

/** Every usable change in a JSON array, in the order written; anything else gives none. */
export function changesOf(value: unknown): readonly VersionChange[] {
  if (!Array.isArray(value)) return [];
  return value.map(changeOf).filter((change): change is VersionChange => change !== undefined);
}

/** The usable changes in a record, whether it carried change evidence at all, and how much was unusable. */
interface Evidence {
  readonly changes: readonly VersionChange[];
  /** True when the record names any change list, even an empty one. */
  readonly present: boolean;
  /** Entries written in a change list that were dropped as unusable. */
  readonly dropped: number;
}

/**
 * The changes in a record, from either the listed `changes` shape or the engine's grouped
 * `diff/<version>/<page>.json` shape, where added and removed sections carry `text` and changed and
 * moved ones `oldText` and `newText`. The grouped lists are read in {@link KINDS} order, which is the
 * only order that shape keeps. A listed change wins over grouped lists, as before.
 */
function evidenceOf(value: Readonly<Record<string, unknown>>): Evidence {
  const changes: VersionChange[] = [];
  let present = false;
  let dropped = 0;

  if (value.changes !== undefined) {
    present = true;
    if (Array.isArray(value.changes)) {
      const usable = changesOf(value.changes);
      changes.push(...usable);
      dropped += value.changes.length - usable.length;
    } else {
      dropped += 1;
    }
  }

  // The grouped shape is read only when the listed one yields nothing, so the listed form wins.
  if (changes.length === 0) {
    for (const kind of KINDS) {
      if (!Object.hasOwn(value, kind)) continue;
      present = true;
      const list = value[kind];
      if (!Array.isArray(list)) {
        dropped += 1;
        continue;
      }
      for (const raw of list) {
        if (!isRecord(raw)) {
          dropped += 1;
          continue;
        }
        const change = changeOf({
          ...raw,
          kind,
          before: raw.before ?? raw.oldText ?? (kind === "removed" ? raw.text : undefined),
          after: raw.after ?? raw.newText ?? (kind === "added" ? raw.text : undefined),
        });
        if (change === undefined) dropped += 1;
        else changes.push(change);
      }
    }
  }

  return { changes, present, dropped };
}

/**
 * A diff from a record: `{ from, to, changes }`, or the engine's grouped `{ from, to, added, removed,
 * changed, moved }`. Two usable versions with an explicit empty change list are `unchanged`; missing
 * or equal versions, absent change evidence, or change lists with no usable entry are `unavailable`.
 * Usable entries beside dropped ones are `incomplete`, never `changes`: a partially unreadable
 * comparison stays usable without being presented as complete.
 */
export function diffOf(value: unknown): VersionDiff {
  if (!isRecord(value)) return { state: "unavailable", changes: [], dropped: 0 };

  const from = textOf(value.from);
  const to = textOf(value.to);
  if (from === undefined || to === undefined || from === to) {
    return {
      state: "unavailable",
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      changes: [],
      dropped: 0,
    };
  }

  const evidence = evidenceOf(value);
  const state: DiffState =
    evidence.changes.length > 0
      ? evidence.dropped > 0
        ? "incomplete"
        : "changes"
      : evidence.present && evidence.dropped === 0
        ? "unchanged"
        : "unavailable";
  return { state, from, to, changes: evidence.changes, dropped: evidence.dropped };
}

/**
 * The diff to show: the `data` attribute first, then `from`/`to` with the `changes` attribute, then
 * the page's `versionDiff` front matter. Any of those that was written is an explicit comparison, so
 * malformed data renders `unavailable` rather than falling through. With none of them written the
 * viewer renders nothing.
 */
export function versionDiffFor(
  props: VersionDiffProps,
  frontMatter: Readonly<Record<string, unknown>>,
): VersionDiff | undefined {
  if (textOf(props.data) !== undefined) return diffOf(parseJson(props.data));

  const from = textOf(props.from);
  const to = textOf(props.to);
  const changes = textOf(props.changes);
  if (from !== undefined || to !== undefined || changes !== undefined) {
    return diffOf({ from, to, changes: parseJson(changes) });
  }

  if (frontMatter.versionDiff === undefined) return undefined;
  return diffOf(frontMatter.versionDiff);
}

/** The id prefix, reduced to letters, digits, `-` and `_` so a prop cannot break the markup. */
export function idBase(raw: unknown): string {
  const clean = textOf(raw)?.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") ?? "";
  return clean === "" ? DEFAULT_ID : clean;
}