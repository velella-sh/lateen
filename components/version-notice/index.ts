import { h } from "preact";
import { isRecord, textOf } from "../../src/guards.ts";
import type { Component, Page, Site } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

import { CURRENT, INDEX_FILE, versionOf, versionPath as pathOf } from "../../src/docs-versions.ts";

export { CURRENT, versionOf };

/** Where the notice's link goes. `none` is a notice without a link, for a site with no reachable home. */
export type NoticeTarget = "page" | "home" | "site" | "none";

/** The page's own lifecycle state and, when it has one, the same page in the other version. */
export interface VersionNotice {
  /** The page's version folder, such as `v1`. */
  readonly version: string;
  /** `default` is the release served at canonical URLs; `old` is a release the default replaced. */
  readonly status: "default" | "old";
  /** The version the link points into; absent when the page is default and no version is old. */
  readonly targetVersion?: string;
  /** A page that exists in the site model: the equivalent page, a version home, or the site home. */
  readonly href?: string;
  /** What `href` is, so a client or a test can tell the three apart. */
  readonly target: NoticeTarget;
}

/** `site.data.versions`: the dispositions from `_data/versions.yml`. */
interface Settings {
  /** The release served at canonical URLs, or `current`. */
  readonly default: string;
  /** Releases the default replaced, in file order, without duplicates or the default. */
  readonly old: readonly string[];
}

/**
 * The lifecycle dispositions, or undefined when the data is not the lifecycle shape. A versions file
 * without `default` or `old` is the old page-to-versions data, which this notice does not read.
 */
function settingsOf(value: unknown): Settings | undefined {
  if (!isRecord(value) || (!("default" in value) && !("old" in value))) return undefined;
  const fallback = textOf(value.default) ?? CURRENT;
  const listed = Array.isArray(value.old) ? value.old : [];
  const old: string[] = [];
  for (const entry of listed) {
    const name = textOf(entry);
    if (name !== undefined && name !== fallback && !old.includes(name)) old.push(name);
  }
  return { default: fallback, old };
}

/** Prefer the canonical page when routing published two URLs for one source. */
function canonicalFirst(a: Page, b: Page): number {
  if ((a.aliasOf === undefined) !== (b.aliasOf === undefined)) return a.aliasOf === undefined ? -1 : 1;
  return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
}

/** The first page in `version` (or the current docs when undefined) at `path`, when one exists. */
function pageAt(site: Site, version: string | undefined, path: string): Page | undefined {
  return [...site.pages]
    .sort(canonicalFirst)
    .find((candidate) => versionOf(candidate) === version && pathOf(candidate) === path);
}

/** The version's home page when the site publishes one, such as `v2/index.md` at `/v2/`. */
function versionHome(site: Site, version: string): Page | undefined {
  return [...site.pages]
    .sort(canonicalFirst)
    .find((candidate) => versionOf(candidate) === version && INDEX_FILE.test(pathOf(candidate)));
}

/** The site's home page, used when the target version publishes no home of its own. */
function siteHome(site: Site): Page | undefined {
  return [...site.pages]
    .sort(canonicalFirst)
    .find((candidate) => versionOf(candidate) === undefined && INDEX_FILE.test(pathOf(candidate)));
}

/** The link into `target`, preferring the same page and falling back only to pages the model holds. */
function destination(
  site: Site,
  path: string,
  target: string | undefined,
): Pick<VersionNotice, "targetVersion" | "href" | "target"> {
  const equivalent = pageAt(site, target, path);
  if (equivalent !== undefined) return { ...(target === undefined ? {} : { targetVersion: target }), href: equivalent.url, target: "page" };

  const home = target === undefined ? undefined : versionHome(site, target);
  if (home !== undefined) {
    return target === undefined
      ? { href: home.url, target: "home" }
      : { targetVersion: target, href: home.url, target: "home" };
  }

  const root = siteHome(site);
  return { ...(target === undefined ? {} : { targetVersion: target }), ...(root === undefined ? {} : { href: root.url }), target: root === undefined ? "none" : "site" };
}

/**
 * The version status of a page, from `_data/versions.yml` and the site model.
 *
 * The page's version is the first segment of its source path, by the engine's rule. A page in the
 * default release is `default` and links the same page in the first old release; a page in an old
 * release is `old` and links the same page in the default release (or the current docs when the
 * default is `current`). When the other version has no copy of the page, the link goes to that
 * version's home page when the site publishes one, else the site home. A URL is taken from a page
 * in the model, never built from a name. A page outside the dispositions has no notice.
 */
export function noticeOf(site: Site, page: Page): VersionNotice | undefined {
  const settings = settingsOf(site.data.versions);
  if (settings === undefined) return undefined;

  const version = versionOf(page);
  if (version === undefined) return undefined;

  if (version === settings.default) {
    const target = settings.old[0];
    if (target === undefined) return { version, status: "default", target: "none" };
    return { version, status: "default", ...destination(site, pathOf(page), target) };
  }

  if (!settings.old.includes(version)) return undefined;

  const target = settings.default === CURRENT ? undefined : settings.default;
  return { version, status: "old", ...destination(site, pathOf(page), target) };
}

/** The label of the page's own state: the current release, or a release the default replaced. */
function labelKey(status: VersionNotice["status"]): string {
  return status === "default" ? "version_current" : "status_old_version";
}

/** The sentence under the label. */
function hintKey(status: VersionNotice["status"]): string {
  return status === "default" ? "version_notice_current_hint" : "status_old_version_hint";
}

/** The link text for the destination, read in the page's language. */
function linkText(lang: string, notice: VersionNotice): string {
  if (notice.target === "site") return t(lang, "version_notice_site_home");
  if (notice.target === "home") return t(lang, "version_notice_home", { version: notice.targetVersion ?? "" });
  if (notice.targetVersion === undefined) return t(lang, "version_notice_current_page");
  return t(lang, "version_notice_page", { version: notice.targetVersion });
}

/**
 * A page-level notice that says whether the reader is on the current release or an old one, and
 * links the same page in the other version. It reads `_data/versions.yml` (`default` and `old`) and
 * pairs pages by their source path inside the version folder. A page without an equivalent links a
 * home page that exists in the site model, so the destination is always reachable and never built
 * from a guessed URL. It works without JavaScript, is a named `note`, and uses logical properties so
 * it mirrors under RTL.
 */
const versionNotice: Component = ({ site, page }) => {
  const notice = noticeOf(site, page);
  if (notice === undefined) return null;

  return h(
    "div",
    {
      class: "version-notice",
      role: "note",
      "data-version": notice.version,
      "data-version-status": notice.status,
    },
    h("strong", { class: "version-notice-label" }, t(page.lang, labelKey(notice.status))),
    h("span", { class: "version-notice-version", dir: "ltr" }, notice.version),
    h("span", { class: "version-notice-hint" }, t(page.lang, hintKey(notice.status))),
    notice.href === undefined
      ? null
      : h(
          "a",
          {
            class: "version-notice-link",
            href: notice.href,
            "data-version-target": notice.target,
          },
          linkText(page.lang, notice),
        ),
  );
};

export default versionNotice;
