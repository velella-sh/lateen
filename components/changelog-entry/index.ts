import { h } from "preact";
import type { VNode } from "preact";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import { CircleCheck, CircleMinus, CirclePlus, Link, ShieldCheck, SquarePen } from "lucide";
import type { IconNode } from "lucide";
import { calendarDate } from "../../src/dates.ts";
import { icon } from "../../src/icon.ts";
import { t } from "../../i18n/index.ts";

/** The category names a changelog entry can mark. The order here is the order the documentation lists them. */
export const CATEGORIES = ["added", "changed", "fixed", "removed", "security"] as const;

export type Category = (typeof CATEGORIES)[number];

/** Class on the section that wraps one entry. */
export const SECTION_CLASS = "changelog-entry";

/** Class on the h2 that holds the version. */
export const HEADING_CLASS = "changelog-entry-version";

/** Class on the span that holds the version text, so the heading's name excludes the link icon. */
export const VERSION_CLASS = "changelog-entry-version-text";

/** Class on the self-link anchor beside the version. */
export const ANCHOR_CLASS = "changelog-entry-anchor";

/** Class on the machine-readable date. */
export const DATE_CLASS = "changelog-entry-date";

/** Class on the row that holds the date and the categories. */
export const META_CLASS = "changelog-entry-meta";

/** Class on the category list. */
export const CATEGORIES_CLASS = "changelog-entry-categories";

/** Class every category item carries, followed by `-<category>`. */
export const CATEGORY_CLASS = "changelog-entry-category";

/** Class on a category's visible label. */
export const CATEGORY_LABEL_CLASS = "changelog-entry-category-label";

/** Class on the rendered entry body. */
export const BODY_CLASS = "changelog-entry-body";

/** Class on the paragraph shown when the author gives no body. */
export const EMPTY_CLASS = "changelog-entry-empty";

/** Class on the word "Version" before the heading text, for assistive tech only. */
export const SR_CLASS = "changelog-entry-sr";

/** Props from the directive: `:::changelog-entry{version="1.2.0" date="2026-11-09" categories="added,fixed"}`. */
export type ChangelogEntryProps = {
  /** The release version, such as `1.2.0` or `v1.2.0`. Missing or blank falls back to "Unreleased". */
  version?: string;
  /** A stable id for the section and its self-link. Missing falls back to the version slug. */
  id?: string;
  /** The release date as `YYYY-MM-DD`; the date part of an ISO date-time is used too. */
  date?: string;
  /** Categories separated by commas, or a JSON array of strings: `added`, `changed`, `fixed`, `removed`, `security`. */
  categories?: string;
};

/**
 * A rendered entry. Its section vnode publishes the one id it allocated, so a layout that renders the
 * entries can link its contents at exactly the id each section carries.
 */
export type ChangelogEntryNode = VNode<{ id: string }>;

/** The i18n key of each category's visible label. */
const CATEGORY_KEYS: Readonly<Record<Category, string>> = {
  added: "changelog_added",
  changed: "changelog_changed",
  fixed: "changelog_fixed",
  removed: "changelog_removed",
  security: "changelog_security",
};

/**
 * Lucide icons for each category. Every icon is symmetric along the reading direction, so it needs
 * no mirror rule under right-to-left.
 */
const CATEGORY_ICONS: Readonly<Record<Category, IconNode>> = {
  added: CirclePlus,
  changed: SquarePen,
  fixed: CircleCheck,
  removed: CircleMinus,
  security: ShieldCheck,
};

