import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Heading, Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import drawer from "../chrome/drawer/index.ts";
import header from "../chrome/header/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import { cardsView, groupsOf, titleFromBody } from "./list.ts";

/**
 * The records as a gallery: one responsive grid of the list layout's cards, in the engine's order,
 * inside a section per group when the list groups them. The cards keep the list's field rules, so a
 * record with no title, summary, or status still shows as the list's card view shows it, titled by id.
 */
function article(props: LayoutProps): ComponentChildren {
  const list = props.list;
  const groups = groupsOf(props);
  const grid: ComponentChildren =
    groups.length > 0
      ? groups.map((group) =>
          h(
            "section",
            { class: "gallery-group" },
            h("h2", { id: group.id }, group.key),
            cardsView(props, group.records),
          ),
        )
      : list === undefined
        ? null
        : cardsView(props, list.records);
  return h(
    "article",
    { class: "gallery", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, props.page.title),
    h("div", { class: "gallery-intro", dangerouslySetInnerHTML: { __html: props.page.html } }),
    grid,
  );
}

/** The page's own headings plus one `h2` per group, on a copy so the page itself stays untouched. */
function tocFor(props: LayoutProps): LayoutProps {
  const groups = groupsOf(props);
  if (groups.length === 0) return props;
  const headings: Heading[] = [
    ...props.page.headings,
    ...groups.map((group) => ({ depth: 2 as const, id: group.id, text: group.key, pos: props.page.source })),
  ];
  return { ...props, page: { ...props.page, headings } };
}

/**
 * The gallery page: the base shell and the article, with the navigation sidebar and any group
 * headings in the on-this-page list. A page that names this layout without list data renders its
 * title and body alone, like the list layout.
 */
const gallery: Layout = (props) =>
  base({
    ...props,
    header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
    sidebar: sidebar(props) as ComponentChildren,
    main: article(props),
    aside: toc(tocFor(props)) as ComponentChildren,
  });

export default gallery;
