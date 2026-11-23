import { h, type ComponentChildren } from "preact";
import type { Chrome, NavGroup, NavItem, NavLink, NavTree, Site } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { resolveNavigationOptions } from "../../src/options.ts";

/** A group with more pages under it than this renders as one link, not every child. */
const MAX_LISTED = 20;

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

/** Compares by code point, never by locale. */
function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The list the sidebar shows: `main`, else `docs`, else the first list by code point. */
function listOf(nav: NavTree): readonly NavItem[] {
  for (const name of ["main", "docs"]) {
    const items = nav[name];
    if (items !== undefined) return items;
  }
  const names = Object.keys(nav).sort(byCodePoint);
  return names.length > 0 ? (nav[names[0]!] ?? []) : [];
}

/** True when `url` is under `prefix`, observing path-segment boundaries (the same rule as the engine's `navState`). */
function under(url: string, prefix: string): boolean {
  if (!url.startsWith(prefix)) return false;
  if (prefix.endsWith("/")) return true;
  const boundary = url.charAt(prefix.length);
  return boundary === "" || boundary === "/";
}

/** Every link in a subtree, in reading order. */
function leaves(items: readonly NavItem[]): NavLink[] {
  const out: NavLink[] = [];
  for (const item of items) {
    if (isGroup(item)) out.push(...leaves(item.children));
    else out.push(item);
  }
  return out;
}

/** True when the subtree marks itself on `url`: it holds the page, or a section whose `match` covers it. */
function marks(item: NavItem, url: string): boolean {
  if (isGroup(item)) return item.children.some((child) => marks(child, url));
  if (item.url === url) return true;
  return item.match !== undefined && under(url, item.match);
}

/** The folder a page URL lives in, with the site base kept on the root page. */
function parentUrl(url: string, base: string): string {
  const trimmed = url.endsWith("/") ? url.slice(0, -1) : url;
  const cut = trimmed.lastIndexOf("/");
  const parent = cut <= 0 ? "/" : trimmed.slice(0, cut + 1);
  return parent === "/" && base !== "" ? `${base}/` : parent;
}

/** True when no nested group also holds `url`, so only the closest branch gets the sibling list. */
function ownsCurrent(group: NavGroup, url: string): boolean {
  return marks(group, url) && !group.children.some((child) => isGroup(child) && marks(child, url));
}

/**
 * Pages in the current page's folder that its group's navigation does not already list. Titles and
 * URLs come from the engine's page list, whose URLs already carry the site base.
 */
function siblingPages(site: Site, group: NavGroup, url: string): NavLink[] {
  const seen = new Set([...leaves(group.children).map((link) => link.url), url]);
  const folder = parentUrl(url, site.config.base);
  const siblings: NavLink[] = [];
  for (const page of site.pages) {
    if (seen.has(page.url) || parentUrl(page.url, site.config.base) !== folder) continue;
    seen.add(page.url);
    siblings.push({ title: page.title, url: page.url });
  }
  return siblings;
}

/**
 * FNV-1a over the group's structural path, depth, and descendant urls: a stable, bounded identity
 * that survives retitling and translation while keeping two different groups with the same urls apart.
 */
