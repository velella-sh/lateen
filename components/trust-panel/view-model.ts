import type { Page, Site, SiteConfig } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { calendarDate } from "../../src/dates.ts";
import { optionOf } from "../../src/options.ts";
import { commitUrlOf } from "../../src/repository.ts";
import { isRecord, textOf } from "../../src/guards.ts";
import { examplesAttrs, examplesClassName, examplesFor, examplesText } from "./examples.ts";

/**
 * The trust panel's pure view model: every selection the panel makes from the site contracts —
 * evidence, provenance dates, drift, reviewer, and actions — resolved to localised, render-ready
 * values. It imports no Preact and reads no clock, so the markup only draws what this module names.
 */

/**
 * The trust states the panel understands, strongest first. `verified` means all evidence is recorded
 * and clean; `partial`, `unreviewed`, and `unknown` name what is missing instead of rounding it up.
 */
export const LEVELS = ["verified", "partial", "unreviewed", "unknown"] as const;

export type TrustLevel = (typeof LEVELS)[number];

/** Props from the directive, for a manual panel: `::trust-panel{level=verified reasons="…" lastReviewer="…"}`. */
export type TrustPanelProps = {
  /** `verified`, `partial`, `unreviewed`, or `unknown`; a present level this does not know renders unknown invalid evidence. */
  level?: string;
  /** Why the page has this state. A string is split on line breaks or `|`. */
  reasons?: string;
  /** Who reviewed the page last. */
  lastReviewer?: string;
  /** The build that produced the evidence, for a manual panel that carries one. */
  buildId?: string;
  /** The build's generation date, for a manual panel that carries one. */
  generatedAt?: string;
  /** The page's last review date, for a manual panel that carries one. */
  reviewedAt?: string;
  /** The reviewed commit, for a manual panel that carries one. */
  reviewedCommit?: string;
};

/** One page's trust entry, as `site.data.trust` or the directive writes it. */
export interface TrustEntry {
  /** The page's trust state. */
  readonly level: TrustLevel;
  /** Why the page has this state, in display order. */
  readonly reasons: readonly string[];
  /** Who reviewed the page last, when the site records one. */
  readonly lastReviewer?: string;
  /** The build that produced this evidence, when the site records it. */
  readonly buildId?: string;
  /** When the build that produced this evidence ran. */
  readonly generatedAt?: string;
  /** When a person last reviewed the page. */
  readonly reviewedAt?: string;
  /** The commit the review covered, when the site records one. */
  readonly reviewedCommit?: string;
}

/**
 * What a page's trust data says: `absent` when no entry was written, `invalid` when one is present
 * but cannot be read (it is not a record, or it has no known level), and `valid` when it names one.
 * Invalid evidence carries no entry at all, so none of the written fields can arrive as a claim.
 */
export type TrustEvidence =
  | { readonly state: "absent" }
  | { readonly state: "invalid" }
  | { readonly state: "valid"; readonly entry: TrustEntry };

/**
 * Valid same-build provenance for one panel. Every member is optional: a site that records none gets no
 * attribute, no date row, and no filled action placeholder, so missing evidence stays unknown.
 */
export interface Provenance {
  /** The build the evidence came from. */
  readonly buildId?: string;
  /** The build's generation date, in ISO 8601 form. */
  readonly generatedAt?: string;
  /** The last human review date, in ISO 8601 form. */
  readonly reviewedAt?: string;
  /** The reviewed commit, when the entry or the reviewers data names one. */
  readonly reviewedCommit?: string;
}

/** The action links a site can configure under `theme.options.trust`. */
interface TrustOptions {
  /** A link that copies or opens the page's context pack. */
  readonly contextPackUrl?: unknown;
  /** A link that opens the host's edit or new-issue form for the page. */
  readonly suggestEditUrl?: unknown;
}

/** The i18n key of each state's label. */
const LEVEL_KEYS: Readonly<Record<TrustLevel, string>> = {
  verified: "trust_level_verified",
  partial: "trust_level_partial",
  unreviewed: "trust_level_unreviewed",
  unknown: "trust_level_unknown",
};

