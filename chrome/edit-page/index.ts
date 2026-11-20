import { h } from "preact";
import type { Chrome, Heading, Page, RepositoryConfig, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { optionOf } from "../../src/options.ts";
import {
  DEFAULT_BRANCH,
  clipTitle,
  encodePath,
  fitUrl,
  hostOf,
  oneLine,
  sourcePath,
  webRoot,
} from "../../src/repository.ts";

export { hostOf };

/*
 * "Edit this page" in the page footer, and per-heading "suggest an edit" links.
 *
 * The engine's `outputs/edit-links.ts` (N35) and `outputs/suggest-links.ts` (N36) compute the same URLs for
 * outputs; a site that writes their result to `_data/edit-links.yml` gets it read here first. Without that
 * data the unit computes the URL from `site.config.repository` by the engine's rules, because a theme may
 * `import type` from the engine's contracts and run none of its code. The two must agree, so a
 * change to one belongs in both until the engine exposes the links as site data on every build.
 */

/** Class on the footer block. `styles/src/ui.css` styles its link target. */
export const CLASS = "edit-page";

/** Class on the "Edit this page" link. */
export const LINK_CLASS = "edit-page-link";

/** Class on the opt-in list of per-heading links. */
export const HEADINGS_CLASS = "edit-page-headings";

/** Class on a heading's "suggest an edit" link, both in the footer list and inside a heading. */
export const HEADING_LINK_CLASS = "edit-page-heading-link";

/** Only a web address is linked, so a data file cannot inject `javascript:` or `data:`. */
const SAFE_HREF = /^https?:\/\/[^\s]+$/i;

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

/**
 * The file's edit URL: `${root}/edit/${branch}/${path}` on GitHub and `${root}/-/edit/${branch}/${path}` on
 * GitLab. `repository.dir` is already part of `page.source.file` (the model names every source from the
 * repository root), so it is not added again. The branch is one encoded segment, so a branch name with `/`
 * stays a single path part, and each segment of the file path is encoded while its separators stay.
 */
export function editUrlOf(repository: RepositoryConfig, file: string): string | undefined {
  const host = hostOf(repository);
  if (host === undefined) return undefined;
  const path = sourcePath(file);
  if (path.trim() === "") return undefined;
  const branch = repository.branch ?? DEFAULT_BRANCH;
  const edit = host === "gitlab" ? "/-/edit" : "/edit";
  return `${webRoot(repository.url)}${edit}/${encodeURIComponent(branch)}/${encodePath(path)}`;
}

/** One entry of the engine's edit-link output, or of a data file shaped like it. */
function entryHref(entry: Record<string, unknown>): string | undefined {
  return text(entry.editUrl) ?? text(entry.edit_url);
}

/** A web address from site data, or `undefined` when the value is not one. */
function storedHref(value: unknown): string | undefined {
  const href = text(value);
  return href !== undefined && SAFE_HREF.test(href) ? href : undefined;
}

/**
 * A page's edit URL from engine-written site data, keyed by page URL. The engine's `editLinksOf` returns a
 * list of `{ url, source, editUrl }`, so an array is accepted, as is a record of page URL to either the URL
 * itself or an object with `editUrl` (or `edit_url`). An array entry that names a different source file is
 * skipped when `file` is given, so the destination always keeps the page's canonical source. Anything else,
 * or an unsafe scheme, is absent.
 */
export function editLinkFromData(data: unknown, url: string, file?: string): string | undefined {
  if (Array.isArray(data)) {
    for (const entry of data) {
      if (!isRecord(entry) || entry.url !== url) continue;
      const source = text(entry.source);
      if (file !== undefined && source !== undefined && sourcePath(source) !== sourcePath(file)) continue;
      const href = entryHref(entry);
      if (href === undefined) continue;
      const stored = storedHref(href);
      if (stored !== undefined) return stored;
    }
    return undefined;
  }
  if (!isRecord(data)) return undefined;
  const value = data[url];
  if (typeof value === "string") return storedHref(value);
  if (!isRecord(value)) return undefined;
  return storedHref(entryHref(value));
}

/** The record's data file and the inclusive lines it covers, or `undefined` for a page not built from a record. */
function recordSource(page: Page): { file: string; start: number; end: number } | undefined {
  const position = page.record?.position;
  if (position === undefined) return undefined;
  const file = text(position.file);
  const start = position.startLine;
  if (file === undefined || !Number.isInteger(start) || start < 1) return undefined;
  const end = Number.isInteger(position.endLine) && position.endLine >= start ? position.endLine : start;
  return { file, start, end };
}

/** The record's line range as a forge anchor: `#L5-L9`, or `#L5` for a record on one line. */
function lineAnchor(start: number, end: number): string {
  return end === start ? `#L${start}` : `#L${start}-L${end}`;
}

/**
 * The page's edit link: `site.data` first, then the repository, or `undefined` when neither gives one. A record
 * page points at the record's data file and line range, not at its template, so the reader lands on the data.
 */
export function editHref(site: Site, page: Page): string | undefined {
  const data = site.data["edit-links"] ?? site.data.editLinks;
  const fromData = editLinkFromData(data, page.url, page.source.file);
  if (fromData !== undefined) return fromData;
  const repository = site.config.repository;
  if (repository === undefined) return undefined;
  const record = recordSource(page);
  const url = editUrlOf(repository, record?.file ?? page.source.file);
  return url === undefined || record === undefined ? url : `${url}${lineAnchor(record.start, record.end)}`;
}

/** The heading's source line, or `undefined` when the heading is generated and has no real source span. */
function headingSource(heading: Heading): { file: string; line: number } | undefined {
  const pos: Partial<SourcePos> | undefined = heading.pos;
  if (pos === undefined || typeof pos.file !== "string" || pos.file === "") return undefined;
  const line = pos.line;
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1) return undefined;
  return { file: pos.file, line };
}

