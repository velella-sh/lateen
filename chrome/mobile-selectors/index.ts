import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ChromeProps, Direction } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { guidanceOf, languageEntries } from "../language-switcher/index.ts";
import { projectLinks } from "../project-switcher/index.ts";
import { versionsOf } from "../version-switcher/index.ts";

/** Class on the row that holds the mobile selectors. */
export const GROUP_CLASS = "mobile-selectors";

/** Class on one selector disclosure. */
export const SELECTOR_CLASS = "mobile-selector";

/** Class on the disclosure control. */
export const SUMMARY_CLASS = "mobile-selector-summary";

/** Class on the visible label inside the summary. */
export const LABEL_CLASS = "mobile-selector-label";

/** Class on the decorative disclosure marker. */
export const MARKER_CLASS = "mobile-selector-marker";

/** Class on a selector's list. */
export const LIST_CLASS = "mobile-selector-list";

/** Class on one selector's item. */
export const ITEM_CLASS = "mobile-selector-item";

/** Class on one option's link or unavailable text. */
export const LINK_CLASS = "mobile-selector-link";

/** Class added to the current option, beside {@link LINK_CLASS}. */
export const CURRENT_CLASS = "mobile-selector-current";

/** Class added to an option that has no page to open. */
export const UNAVAILABLE_CLASS = "mobile-selector-link--unavailable";

/** Class on the note beside an option, such as "Current" or a fallback language. */
export const NOTE_CLASS = "mobile-selector-note";

/** Extra classes for one selector, so a unit can keep its own hooks beside the shared ones. */
export interface SelectorClasses {
  readonly details?: string;
  readonly summary?: string;
  readonly list?: string;
  readonly item?: string;
  readonly link?: string;
  readonly current?: string;
}

/** One option in a mobile selector, made from the same data the desktop control reads. */
export interface MobileSelectorItem {
  /** The option's own name. */
  readonly text: string;
  /** Where the option goes; absent when the site has no page for it. */
  readonly href?: string;
  /** Whether this is the option being shown. */
  readonly current?: boolean;
  /** Whether the option leaves this site, so the link opens safely in a new tab. */
  readonly external?: boolean;
  /** The option's language, so a name is announced in its own language. */
  readonly lang?: string;
  /** The text direction of the option's name. */
  readonly dir?: Direction | "auto";
  /** A short visible note, such as the current mark or a fallback language. */
  readonly note?: string;
  /** The language of {@link note}. */
  readonly noteLang?: string;
  /** The direction of {@link note}. */
  readonly noteDir?: Direction | "auto";
  /** What a screen reader hears for an option that has no page. */
  readonly unavailable?: string;
}

/** Everything one mobile selector renders. */
export interface MobileSelectorOptions {
  /** Stable hook and data value, such as `projects`. */
  readonly key: string;
  /** The visible label and the control's accessible name. */
  readonly label: string;
  /** The real configured options, in the desktop control's order. */
  readonly items: readonly MobileSelectorItem[];
  /** Extra classes a unit keeps for its own markup. */
  readonly classes?: SelectorClasses;
  /** Extra attributes a unit keeps for its own markup. */
  readonly attrs?: Readonly<Record<string, string>>;
}

function withClass(base: string[], extra: string | undefined): string {
  return extra === undefined ? base.join(" ") : [...base, ...extra.split(/\s+/).filter(Boolean)].join(" ");
}

function option(item: MobileSelectorItem, classes: SelectorClasses | undefined) {
  const linkClasses = [LINK_CLASS, classes?.link].filter((value): value is string => value !== undefined);
  if (item.current === true) linkClasses.push(CURRENT_CLASS, ...(classes?.current === undefined ? [] : [classes.current]));
  if (item.href === undefined) linkClasses.push(UNAVAILABLE_CLASS);

  const name = h("bdi", { dir: item.dir ?? "auto" }, item.text);
  const note =
    item.note === undefined
      ? null
      : h("span", { class: NOTE_CLASS, lang: item.noteLang, dir: item.noteDir }, item.note);

  if (item.href === undefined) {
    return h(
      "span",
      { class: linkClasses.join(" "), lang: item.lang, "aria-disabled": "true" },
      name,
      note,
      item.unavailable === undefined
        ? null
        : h("span", { class: "sr-only", lang: item.noteLang, dir: item.noteDir }, item.unavailable),
    );
  }

  return h(
    "a",
    {
      class: linkClasses.join(" "),
      href: item.href,
      lang: item.lang,
      ...(item.external === true ? { rel: "noopener noreferrer", target: "_blank" } : {}),
      "aria-current": item.current === true ? "true" : undefined,
    },
    name,
    note,
  );
}