/** The slug an id is built from: lower case, dots to dashes, runs of other characters to one dash. */
export function slugOf(version: unknown): string {
  if (typeof version !== "string") return "unversioned";
  const text = version.trim().toLowerCase().replace(/^v(?=\d)/, "");
  const slug = text
    .replace(/\./g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug === "" ? "unversioned" : slug;
}

/** The base section id of an entry: `v` followed by {@link slugOf}, such as `v1-2-0`. */
export function idOf(version: unknown): string {
  return `v${slugOf(version)}`;
}

/**
 * The id of the span that holds the version text, from the entry's section id. The section id is already
 * unique on its page, so the text id is too.
 */
export function versionTextId(sectionId: string): string {
  return `changelog-version-${sectionId}`;
}

/** The id an author gave, escaped to the characters an id may hold; undefined when nothing usable is left. */
export function givenIdOf(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const id = raw
    .trim()
    .replace(/[^\p{L}\p{N}_.:-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return id === "" ? undefined : id;
}

/** The ids claimed on a page, and the page HTML they were counted against. */
const pageIds = new WeakMap<Page, { html: string; used: Set<string> }>();

/**
 * An id unique on its page: the base for the first entry to claim it, then `<base>-2`, `<base>-3` in page
 * order. Both the section id and {@link versionTextId} are reserved, so one entry's text id can never become
 * another entry's section id. Keyed by the Page and reset when its HTML changes, so one page's ids cannot
 * leak into another page or build, and a unique ordinary version keeps the id it published.
 */
export function uniqueIdOf(page: Page, base: string): string {
  let state = pageIds.get(page);
  if (state === undefined || state.html !== page.html) {
    state = { html: page.html, used: new Set() };
    pageIds.set(page, state);
  }
  let id = base;
  for (let n = 2; state.used.has(id) || state.used.has(versionTextId(id)); n += 1) id = `${base}-${n}`;
  state.used.add(id);
  state.used.add(versionTextId(id));
  return id;
}

/** The category names in a `categories` value, in author order, deduplicated, with unknown values dropped. */
export function categoriesOf(value: unknown): Category[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string") {
    const text = value.trim();
    if (text.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(text);
        values = Array.isArray(parsed) ? parsed : [];
      } catch {
        values = text.split(",");
      }
    } else {
      values = text.split(",");
    }
  }

  const found: Category[] = [];
  for (const item of values) {
    if (typeof item !== "string") continue;
    const name = item.trim().toLowerCase();
    if ((CATEGORIES as readonly string[]).includes(name) && !found.includes(name as Category)) {
      found.push(name as Category);
    }
  }
  return found;
}

/** The visible version text, or the translated fallback when the author gave none. */
export function versionTextOf(version: unknown, lang: string): string {
  if (typeof version === "string" && version.trim() !== "") return version.trim();
  return t(lang, "changelog_unreleased");
}

/** The link icon: a chain drawn in `currentColor`, hidden from assistive technology. */
function anchorIcon() {
  return icon({ node: Link, class: "changelog-entry-anchor-icon" });
}

/** One category's icon, hidden from assistive technology because the label beside it names the category. */
function categoryIcon(category: Category) {
  return icon({ node: CATEGORY_ICONS[category], class: "changelog-entry-category-icon" });
}

/** The date, machine-readable when it is a real calendar date, and clear fallback text when it is not. */
function dateNode(value: unknown, lang: string) {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = text === "" ? undefined : calendarDate(text, lang);
  if (parsed === undefined) {
    return h("span", { class: DATE_CLASS }, t(lang, "changelog_date_unknown"));
  }
  return h("time", { class: DATE_CLASS, datetime: parsed.datetime }, parsed.text);
}

/** The category list: an icon and a text label per category, so the meaning never depends on color alone. */
function categoryList(categories: readonly Category[], lang: string) {
  return h(
    "ul",
    { class: CATEGORIES_CLASS, "aria-label": t(lang, "categories") },
    categories.map((category) =>
      h(
        "li",
        { class: `${CATEGORY_CLASS} ${CATEGORY_CLASS}-${category}` },
        categoryIcon(category),
        h("span", { class: CATEGORY_LABEL_CLASS }, t(lang, CATEGORY_KEYS[category])),
      ),
    ),
  );
}

/**
 * One release in a changelog: a version heading that links to itself, a machine-readable date, the categories
 * the release touches, and the entry text. The heading reads "Version 1.2.0" to assistive tech, and the section
 * carries the authored version as `data-version`. Missing version or date values render clear fallback text
 * instead of an empty heading or a bare "v". An empty body keeps the heading and shows a short "no details"
 * paragraph, so a stub entry is visibly a stub rather than an empty section. Repeated, slug-equivalent, and
 * unversioned entries still get unique ids, because the first entry to claim an id keeps it and the rest get a
 * numeric suffix in page order; an `id` prop overrides the version slug as the base. The returned section
 * vnode carries the allocated id, so a layout can point its contents at the exact fragment the section uses.
 */
export default function changelogEntry({
  props,
  page,
  html,
}: ComponentProps<ChangelogEntryProps>): ChangelogEntryNode {
  const lang = page.lang;
  const id = uniqueIdOf(page, givenIdOf(props.id) ?? idOf(props.version));
  const textId = versionTextId(id);
  const version = versionTextOf(props.version, lang);
  const authored = typeof props.version === "string" ? props.version.trim() : "";
  const categories = categoriesOf(props.categories);

  return h(
    "section",
    {
      class: SECTION_CLASS,
      id,
      ...(authored === "" ? {} : { "data-version": authored }),
      "aria-labelledby": textId,
    },
    h(
      "h2",
      { class: HEADING_CLASS, "aria-labelledby": textId },
      h(
        "span",
        { id: textId, class: VERSION_CLASS },
        authored === "" ? null : h("span", { class: SR_CLASS }, `${t(lang, "changelog_version")} `),
        version,
      ),
      h(
        "a",
        { class: ANCHOR_CLASS, href: `#${id}`, "aria-label": t(lang, "changelog_anchor", { version }) },
        anchorIcon(),
      ),
    ),
    h(
      "div",
      { class: META_CLASS },
      dateNode(props.date, lang),
      categories.length === 0 ? null : categoryList(categories, lang),
    ),
    h(
      "div",
      { class: BODY_CLASS },
      html === ""
        ? h("p", { class: EMPTY_CLASS }, t(lang, "changelog_empty"))
        : h("div", { dangerouslySetInnerHTML: { __html: html } }),
    ),
  ) as ChangelogEntryNode;
}