/** The i18n key of the explanation a state shows when the entry records no reasons of its own. */
const WHY_KEYS: Readonly<Record<TrustLevel, string>> = {
  verified: "trust_why_verified",
  partial: "trust_why_partial",
  unreviewed: "trust_why_unreviewed",
  unknown: "trust_why_unknown",
};

/**
 * The names the first trust score wrote for the states it had. They read as the nearest state in
 * this vocabulary, so existing `_data/trust.yml` files keep their meaning.
 */
const ALIASES: Readonly<Record<string, TrustLevel>> = {
  "review-due": "unreviewed",
  "at-risk": "partial",
};

/** A path on this site (not protocol-relative `//host`) or an https link. Anything else is not a link. */
const SAFE_URL = /^(?:\/(?![/\\])|https:\/\/)[^\s"<>]*$/;

/** The level a value names, matched without case or surrounding spaces and with spaces or `_` as `-`. */
export function levelOf(value: unknown): TrustLevel | undefined {
  const text = textOf(value);
  if (text === undefined) return undefined;
  const level = text.toLowerCase().replace(/[\s_]+/g, "-");
  return (LEVELS as readonly string[]).includes(level) ? (level as TrustLevel) : ALIASES[level];
}

/** A list of reasons from an array or a string split on line breaks or `|`. Blank entries are dropped. */
export function reasonsOf(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\r?\n|\s*\|\s*/)
      .map((reason) => reason.trim())
      .filter((reason) => reason !== "");
  }
  if (!Array.isArray(value)) return [];
  return value.map(textOf).filter((reason): reason is string => reason !== undefined);
}

/** The readable entry in a record whose level is already known. */
function entryFrom(value: Record<string, unknown>, level: TrustLevel): TrustEntry {
  const lastReviewer = textOf(value.lastReviewer);
  const buildId = textOf(value.buildId);
  const generatedAt = textOf(value.generatedAt);
  const reviewedAt = textOf(value.reviewedAt);
  const reviewedCommit = textOf(value.reviewedCommit);
  return {
    level,
    reasons: reasonsOf(value.reasons),
    ...(lastReviewer === undefined ? {} : { lastReviewer }),
    ...(buildId === undefined ? {} : { buildId }),
    ...(generatedAt === undefined ? {} : { generatedAt }),
    ...(reviewedAt === undefined ? {} : { reviewedAt }),
    ...(reviewedCommit === undefined ? {} : { reviewedCommit }),
  };
}

/** The evidence one value carries. Only `undefined` is absent; anything written but unreadable is invalid. */
export function trustEvidenceOf(value: unknown): TrustEvidence {
  if (value === undefined) return { state: "absent" };
  if (!isRecord(value)) return { state: "invalid" };
  const level = levelOf(value.level);
  if (level === undefined) return { state: "invalid" };
  return { state: "valid", entry: entryFrom(value, level) };
}

/** The entry on one value, or undefined when it is absent or unreadable. */
export function entryOf(value: unknown): TrustEntry | undefined {
  const evidence = trustEvidenceOf(value);
  return evidence.state === "valid" ? evidence.entry : undefined;
}

/**
 * The URL-to-entry map inside `site.data.trust`. The future `trust.json` output may write either
 * `{ "/page/": { … } }` or `{ pages: { "/page/": { … } } }`; both are accepted, and the nested form
 * wins when its `pages` member is an object.
 */
export function pagesOf(trust: unknown): Record<string, unknown> | undefined {
  if (!isRecord(trust)) return undefined;
  const nested = trust.pages;
  return isRecord(nested) ? nested : trust;
}

/** The page's trust evidence from `site.data.trust`, keyed by its exact URL including `base`. */
export function trustEvidenceFor(site: Site | undefined, url: string | undefined): TrustEvidence {
  if (url === undefined) return { state: "absent" };
  const pages = pagesOf(site?.data?.trust);
  if (pages === undefined || !Object.hasOwn(pages, url)) return { state: "absent" };
  return trustEvidenceOf(pages[url]);
}