/**
 * One disclosure per selector on narrow screens: a native `<details>/<summary>` with the same label
 * treatment, target size, marker, and focus order as its neighbours. It works without JavaScript and
 * every option is an anchor (or plain text when the site has no page), never a guessed URL.
 */
export function mobileSelector({ key, label, items, classes, attrs }: MobileSelectorOptions) {
  return h(
    "details",
    {
      class: withClass([SELECTOR_CLASS], classes?.details),
      "data-mobile-selector": key,
      ...attrs,
    },
    h(
      "summary",
      { class: withClass([SUMMARY_CLASS], classes?.summary) },
      h("span", { class: LABEL_CLASS }, label),
      h("span", { class: MARKER_CLASS, "aria-hidden": "true" }, "▾"),
    ),
    h(
      "ul",
      { class: withClass([LIST_CLASS], classes?.list) },
      ...items.map((item) =>
        h("li", { class: withClass([ITEM_CLASS], classes?.item) }, option(item, classes)),
      ),
    ),
  );
}

/** The projects as the mobile selector, with the same current mark and order as the header. */
export function projectSelector(props: ChromeProps, classes?: SelectorClasses) {
  const projects = projectLinks(props.site);
  if (projects.length === 0) return null;
  return mobileSelector({
    key: "projects",
    label: t(props.page.lang, "projects"),
    items: projects.map((project) => ({
      text: project.title,
      href: project.url,
      current: project.current,
    })),
    ...(classes === undefined ? {} : { classes }),
  });
}

/** The languages as the mobile selector, with each entry's real page or unavailable state. */
export function languageSelector({ site, page }: ChromeProps) {
  const entries = languageEntries(site, page);
  if (entries.length < 2) return null;

  const guidance = guidanceOf(page);
  const currentLabel = t(guidance.lang, "language_current");
  const unavailable = t(guidance.lang, "translation_missing");

  return mobileSelector({
    key: "language",
    label: t(guidance.lang, "language"),
    items: entries.map((entry) => ({
      text: entry.language.name,
      lang: entry.language.code,
      current: entry.state === "current",
      ...(entry.href === undefined ? {} : { href: entry.href }),
      ...(entry.state === "current"
        ? { note: ` (${currentLabel})`, noteLang: guidance.lang, noteDir: guidance.dir }
        : entry.actual === undefined
          ? {}
          : { note: ` (${entry.actual.name})`, noteLang: entry.actual.code, noteDir: "auto" as const }),
      ...(entry.href === undefined ? { unavailable, noteLang: guidance.lang, noteDir: guidance.dir } : {}),
    })),
  });
}

/** The versions as the mobile selector, with the same current and version-home notes as the header. */
export function versionSelector({ site, page }: ChromeProps) {
  const versions = versionsOf(site, page);
  if (versions === undefined || versions.length < 2) return null;

  return mobileSelector({
    key: "versions",
    label: t(page.lang, "versions"),
    items: versions.map((version) => ({
      text: version.version,
      href: version.url,
      current: version.current,
      dir: "ltr" as const,
      ...(version.current
        ? { note: ` (${t(page.lang, "version_current")})`, noteLang: page.lang, noteDir: page.dir }
        : version.home
          ? { note: ` (${t(page.lang, "version_home")})`, noteLang: page.lang, noteDir: page.dir }
          : {}),
    })),
  });
}

/**
 * The mobile selector row: projects, then languages, then versions, in that focus order. A control
 * with fewer than two real options is left out, exactly as its desktop counterpart is. Returns null
 * when no selector has anything to show.
 */
export function mobileSelectors(
  props: ChromeProps,
  options: { readonly projects?: boolean } = {},
) {
  const children: ComponentChildren[] = [];
  if (options.projects !== false) {
    const projects = projectSelector(props);
    if (projects !== null) children.push(projects);
  }
  const languages = languageSelector(props);
  if (languages !== null) children.push(languages);
  const versions = versionSelector(props);
  if (versions !== null) children.push(versions);
  if (children.length === 0) return null;
  return h("div", { class: GROUP_CLASS, "data-mobile-selectors": "" }, ...children);
}
export default mobileSelectors;