/** The issue title, cut to {@link MAX_TITLE} code points with an ellipsis so the page and heading still show. */
function titleOf(page: Page, heading: Heading): string {
  const pageTitle = oneLine(page.title) || page.url;
  const headingText = oneLine(heading.text) || heading.id;
  const full = `Suggest edit: ${pageTitle} — ${headingText}`;
  return clipTitle(full);
}

/** The issue body: the page, its source file and line, and the heading anchor, each on its own line. */
function bodyOf(page: Page, heading: Heading, source: { file: string; line: number }): string {
  return [
    "Suggest an edit to this heading.",
    "",
    `Page: ${page.url}`,
    `Source: ${source.file}:${source.line}`,
    `Heading: ${heading.id}`,
    "",
  ].join("\n");
}

/**
 * The new-issue URL that suggests an edit to one heading, or `undefined` when there is nothing to point at:
 * no repository, a repository URL that is not a web URL or is on an unknown forge, no page URL, an unknown
 * heading (`heading.id` is not one of `page.headings`), or a generated heading with no source position.
 *
 * The heading is looked up in the page so the position always comes from the model, not from a copy the
 * caller may have built. GitHub takes `/issues/new?title=&body=`; GitLab takes `/-/issues/new` with its own
 * query keys, the same shapes the engine's `suggest-links.ts` writes.
 */
export function suggestEditUrl(
  repository: RepositoryConfig | undefined,
  page: Page,
  heading: Heading | undefined,
): string | undefined {
  if (repository === undefined || heading === undefined) return undefined;
  if (page.url === "") return undefined;
  const host = hostOf(repository);
  if (host === undefined) return undefined;
  const root = webRoot(repository.url);

  const found = page.headings.find((candidate) => candidate.id === heading.id);
  if (found === undefined || found.id === "") return undefined;
  const source = headingSource(found);
  if (source === undefined) return undefined;

  return fitUrl(root, host, titleOf(page, found), bodyOf(page, found, source));
}

/** The `theme.options.editPage` block as the config wrote it. */
interface EditPageOptions {
  /** `true` adds per-heading links; every other value, and no block, leaves them out. */
  readonly headingLinks?: unknown;
}

/** Whether the site opted in to per-heading links. */
export function headingLinksEnabled(config: SiteConfig): boolean {
  const options = optionOf(config.theme.options, "editPage");
  return isRecord(options) && (options as EditPageOptions).headingLinks === true;
}

/** One heading and the issue URL that suggests an edit to it. */
export interface HeadingLink {
  /** The heading, from `page.headings`. */
  readonly heading: Heading;
  /** The host's new-issue URL for this heading. */
  readonly url: string;
}

/**
 * The per-heading links for a page, in document order, when the site asked for them and the repository gives
 * a URL. An empty list otherwise, which leaves the footer block to the page link alone.
 */
export function headingLinksOf(site: Site, page: Page): readonly HeadingLink[] {
  if (!headingLinksEnabled(site.config)) return [];
  const links: HeadingLink[] = [];
  for (const heading of page.headings) {
    const url = suggestEditUrl(site.config.repository, page, heading);
    if (url !== undefined) links.push({ heading, url });
  }
  return links;
}

/**
 * The edit-page footer: one "Edit this page" link to the page's source, and, when `theme.options.editPage.
 * headingLinks` is `true`, a list of per-heading "suggest an edit" issue links. Renders nothing at all when
 * there is no link to point at, so a site without a repository shows no dead control (AC1, AC3).
 *
 * The heading list is the visible fallback for now. `style.css` also carries the rules that reveal a
 * `.edit-page-heading-link` placed inside a heading on hover or focus; injecting those links next to each
 * heading is an engine Markdown/HTML stage task, since a chrome part cannot change `page.html`.
 */
const editPage: Chrome = ({ site, page }) => {
  if (page.kind !== "doc") return null;

  const href = editHref(site, page);
  const headings = headingLinksOf(site, page);
  if (href === undefined && headings.length === 0) return null;

  return h(
    "div",
    { class: CLASS, "data-edit-page": true },
    href === undefined
      ? null
      : h("a", { class: LINK_CLASS, href, rel: "noopener" }, t(page.lang, page.record === undefined ? "edit_page" : "edit_record")),
    headings.length === 0
      ? null
      : h(
          "ul",
          { class: HEADINGS_CLASS },
          ...headings.map(({ heading, url }) =>
            h(
              "li",
              null,
              h(
                "a",
                {
                  class: HEADING_LINK_CLASS,
                  href: url,
                  rel: "noopener",
                  "aria-label": t(page.lang, "suggest_edit_heading", { heading: heading.text || heading.id }),
                },
                heading.text || heading.id,
              ),
            ),
          ),
        ),
  );
};

export default editPage;
