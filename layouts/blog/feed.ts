import type { Head, LayoutProps } from "@velella/mizzen/contracts";
import { Rss } from "lucide";
import { h } from "preact";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";
import { safeHref, WEB_PROTOCOLS } from "../../src/url.ts";
import { blogKindOf, postsOf } from "./index.ts";

const ATOM = "application/atom+xml";

/** Mizzen writes the feed beside a nonempty archive when the blog and that output are enabled. */
export function blogFeedHref({ page, site }: LayoutProps): string | undefined {
  const kind = blogKindOf(page);
  if (kind !== "archive" && kind !== "post") return undefined;
  const { blog, outputs, url } = site.config;
  if (blog === undefined || blog.feed === false || outputs["blog-feed"] === false) return undefined;
  const origin = url === undefined ? null : URL.parse(url);
  if (origin === null || !WEB_PROTOCOLS.some((scheme) => scheme === origin.protocol)) return undefined;

  const archive = kind === "archive" ? page : site.pages.find((entry) => blogKindOf(entry) === "archive");
  if (archive === undefined || postsOf(archive).length === 0) return undefined;
  return safeHref(archive.url.replace(/[^/]+\/$/, "") + "feed.xml");
}

export function withBlogFeed(head: Head, href: string | undefined, siteUrl: string | undefined): Head {
  if (href === undefined) return head;
  const feedUrl = URL.parse(href, siteUrl)?.href;
  const exists = head.links.some((link) =>
    link.rel === "alternate" && link.attrs?.type === ATOM &&
    (link.href === href || (feedUrl !== undefined && URL.parse(link.href, siteUrl)?.href === feedUrl)),
  );
  return exists ? head : { ...head, links: [...head.links, { rel: "alternate", href, attrs: { type: ATOM } }] };
}

export function blogSubscribe(href: string, lang: string) {
  return h(
    "a",
    { class: "list-feed-link", href, type: ATOM },
    h("span", { class: "list-feed-icon", "aria-hidden": "true" }, icon({ node: Rss })),
    t(lang, "dated_list_feed"),
  );
}