function groupId(pages: readonly NavLink[], depth: number, path: string): string {
  const urls = `${path}\n${depth}\n${[...new Set(pages.map((page) => page.url))].sort(byCodePoint).join("\n")}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < urls.length; i += 1) {
    hash ^= urls.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `g${hash.toString(36)}`;
}

/** Longest shared prefix of site-local urls, cut back to a `/`: the `match` of a collapsed section. */
function sectionPrefix(urls: readonly string[]): string | undefined {
  if (urls.length === 0 || !urls.every((url) => url.startsWith("/"))) return undefined;
  let prefix = urls[0]!;
  for (const url of urls) {
    while (!url.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  const cut = prefix.lastIndexOf("/");
  return cut > 0 ? prefix.slice(0, cut + 1) : undefined;
}

/** `aria-current` of a link: `page` when it is the page, `true` when its section covers the page. */
function currentOf(link: NavLink, url: string): "page" | "true" | undefined {
  if (link.url === url) return "page";
  if (link.match !== undefined && under(url, link.match)) return "true";
  return undefined;
}

function linkNode(link: NavLink, url: string) {
  const current = currentOf(link, url);
  return h(
    "a",
    { href: link.url, ...(current === undefined ? {} : { "aria-current": current }) },
    link.title,
  );
}

/** A large section: one link to its first page, active on any page under the shared prefix. */
function collapsedNode(group: NavGroup, pages: readonly NavLink[], url: string) {
  const first = pages[0]!;
  const prefix = sectionPrefix(pages.map((page) => page.url));
  const current =
    url === first.url ? "page" : prefix !== undefined && under(url, prefix) ? "true" : undefined;
  return h(
    "a",
    { href: first.url, ...(current === undefined ? {} : { "aria-current": current }) },
    group.title,
  );
}

/**
 * A group as a native `<details>`, so it opens and closes without JavaScript. The group that holds the
 * page is open; the others start closed. `data-sidebar-group` is the stable key the client remembers the
 * state under; `data-sidebar-legacy` is the title-based key older versions used, read once for migration.
 * With `theme.options.navigation.siblings`, the group closest to the page also lists pages from its
 * folder that the navigation omits, leaving every existing link where it was.
 */
function groupNode(
  group: NavGroup,
  key: string,
  legacy: string,
  url: string,
  depth: number,
  site: Site,
  path: string,
) {
  const current = marks(group, url);
  const siblings =
    current &&
    ownsCurrent(group, url) &&
    resolveNavigationOptions(site.config.theme.options).siblings
      ? siblingPages(site, group, url)
      : [];
  return h(
    "details",
    {
      class: "sidebar-group",
      "data-sidebar-group": key,
      "data-sidebar-legacy": legacy,
      "data-sidebar-site": site.config.base,
      ...(current ? { "data-current": "true", open: true } : {}),
    },
    h(
      "summary",
      null,
      h(`h${Math.min(depth, 6)}`, current ? { "aria-current": "true" } : {}, group.title),
    ),
    h("ul", null, entries(group.children, url, depth + 1, legacy, site, path)),
    siblings.length === 0
      ? null
      : h(
          "ul",
          { class: "sidebar-siblings" },
          siblings.map((link) => h("li", null, linkNode(link, url))),
        ),
  );
}

/** The `<li>` entries of one list: links, and small groups nested as a disclosure with their own list. */
function entries(
  items: readonly NavItem[],
  url: string,
  depth: number,
  parentLegacy: string | undefined,
  site: Site,
  parentPath: string,
): ComponentChildren[] {
  const nodes = [];
  for (const [index, item] of items.entries()) {
    if (!isGroup(item)) {
      nodes.push(h("li", null, linkNode(item, url)));
      continue;
    }
    const pages = leaves(item.children);
    if (pages.length === 0) continue;
    if (pages.length > MAX_LISTED) {
      nodes.push(h("li", null, collapsedNode(item, pages, url)));
      continue;
    }
    const legacy = parentLegacy === undefined ? item.title : `${parentLegacy}/${item.title}`;
    const path = `${parentPath}/${index}`;
    nodes.push(h("li", null, groupNode(item, groupId(pages, depth, path), legacy, url, depth, site, path)));
  }
  return nodes;
}

/** The blocks of the top level: the leading links first, then each group as a disclosure with its list. */
function blocks(items: readonly NavItem[], url: string, site: Site): ComponentChildren[] {
  const out = [];
  let leading = [];
  for (const [index, item] of items.entries()) {
    if (!isGroup(item)) {
      leading.push(h("li", null, linkNode(item, url)));
      continue;
    }
    const pages = leaves(item.children);
    if (pages.length === 0) continue;
    if (leading.length > 0) {
      out.push(h("ul", null, leading));
      leading = [];
    }
    if (pages.length > MAX_LISTED) {
      out.push(h("ul", null, h("li", null, collapsedNode(item, pages, url))));
      continue;
    }
    const path = `${index}`;
    out.push(groupNode(item, groupId(pages, 2, path), item.title, url, 2, site, path));
  }
  if (leading.length > 0) out.push(h("ul", null, leading));
  return out;
}

/** Every link under a group at any depth, in reading order, with the title of each nested group as a plain label. */
function flatEntries(items: readonly NavItem[], url: string): ComponentChildren[] {
  const nodes: ComponentChildren[] = [];
  for (const item of items) {
    if (!isGroup(item)) {
      nodes.push(h("li", null, linkNode(item, url)));
      continue;
    }
    const pages = leaves(item.children);
    if (pages.length === 0) continue;
    if (pages.length > MAX_LISTED) {
      nodes.push(h("li", null, collapsedNode(item, pages, url)));
      continue;
    }
    nodes.push(h("li", { class: "sidebar-label" }, h("span", null, item.title)));
    nodes.push(...flatEntries(item.children, url));
  }
  return nodes;
}

/**
 * The same navigation on one layer, for the mobile menu: each top-level group is a heading over one
 * list, groups nested inside it are flattened into that list under their own plain label, and nothing
 * opens or closes. It reads the same tree and builds its links with the same functions as the column.
 */
function flatBlocks(items: readonly NavItem[], url: string): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  let leading: ComponentChildren[] = [];
  for (const item of items) {
    if (!isGroup(item)) {
      leading.push(h("li", null, linkNode(item, url)));
      continue;
    }
    const pages = leaves(item.children);
    if (pages.length === 0) continue;
    if (leading.length > 0) {
      out.push(h("ul", null, leading));
      leading = [];
    }
    if (pages.length > MAX_LISTED) {
      out.push(h("ul", null, h("li", null, collapsedNode(item, pages, url))));
      continue;
    }
    out.push(
      h(
        "section",
        { class: "sidebar-section" },
        h("h2", marks(item, url) ? { "aria-current": "true" } : {}, item.title),
        h("ul", null, flatEntries(item.children, url)),
      ),
    );
  }
  if (leading.length > 0) out.push(h("ul", null, leading));
  return out;
}

/**
 * The navigation landmark: groups and links from the navigation tree, the current page and active
 * section marked. `flat` is the mobile menu's one-layer form of the same tree.
 */
export function sidebarNav({ site, page }: Parameters<Chrome>[0], options: { readonly flat?: boolean } = {}) {
  const items = listOf(site.nav);
  if (items.length === 0) return null;

  return h(
    "nav",
    { class: options.flat === true ? "sidebar-nav sidebar-nav-flat" : "sidebar-nav", "aria-label": t(page.lang, "site_navigation") },
    options.flat === true ? flatBlocks(items, page.url) : blocks(items, page.url, site),
  );
}

/** The left column: the navigation tree as disclosure groups. */
const sidebar: Chrome = (props) => sidebarNav(props);

export default sidebar;
