import type { Page, Site, SiteConfig } from "@velella/mizzen/contracts";
import { evidenceRowsOf, type EvidenceRow } from "./evidence.ts";
import { t } from "../../i18n/index.ts";
import { calendarDate, configuredCalendar, isoDate, type DateCalendar } from "../../src/dates.ts";
import { optionOf } from "../../src/options.ts";
import { commitUrlOf } from "../../src/repository.ts";
import { isRecord, knownOf, textOf } from "../../src/guards.ts";
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
  return knownOf(LEVELS, level) ?? ALIASES[level];
}

/** Reason messages from engine objects, legacy strings, or a string split on line breaks or `|`. */
export function reasonsOf(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\r?\n|\s*\|\s*/)
      .map((reason) => reason.trim())
      .filter((reason) => reason !== "");
  }
  if (!Array.isArray(value)) return [];
  return value.map((reason) => textOf(isRecord(reason) ? reason.message : reason))
    .filter((reason): reason is string => reason !== undefined);
}

/** The readable entry in a record whose level is already known. */
function entryFrom(value: Record<string, unknown>, level: TrustLevel): TrustEntry {
  const lastReviewer = textOf(value.lastReviewer);
  const reviewedCommit = textOf(value.reviewedCommit);
  return {
    level,
    reasons: reasonsOf(value.reasons),
    ...(lastReviewer === undefined ? {} : { lastReviewer }),
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

function rawTrustEntry(site: Site | undefined, url: string): unknown {
  const pages = pagesOf(site?.data?.trust);
  return pages !== undefined && Object.hasOwn(pages, url) ? pages[url] : undefined;
}

/** The page's trust evidence from `site.data.trust`, keyed by its exact URL including `base`. */
export function trustEvidenceFor(site: Site | undefined, url: string | undefined): TrustEvidence {
  if (url === undefined) return { state: "absent" };
  return trustEvidenceOf(rawTrustEntry(site, url));
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

/** The original ISO value, with a valid calendar day and a readable instant. */
function provenanceDate(value: unknown): string | undefined {
  const text = textOf(value);
  return text !== undefined && isoDate(text) !== undefined && Number.isFinite(Date.parse(text)) ? text : undefined;
}

/** Mirror the reviewer formats accepted by Mizzen's trust calculation. */
function reviewOf(data: unknown, url: string): Record<string, unknown> | undefined {
  const records = isRecord(data) && data.pages !== undefined ? data.pages : data;
  if (Array.isArray(records)) {
    return records.findLast((value) => isRecord(value) && value.url === url);
  }
  if (!isRecord(records) || !Object.hasOwn(records, url)) return undefined;
  const record = records[url];
  return isRecord(record) ? record : undefined;
}

/** Read an exact review date from the same inline evidence Mizzen used. */
function reviewDateOf(review: Record<string, unknown> | undefined, input: Record<string, unknown>, asOf: string | undefined): string | undefined {
  const date = provenanceDate(review?.date);
  const author = textOf(review?.author);
  if (date === undefined || author === undefined) return undefined;
  if (isRecord(input.provenance)) {
    const provenance = input.provenance.review;
    if (!isRecord(provenance) || provenance.source !== "inline" || provenance.availability !== "available") return undefined;
    if (input.lastReviewer !== undefined && input.lastReviewer !== author) return undefined;
  }
  if (asOf !== undefined && Date.parse(date) > Date.parse(asOf)) return undefined;
  if (asOf !== undefined && Array.isArray(input.factors)) {
    const factor = input.factors.find((value) => isRecord(value) && value.signal === "review");
    const elapsed = Math.floor((Date.parse(asOf) - Date.parse(date)) / 86_400_000);
    if (typeof factor?.value === "number" && elapsed !== factor.value) return undefined;
  }
  return date;
}

/** The build digest from a supplied trust report and review evidence for this page. */
export function provenanceOf(site: Site | undefined, url: string | undefined, input?: unknown): Provenance {
  if (url === undefined) return {};
  const stored = rawTrustEntry(site, url);
  const entry = input ?? stored;
  if (!isRecord(entry)) return {};
  const data = site?.data?.trust;
  const report = entry === stored && isRecord(data) && data.version === 2 && isRecord(data.pages) ? data : undefined;
  const build = report?.build;
  const id = isRecord(build) && build.algorithm === "sha256" ? textOf(build.id) : undefined;
  const buildId = id !== undefined && /^[0-9a-f]{64}$/.test(id) ? id : undefined;
  const review = reviewOf(site?.data?.reviewers, url);
  const reviewedAt = reviewDateOf(review, entry, provenanceDate(report?.asOf));
  const commit = textOf(entry.reviewedCommit) ?? textOf(review?.commit);
  const reviewedCommit = commit !== undefined && /^[0-9a-f]{7,64}$/i.test(commit) ? commit.toLowerCase() : undefined;
  return {
    ...(buildId === undefined ? {} : { buildId }),
    ...(reviewedAt === undefined ? {} : { reviewedAt }),
    ...(reviewedCommit === undefined ? {} : { reviewedCommit }),
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

/** Fill page and evidence placeholders. A link needing unavailable provenance is omitted. */
function fill(value: string, page: Page, provenance: Provenance): string | undefined {
  const source = page.source.file.split("/").map(encodeURIComponent).join("/");
  const values: Readonly<Record<string, string | undefined>> = {
    url: page.url,
    title: encodeURIComponent(page.title),
    source,
    build: provenance.buildId === undefined ? undefined : encodeURIComponent(provenance.buildId),
    generated: undefined,
    reviewed: provenance.reviewedAt === undefined ? undefined : encodeURIComponent(provenance.reviewedAt),
  };
  for (const [name, resolved] of Object.entries(values)) {
    if (resolved === undefined && value.includes(`{${name}}`)) return undefined;
  }
  return value.replace(/\{(url|title|source|build|reviewed)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
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
      readonly signalRows?: readonly EvidenceRow[];
      /** The drift row, from `site.data.drift`. */
      readonly drift: TextRowView;
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
function dateRowView(label: string, iso: string | undefined, lang: string, calendar: DateCalendar | undefined): DateRowView | undefined {
  if (iso === undefined) return undefined;
  const date = calendarDate(iso, lang, calendar);
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
  const input = props.level === undefined ? rawTrustEntry(site, page.url) : props;
  const evidence = trustEvidenceOf(input);
  if (evidence.state === "absent") return { state: "absent" };

  const lang = page.lang;
  const reasonsLabel = t(lang, "trust_reasons");

  // A present entry that cannot be read still reports itself: unknown, marked invalid, and with no
  // evidence rows, provenance, or actions from the unreadable record or its siblings.
  if (evidence.state === "invalid") {
    return { state: "invalid", chip: chipText(lang, "unknown"), reasonsLabel, reasons: explanationOf(lang, "unknown", []) };
  }

  const entry = evidence.entry;
  const signalRows = isRecord(input) ? evidenceRowsOf(input, lang) : [];
  const provenance = provenanceOf(site, page.url, input);
  const revision =
    provenance.reviewedCommit === undefined || site?.config.repository === undefined
      ? undefined
      : commitUrlOf(site.config.repository, provenance.reviewedCommit);
  const evidenceRows = examplesFor(site, page.url);
  const options = trustOptions(site?.config);
  const contextPack = actionHrefOf(site?.config, page, options?.contextPackUrl, provenance);
  const suggestEdit = actionHrefOf(site?.config, page, options?.suggestEditUrl, provenance);
  const calendar = configuredCalendar(site?.config);
  const reviewed = dateRowView(t(lang, "reviewed"), provenance.reviewedAt, lang, calendar);

  return {
    state: "valid",
    level: entry.level,
    chip: chipText(lang, entry.level),
    provenance,
    ...(signalRows.length === 0 ? {} : { signalRows }),
    examples: {
      label: t(lang, "trust_examples"),
      text: examplesText(lang, evidenceRows),
      className: examplesClassName(evidenceRows.state),
      attrs: examplesAttrs(evidenceRows),
    },
    drift: { label: t(lang, "trust_drift"), text: driftText(lang, driftFor(site, page.url)) },
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