/** The page's trust entry from `site.data.trust`, keyed by its exact URL including `base`. */
export function entryFor(site: Site | undefined, url: string | undefined): TrustEntry | undefined {
  const evidence = trustEvidenceFor(site, url);
  return evidence.state === "valid" ? evidence.entry : undefined;
}

/** The number of drift findings the page has in `site.data.drift`, or undefined when the site records none. */
export function driftFor(site: Site | undefined, url: string | undefined): number | undefined {
  if (url === undefined) return undefined;
  const pages = pagesOf(site?.data?.drift);
  if (pages === undefined || !Object.hasOwn(pages, url)) return undefined;
  const value = pages[url];
  return Array.isArray(value) ? value.length : undefined;
}

/** One valid ISO date: the written value for `<time datetime>` and its calendar day for comparisons. */
interface ProvenanceDate {
  readonly iso: string;
  readonly day: string;
}

/** A real ISO calendar date from a string or a `Date`, or undefined when it is impossible or malformed. */
function provenanceDate(value: unknown): ProvenanceDate | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const iso = value.toISOString();
    return { iso, day: iso.slice(0, 10) };
  }
  const text = textOf(value);
  if (text === undefined) return undefined;
  const calendar = calendarDate(text, "en");
  if (calendar === undefined) return undefined;
  // A written date-time must parse as ISO too, so a malformed clock or offset cannot reach `datetime`.
  if (text !== calendar.datetime && Number.isNaN(Date.parse(text))) return undefined;
  return { iso: text, day: calendar.datetime };
}

/** The `site.data.build` block, or undefined when the site writes none. */
function buildOf(site: Site | undefined): Record<string, unknown> | undefined {
  const build = site?.data?.build;
  return isRecord(build) ? build : undefined;
}

/** One page's review record from the documented reviewers shape, keyed by page URL. */
function reviewOf(site: Site | undefined, url: string | undefined): Record<string, unknown> | undefined {
  if (url === undefined) return undefined;
  const reviewers = site?.data?.reviewers;
  if (!isRecord(reviewers) || !Object.hasOwn(reviewers, url)) return undefined;
  const review = reviewers[url];
  return isRecord(review) ? review : undefined;
}

/** The page's review date from the documented reviewers shape, keyed by page URL. */
function reviewDateOf(site: Site | undefined, url: string | undefined): ProvenanceDate | undefined {
  return provenanceDate(reviewOf(site, url)?.date);
}

/** The reviewed commit from the documented reviewers shape, when it parses as a git object id. */
function reviewCommitOf(site: Site | undefined, url: string | undefined): string | undefined {
  const commit = textOf(reviewOf(site, url)?.commit);
  return commit !== undefined && /^[0-9a-f]{7,64}$/i.test(commit) ? commit.toLowerCase() : undefined;
}

/** The build's as-of date, which anchors what counts as future evidence. No clock is read. */
function buildAsOf(contents: Record<string, unknown> | undefined, site: Site | undefined): ProvenanceDate | undefined {
  const fromBuild = provenanceDate(contents?.asOf) ?? provenanceDate(contents?.date);
  if (fromBuild !== undefined) return fromBuild;
  const reviewers = site?.data?.reviewers;
  return isRecord(reviewers) ? provenanceDate(reviewers.asOf) : undefined;
}

/**
 * The panel's valid provenance, from the trust entry first, then the documented build and reviewer shapes.
 *
 * - `buildId` is the entry's `buildId`, else `site.data.build.id`.
 * - `generatedAt` is the entry's `generatedAt`, else `site.data.build.generatedAt`, `date`, or `asOf`.
 * - `reviewedAt` is the entry's `reviewedAt`, else the page's `site.data.reviewers[url].date`.
 *
 * A malformed date is omitted. A date after the build's as-of day is future evidence and is omitted too,
 * as is a review dated after the generation it claims to describe. When the entry names a build and the
 * current build names another, the entry's build provenance is stale and is left out entirely. Provenance
 * never changes the level: it only says which build and review the recorded evidence describes.
 */
