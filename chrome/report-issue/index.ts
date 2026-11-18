import { h } from "preact";
import type { Chrome, Page, PageRecord, RepositoryConfig, Site, SiteConfig } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { clipTitle, fitUrl, hostOf, lineUrlOf, oneLine, webRoot } from "../../src/repository.ts";

/*
 * "Report a problem with this page": a plain link that opens a new issue on the site's repository with the
 * page title, address, source file, language and version filled in. A record page names its collection, id and
 * linked data file line instead of the page source, and asks about "this data". Nothing is sent from the page;
 * the reader submits the issue themselves. Host detection and the issue URL come from `src/repository.ts`,
 * shared with `edit-page`.
 *
 * `theme.options.reportIssue` shapes the link: `template` (an issue template name), `labels`, `titlePrefix`,
 * and `url` (a template for trackers other than GitHub and GitLab). `false` turns the unit off.
 */

/** Class on the block. `style.css` styles it. */
export const CLASS = "report-issue";

/** Class on the link. */
export const LINK_CLASS = "report-issue-link";

/** The placeholders a custom `url` template may use. */
export const PLACEHOLDERS = ["title", "body", "url", "source", "lang", "version"] as const;

/** Every config value the report link reads, in the order the docs page lists them. */
export const REPORT_ISSUE_OPTIONS = [
  "repository.url",
  "repository.branch",
  "theme.options.reportIssue",
  "theme.options.reportIssue.template",
  "theme.options.reportIssue.labels",
  "theme.options.reportIssue.titlePrefix",
  "theme.options.reportIssue.url",
] as const;

/** True for a plain object, never an array or `null`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-empty string, trimmed; anything else is absent. */
function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** The `theme.options.reportIssue` block, read defensively. */
export interface ReportIssueOptions {
  /** `false` when the site turned the unit off. */
  readonly enabled: boolean;
  readonly template?: string;
  readonly labels: readonly string[];
  readonly titlePrefix?: string;
  readonly url?: string;
}

/** Reads the options block; every unusable value is absent. */
export function optionsOf(config: SiteConfig): ReportIssueOptions {
  const raw: unknown = config.theme.options?.reportIssue;
  if (raw === false) return { enabled: false, labels: [] };
  if (!isRecord(raw)) return { enabled: true, labels: [] };
  const labels = Array.isArray(raw.labels)
    ? raw.labels.map(text).filter((label): label is string => label !== undefined)
    : [];
  const template = text(raw.template);
  const titlePrefix = text(raw.titlePrefix);
  const url = text(raw.url);
  return {
    enabled: true,
    labels,
    ...(template === undefined ? {} : { template }),
    ...(titlePrefix === undefined ? {} : { titlePrefix }),
    ...(url === undefined ? {} : { url }),
  };
}

/** The page's declared version, or an empty string. */
function versionOf(page: Page): string {
  const version = page.frontMatter.version;
  return typeof version === "string" ? version.trim() : "";
}

/** The page's source file, with its line when the model has one. */
function sourceOf(page: Page): string {
  return page.source.file;
}

/**
 * The issue title: the optional prefix and the page title, one line, cut to the host's limit.
 * A fact's label follows the page title, so one record's values make distinct issues.
 */
export function titleOf(page: Page, prefix?: string, field?: string): string {
  const title = oneLine(page.title) || page.url;
  const named = field === undefined ? title : `${title}: ${oneLine(field)}`;
  return clipTitle(prefix === undefined ? named : `${prefix} ${named}`);
}

/**
 * The lines that name a record: its collection, its id, and its data file at the record's first line, linked
 * to the repository when the host gives a URL. Field values stay out; they can be long and the id is enough.
 */
function recordLines(record: PageRecord, repository: RepositoryConfig | undefined): string[] {
  const file = record.position.file;
  const line = record.position.startLine;
  const data = `${file}:${line}`;
  const href = repository === undefined ? undefined : lineUrlOf(repository, file, line);
  return [
    `Collection: ${record.collection}`,
    `Record: ${record.id}`,
    `Data: ${href === undefined ? data : `[${data}](${href})`}`,
  ];
}

/**
 * The issue body: the page address, the field a fact report names, then the record or the source
 * file, language and version, each on its own line.
 */
export function bodyOf(page: Page, repository?: RepositoryConfig, field?: string): string {
  const version = versionOf(page);
  const record = page.record;
  return [
    record === undefined ? "I found a problem with this page." : "I found a problem with this data.",
    "",
    `Page: ${page.url}`,
    ...(field === undefined ? [] : [`Field: ${field}`]),
    ...(record === undefined ? [`Source: ${sourceOf(page)}`] : recordLines(record, repository)),
    `Language: ${page.lang}`,
    ...(version === "" ? [] : [`Version: ${version}`]),
    "",
  ].join("\n");
}

/** True for an `https` address only. */
function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A custom tracker address: the template's `{placeholders}` filled in one pass with encoded values, so a
 * value that itself contains `{title}` is never expanded again. An unknown placeholder is left as written.
 * `undefined` when the template or its result is not an `https` address.
 */
export function fillTemplate(template: string, page: Page, title: string, body: string): string | undefined {
  if (!isHttps(template.replace(/\{\w+\}/g, "x"))) return undefined;
  const values: Record<string, string> = {
    title,
    body,
    url: page.url,
    source: sourceOf(page),
    lang: page.lang,
    version: versionOf(page),
  };
  const filled = template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? encodeURIComponent((values[name] ?? "").toWellFormed()) : match,
  );
  return isHttps(filled) ? filled : undefined;
}

/** The extra query text for a template name and labels; GitLab takes a template but no label query. */
function extraOf(host: "github" | "gitlab", options: ReportIssueOptions): string {
  let extra = "";
  if (options.template !== undefined) {
    extra += `&${host === "gitlab" ? "issuable_template" : "template"}=${encodeURIComponent(options.template)}`;
  }
  if (host === "github" && options.labels.length > 0) {
    extra += `&labels=${options.labels.map(encodeURIComponent).join(",")}`;
  }
  return extra;
}

/**
 * The report link's address, or `undefined` when the unit is off, or the site names no usable tracker: no
 * repository, or an unsupported host and no custom `url`. A custom `url` wins over the repository.
 * A `field` names one fact of a record in the title and the body.
 */
export function reportHref(site: Site, page: Page, field?: string): string | undefined {
  const options = optionsOf(site.config);
  if (!options.enabled) return undefined;
  const title = titleOf(page, options.titlePrefix, field);
  const body = bodyOf(page, site.config.repository, field);
  if (options.url !== undefined) return fillTemplate(options.url, page, title, body);
  const repository = site.config.repository;
  if (repository === undefined) return undefined;
  const host = hostOf(repository);
  if (host === undefined) return undefined;
  return fitUrl(webRoot(repository.url), host, title, body, extraOf(host, options));
}

/** The report link for a page, or nothing when there is no address to point at. */
const reportIssue: Chrome = ({ site, page }) => {
  const href = reportHref(site, page);
  if (href === undefined) return null;
  return h(
    "div",
    { class: CLASS, "data-report-issue": true },
    h("a", { class: LINK_CLASS, href, rel: "noopener" }, t(page.lang, page.record === undefined ? "report_issue" : "report_data")),
  );
};

export default reportIssue;
