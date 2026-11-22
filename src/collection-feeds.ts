import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { FeedFormat, LayoutProps } from "@velella/mizzen/contracts";
import {
  SUBSCRIBE_CLASS,
  SUBSCRIBE_HEADING_CLASS,
  SUBSCRIBE_ITEM_CLASS,
  SUBSCRIBE_LINK_CLASS,
  SUBSCRIBE_LIST_CLASS,
} from "../components/add-to-calendar/index.ts";
import { t } from "../i18n/index.ts";
import { safeHref, withBase } from "./url.ts";

const FORMATS = {
  atom: { suffix: "xml", type: "application/atom+xml", label: "collection_feed_atom" },
  rss: { suffix: "rss.xml", type: "application/rss+xml", label: "collection_feed_rss" },
  json: { suffix: "json", type: "application/feed+json", label: "collection_feed_json" },
} satisfies Readonly<Record<FeedFormat, { suffix: string; type: string; label: string }>>;

/** Offer the collection feeds the engine advertised, preserving head order and published URLs. */
export function collectionFeeds({ page, site, head, record, list }: LayoutProps): ComponentChildren {
  const collection = record?.collection ?? list?.collection;
  const origin = URL.parse(site.config.url ?? "")?.origin;
  if (collection === undefined || origin === undefined) return null;
  const feeds = new Map<string, { format: (typeof FORMATS)[FeedFormat]; title: string }>();
  for (const [name, feed] of Object.entries(site.config.feeds ?? {})) {
    if (feed.collection !== collection) continue;
    for (const key of feed.formats ?? ["atom"]) {
      const format = FORMATS[key];
      const href = `${origin}${withBase(site.config.base, `/feeds/${name}.${format.suffix}`)}`;
      feeds.set(href, { format, title: feed.title ?? site.config.title });
    }
  }

  const { lang } = page;
  const links = head.links.flatMap((link) => {
    const href = safeHref(link.href);
    if (href === undefined || link.rel !== "alternate") return [];
    const feed = feeds.get(href);
    if (feed === undefined || link.attrs?.type !== feed.format.type) return [];
    const label = t(lang, "collection_feed_choice", {
      title: link.attrs.title ?? feed.title,
      format: t(lang, feed.format.label),
    });
    return [h(
      "li",
      { class: SUBSCRIBE_ITEM_CLASS },
      h("a", { class: SUBSCRIBE_LINK_CLASS, href, type: feed.format.type }, label),
    )];
  });
  if (links.length === 0) return null;

  return h(
    "details",
    { class: `details ${SUBSCRIBE_CLASS}` },
    h("summary", { class: SUBSCRIBE_HEADING_CLASS }, t(lang, "collection_feed_subscribe")),
    h("ul", { class: SUBSCRIBE_LIST_CLASS }, links),
  );
}