export function provenanceOf(site: Site | undefined, url: string | undefined, entry?: TrustEntry): Provenance {
  const build = buildOf(site);
  const buildId = textOf(build?.id);
  const entryBuildId = entry?.buildId;
  const mismatch = entryBuildId !== undefined && buildId !== undefined && entryBuildId !== buildId;
  const asOf = buildAsOf(build, site);

  let generated = mismatch
    ? undefined
    : (provenanceDate(entry?.generatedAt) ??
      provenanceDate(build?.generatedAt) ??
      provenanceDate(build?.date) ??
      provenanceDate(build?.asOf));
  let reviewed = provenanceDate(entry?.reviewedAt) ?? reviewDateOf(site, url);
  const reviewedCommit = entry?.reviewedCommit ?? reviewCommitOf(site, url);

  if (asOf !== undefined) {
    if (generated !== undefined && generated.day > asOf.day) generated = undefined;
    if (reviewed !== undefined && reviewed.day > asOf.day) reviewed = undefined;
  }
  if (generated !== undefined && reviewed !== undefined && reviewed.day > generated.day) reviewed = undefined;

  const validBuildId = mismatch ? undefined : (entryBuildId ?? buildId);
  const validCommit =
    reviewedCommit !== undefined && /^[0-9a-f]{7,64}$/i.test(reviewedCommit) ? reviewedCommit.toLowerCase() : undefined;
  return {
    ...(validBuildId === undefined ? {} : { buildId: validBuildId }),
    ...(generated === undefined ? {} : { generatedAt: generated.iso }),
    ...(reviewed === undefined ? {} : { reviewedAt: reviewed.iso }),
    ...(validCommit === undefined ? {} : { reviewedCommit: validCommit }),
  };
}

/** The drift row's text in the page's language. */
export function driftText(lang: string, findings: number | undefined): string {
  if (findings === undefined) return t(lang, "trust_not_recorded");
  if (findings === 0) return t(lang, "trust_drift_none");
  return t(lang, findings === 1 ? "drift_finding" : "drift_findings", { n: findings });
}

/** The reviewer row's text in the page's language. */
export function reviewerText(lang: string, reviewer: string | undefined): string {
  return reviewer === undefined ? t(lang, "trust_reviewer_none") : t(lang, "trust_reviewed_by", { reviewer });
}

/**
 * Why the page has its state, in the page's language: the entry's own reasons, or what the state
 * means when the site recorded none. The panel always explains itself, so a state is never just a
 * badge.
 */
export function explanationOf(lang: string, state: TrustLevel, reasons: readonly string[]): readonly string[] {
  return reasons.length > 0 ? reasons : [t(lang, WHY_KEYS[state])];
}

/** The `theme.options.trust` block, or undefined when the site has none. */
function trustOptions(config: SiteConfig | undefined): TrustOptions | undefined {
  const options = optionOf(config?.theme?.options, "trust");
  return isRecord(options) ? (options as TrustOptions) : undefined;
}

/**
 * Fills `{url}`, `{title}`, `{source}`, `{build}`, `{generated}`, and `{reviewed}` in a configured action
 * URL for this page. Provenance placeholders with no valid evidence return undefined, so the link is left
 * out rather than losing the build context it promises.
 */
function fill(value: string, page: Page, provenance: Provenance): string | undefined {
  const source = page.source.file
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const values: Readonly<Record<string, string | undefined>> = {
    url: page.url,
    title: encodeURIComponent(page.title),
    source,
    build: provenance.buildId === undefined ? undefined : encodeURIComponent(provenance.buildId),
    generated: provenance.generatedAt === undefined ? undefined : encodeURIComponent(provenance.generatedAt),
    reviewed: provenance.reviewedAt === undefined ? undefined : encodeURIComponent(provenance.reviewedAt),
  };

  let filled = value;
  for (const [name, resolved] of Object.entries(values)) {
    if (resolved === undefined) {
      if (filled.includes(`{${name}}`)) return undefined;
      continue;
    }
    filled = filled.replaceAll(`{${name}}`, resolved);
  }
  return filled;
}

