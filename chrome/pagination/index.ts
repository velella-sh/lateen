import { h } from "preact";
import type { LinkTag, ListPagination } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

/** Props of the pagination chrome: the page being rendered and where the list sits in its pages. */
export interface PaginationProps {
  /** URL of the page being rendered. */
  readonly url: string;
  /** The page's language, for its labels. */
  readonly lang: string;
  /** The page number, the page count, and the neighbouring page URLs the engine built. */
  readonly pagination: ListPagination;
}

/** Arrow pointing toward the page it leads to; `style.css` mirrors it under `dir="rtl"`. */
function arrow(kind: "prev" | "next") {
  const d = kind === "prev" ? "M11 6l-6 6 6 6M5 12h14" : "M13 6l6 6-6 6M19 12H5";
  return h(
    "svg",
    { class: "pagination-arrow", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
    h("path", { d }),
  );
}

/** The list's first page URL: the current URL without the engine's `page/<n>/` suffix. */
function firstPageOf(url: string): string {
  return url.replace(/page\/\d+\/$/, "");
}

/* shortcut: numbered URLs follow the engine's `page/<n>/` shape; revisit when the pagination carries page URLs. */
/** Page `n`'s URL, in the shape the engine writes (`page/<n>/` below page one). */
function urlOfPage(first: string, n: number): string {
  if (n === 1) return first;
  return `${first.endsWith("/") ? first : `${first}/`}page/${n}/`;
}

/**
 * Page numbers to show, with `null` for a gap. A short list shows every page; a long one keeps the
 * first and last pages and the current page with its neighbours, and a gap replaces the run between.
 */
function pageSlots(page: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const shown = new Set([1, total]);
  for (let n = page - 1; n <= page + 1; n += 1) {
    if (n >= 1 && n <= total) shown.add(n);
  }
  const numbers = [...shown].sort((a, b) => a - b);
  const slots: Array<number | null> = [];
  for (const n of numbers) {
    const previous = slots.at(-1);
    if (typeof previous === "number" && n - previous > 1) slots.push(null);
    slots.push(n);
  }
  return slots;
}

/** The head's `rel=prev` and `rel=next` links for a paginated list, in reading order. */
export function paginationLinks(pagination: ListPagination): LinkTag[] {
  const links: LinkTag[] = [];
  if (pagination.previous !== undefined) links.push({ rel: "prev", href: pagination.previous });
  if (pagination.next !== undefined) links.push({ rel: "next", href: pagination.next });
  return links;
}

/**
 * A list's pages: previous and next beside the numbered pages, inside one labelled navigation.
 * Renders nothing when the list has one page.
 */
export default function pagination({ url, lang, pagination: { page, total, previous, next } }: PaginationProps) {
  if (total <= 1) return null;

  const first = firstPageOf(url);
  return h(
    "nav",
    { class: "pagination", "aria-label": t(lang, "pagination") },
    previous === undefined
      ? null
      : h(
          "a",
          { class: "pagination-link pagination-prev", href: previous, rel: "prev" },
          h("span", { class: "pagination-direction" }, arrow("prev"), t(lang, "previous")),
        ),
    h(
      "span",
      { class: "pagination-pages" },
      ...pageSlots(page, total).map((n) =>
        n === null
          ? h("span", { class: "pagination-gap", "aria-hidden": "true" }, "…")
          : h(
              "a",
              {
                class: "pagination-link pagination-page",
                href: urlOfPage(first, n),
                "aria-label": t(lang, "pagination_page", { n }),
                ...(n === page ? { "aria-current": "page" } : {}),
              },
              String(n),
            ),
      ),
    ),
    next === undefined
      ? null
      : h(
          "a",
          { class: "pagination-link pagination-next", href: next, rel: "next" },
          h("span", { class: "pagination-direction" }, t(lang, "next"), arrow("next")),
        ),
  );
}
