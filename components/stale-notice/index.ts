import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Component, PageStale, PageStaleFile } from "@velella/mizzen/contracts";
import { TriangleAlert } from "lucide";
import { icon } from "../../src/icon.ts";
import { t } from "../../i18n/index.ts";
import { calendarDate } from "../../src/dates.ts";
import { optionOf } from "../../src/options.ts";

/**
 * The stale notice: a plain caution note above the article when a page's covered files changed since
 * its last review. It names the review date and the changed files, keeps the newest `maxFiles` in view
 * and puts the rest behind a native disclosure. `theme.options.stale.show` turns it off; a page
 * without `stale` renders nothing. It is page content, not an announcement: no alert or live region.
 */
export const OPTIONS = ["show", "maxFiles"] as const;

/** Class on the note. `styles/parts-stale-notice.css` styles it. */
export const CLASS = "stale-notice";

/** Class on the icon wrapper. */
export const ICON_CLASS = "stale-notice-icon";

/** Class on the review line. */
export const REVIEWED_CLASS = "stale-notice-reviewed";

/** Class on the file list. */
export const FILES_CLASS = "stale-notice-files";

/** Class on one changed file. */
export const FILE_CLASS = "stale-notice-file";

/** Class on the change word beside the path. */
export const CHANGE_CLASS = "stale-notice-change";

/** Class on the disclosure that holds the rest. */
export const MORE_CLASS = "stale-notice-more";

/** Class on the action row. */
export const ACTIONS_CLASS = "stale-notice-actions";

/** Class on an action link. */
export const ACTION_CLASS = "stale-notice-action";

/** The default number of changed files shown before the disclosure. */
export const DEFAULT_MAX_FILES = 5;

/** Props from the page: the files that changed since its review. */
export type StaleNoticeProps = {
  readonly stale?: PageStale;
  /** The page's edit link, from the site repository. */
  readonly editUrl?: string;
  /** An agent that takes a prompt, filled with the changed files. */
  readonly agentUrl?: string;
};

/** The change word of a file's change. */
const CHANGE_KEYS: Readonly<Record<PageStaleFile["change"], string>> = {
  changed: "stale_changed",
  removed: "stale_removed",
  added: "stale_added",
};

type SiteOptions = { config?: { theme?: { options?: Readonly<Record<string, unknown>> } } } | undefined;

function staleOptions(site: SiteOptions): { show: boolean; maxFiles: number } {
  const options = optionOf(site?.config?.theme?.options, "stale");
  if (typeof options !== "object" || options === null) return { show: true, maxFiles: DEFAULT_MAX_FILES };
  const { show, maxFiles } = options as { show?: unknown; maxFiles?: unknown };
  return {
    show: show !== false,
    maxFiles: typeof maxFiles === "number" && Number.isInteger(maxFiles) && maxFiles >= 1 ? maxFiles : DEFAULT_MAX_FILES,
  };
}

function fileNode(file: PageStaleFile, lang: string): ComponentChildren {
  return h(
    "li",
    { class: FILE_CLASS, "data-change": file.change },
    h("code", null, file.path),
    h("span", { class: CHANGE_CLASS }, t(lang, CHANGE_KEYS[file.change])),
  );
}

function listOf(files: readonly PageStaleFile[], lang: string): ComponentChildren {
  return h("ul", { class: FILES_CLASS }, files.map((file) => fileNode(file, lang)));
}

const staleNotice: Component<StaleNoticeProps> = ({ props, page, site }) => {
  const stale = props.stale;
  if (stale === undefined || stale.files.length === 0) return null;
  const { show, maxFiles } = staleOptions(site as never);
  if (!show) return null;

  const lang = page?.lang ?? "en";
  const head = stale.files.slice(0, maxFiles);
  const rest = stale.files.slice(maxFiles);
  const reviewed = stale.reviewed === undefined ? undefined : calendarDate(stale.reviewed, lang);

  return h(
    "aside",
    { class: CLASS, "aria-labelledby": `${CLASS}-title` },
    h(
      "h2",
      { id: `${CLASS}-title` },
      h("span", { class: ICON_CLASS, "aria-hidden": "true" }, icon({ node: TriangleAlert })),
      t(lang, "stale_title"),
    ),
    reviewed === undefined
      ? null
      : h(
          "p",
          { class: REVIEWED_CLASS },
          t(lang, "stale_reviewed", { date: reviewed.text }),
        ),
    h("p", null, t(lang, "stale_files")),
    listOf(head, lang),
    rest.length === 0
      ? null
      : h(
          "details",
          { class: MORE_CLASS },
          h("summary", null, t(lang, "stale_more", { count: rest.length })),
          listOf(rest, lang),
        ),
    props.editUrl === undefined && props.agentUrl === undefined
      ? null
      : h(
          "p",
          { class: ACTIONS_CLASS },
          props.editUrl === undefined
            ? null
            : h("a", { class: ACTION_CLASS, href: props.editUrl }, t(lang, "stale_update")),
          props.agentUrl === undefined
            ? null
            : h("a", { class: ACTION_CLASS, href: props.agentUrl, target: "_blank", rel: "noopener" }, t(lang, "stale_ask_agent")),
        ),
  );
};

export default staleNotice;