/**
 * An action link from `theme.options.trust`, with `base` in front of a site path. Returns undefined
 * when the value is missing, unsafe, not a string, or asks for provenance the page does not have.
 */
export function actionHrefOf(
  config: SiteConfig | undefined,
  page: Page,
  value: unknown,
  provenance: Provenance = {},
): string | undefined {
  const text = textOf(value);
  if (text === undefined) return undefined;
  const filled = fill(text, page, provenance);
  if (filled === undefined || !SAFE_URL.test(filled)) return undefined;
  return filled.startsWith("/") ? `${config?.base ?? ""}${filled}` : filled;
}

/** A labelled row whose value is plain text: the drift and reviewer rows. */
export interface TextRowView {
  /** The row's label, in the page's language. */
  readonly label: string;
  /** The row's value, in the page's language. */
  readonly text: string;
}

/** The examples row: its label and the evidence-derived text, class, and machine-readable attributes. */
export interface ExamplesRowView extends TextRowView {
  /** The value's class: the row class plus the evidence state class. */
  readonly className: string;
  /** The `data-trust-examples*` attributes; counts appear only for readable evidence. */
  readonly attrs: Record<string, string | number>;
}

/**
 * One provenance date row: the written ISO value for `<time datetime>`, the localised calendar text,
 * and the exact tooltip. A date-time keeps its clock, seconds, and offset in `datetime` and the
 * tooltip; only the visible text is localised.
 */
export interface DateRowView {
  /** The row's label, in the page's language. */
  readonly label: string;
  /** The written ISO value, kept whole for `datetime`. */
  readonly iso: string;
  /** The visible calendar text, in the page's language. */
  readonly text: string;
  /** The tooltip and accessible name: the calendar text for a plain day, else the written value. */
  readonly exact: string;
}

/** The reviewed-revision row: the commit's repository URL and the full object id. */
export interface RevisionRowView {
  /** The row's label, in the page's language. */
  readonly label: string;
  /** The repository browser's URL for the commit. */
  readonly href: string;
  /** The full reviewed commit; the row shows its first seven characters. */
  readonly commit: string;
}

/** One action link: its safe, filled href and its localised label. */
export interface ActionView {
  /** The link's href, with the site base in front of a site path. */
  readonly href: string;
  /** The link's text, in the page's language. */
  readonly label: string;
}

/**
 * Everything the panel draws, selected from the contracts and localised. `absent` renders nothing;
 * `invalid` reports an unreadable entry as unknown with no evidence rows, provenance, or actions;
 * `valid` names the level and every row, reason, and action the evidence supports. Missing members
 * are left out, never filled with a claim.
 */
export type TrustPanelView =
  | { readonly state: "absent" }
  | {
      readonly state: "invalid";
      /** The chip's localised level text. */
      readonly chip: string;
      /** The reasons heading, in the page's language. */
      readonly reasonsLabel: string;
      /** The non-claiming explanation, in display order. */
      readonly reasons: readonly string[];
    }
  | {
      readonly state: "valid";
      /** The declared level; provenance and examples never change it. */
      readonly level: TrustLevel;
      /** The chip's localised level text. */
      readonly chip: string;
      /** The valid same-build provenance, exposed on the panel root. */
      readonly provenance: Provenance;
      /** The examples row, from `site.data.examples`. */
      readonly examples: ExamplesRowView;
      /** The drift row, from `site.data.drift`. */
      readonly drift: TextRowView;
      /** The build generation date row, when valid provenance names one. */
      readonly generated?: DateRowView;
      /** The human review date row, when valid provenance names one. */
      readonly reviewed?: DateRowView;
      /** The reviewed revision row, when a commit and a repository URL exist. */
      readonly revision?: RevisionRowView;
      /** The last reviewer row. */
      readonly reviewer: TextRowView;
      /** The reasons heading, in the page's language. */
      readonly reasonsLabel: string;
      /** Why the page has its level, in display order. */
      readonly reasons: readonly string[];
      /** The configured action links, in order; empty when the site configures none. */
      readonly actions: readonly ActionView[];
    };

/** The chip's localised text: the state's label inside the chip string. */
function chipText(lang: string, level: TrustLevel): string {
  return t(lang, "trust_chip", { level: t(lang, LEVEL_KEYS[level]) });
}

/** One provenance date row, or undefined when the date is missing or cannot be localised. */
function dateRowView(label: string, iso: string | undefined, lang: string): DateRowView | undefined {
  if (iso === undefined) return undefined;
  const date = calendarDate(iso, lang);
  if (date === undefined) return undefined;
  // The visible text stays localised; `datetime` and the tooltip keep every part of the written timestamp.
  const exact = iso === date.datetime ? date.text : iso;
  return { label, iso, text: date.text, exact };
}

/**
 * The panel's whole view model for one page: the directive's props win over `site.data.trust`, and
 * every row, reason, and action is selected and localised here so the markup draws without touching
 * the site contracts. Pure: the same inputs always name the same view, and nothing is mutated.
 */
export function trustPanelViewOf(props: TrustPanelProps, page: Page, site: Site | undefined): TrustPanelView {
  const evidence = props.level === undefined ? trustEvidenceFor(site, page.url) : trustEvidenceOf(props);
  if (evidence.state === "absent") return { state: "absent" };

  const lang = page.lang;
  const reasonsLabel = t(lang, "trust_reasons");

  // A present entry that cannot be read still reports itself: unknown, marked invalid, and with no
  // evidence rows, provenance, or actions from the unreadable record or its siblings.
  if (evidence.state === "invalid") {
    return { state: "invalid", chip: chipText(lang, "unknown"), reasonsLabel, reasons: explanationOf(lang, "unknown", []) };
  }

  const entry = evidence.entry;
  const provenance = provenanceOf(site, page.url, entry);
  const revision =
    provenance.reviewedCommit === undefined || site?.config.repository === undefined
      ? undefined
      : commitUrlOf(site.config.repository, provenance.reviewedCommit);
  const evidenceRows = examplesFor(site, page.url);
  const options = trustOptions(site?.config);
  const contextPack = actionHrefOf(site?.config, page, options?.contextPackUrl, provenance);
  const suggestEdit = actionHrefOf(site?.config, page, options?.suggestEditUrl, provenance);
  const generated = dateRowView(t(lang, "updated"), provenance.generatedAt, lang);
  const reviewed = dateRowView(t(lang, "reviewed"), provenance.reviewedAt, lang);

  return {
    state: "valid",
    level: entry.level,
    chip: chipText(lang, entry.level),
    provenance,
    examples: {
      label: t(lang, "trust_examples"),
      text: examplesText(lang, evidenceRows),
      className: examplesClassName(evidenceRows.state),
      attrs: examplesAttrs(evidenceRows),
    },
    drift: { label: t(lang, "trust_drift"), text: driftText(lang, driftFor(site, page.url)) },
    ...(generated === undefined ? {} : { generated }),
    ...(reviewed === undefined ? {} : { reviewed }),
    ...(revision === undefined
      ? {}
      : { revision: { label: t(lang, "trust_reviewed_commit"), href: revision, commit: provenance.reviewedCommit ?? "" } }),
    reviewer: { label: t(lang, "trust_reviewer"), text: reviewerText(lang, entry.lastReviewer) },
    reasonsLabel,
    reasons: explanationOf(lang, entry.level, entry.reasons),
    actions: [
      ...(contextPack === undefined ? [] : [{ href: contextPack, label: t(lang, "trust_context_pack") }]),
      ...(suggestEdit === undefined ? [] : [{ href: suggestEdit, label: t(lang, "trust_suggest_edit") }]),
    ],
  };
}