// Navigation ergonomics (#1234): one control row before the article, one layer in the drawer, unique
// landmark names, a quiet network, and a no-JS phone layout that stays navigable.
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, Site, SiteNetwork } from "@velella/mizzen/contracts";
import networkFooter from "../chrome/network-footer/index.ts";
import projectSwitcher from "../chrome/project-switcher/index.ts";
import searchScope from "../chrome/search-scope/index.ts";
import shell from "../chrome/shell/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import { pageTools } from "../layouts/shared/page-tools.ts";
import { readUiCss } from "./ui-css-helpers.ts";
import { pageWith } from "./helpers/page.ts";
import { siteConfig } from "./helpers/site.ts";

const ui = readUiCss();

function props(network?: SiteNetwork) {
  const page = pageWith({ url: "/guide/install/", title: "Install" });
  const nav = { main: [{ title: "Guide", children: [{ title: "Install", url: "/guide/install/" }] }] };
  const site: Site = { config: siteConfig(), pages: [page], nav, data: {}, collections: {}, ...(network === undefined ? {} : { network }) };
  return { site, page, trail: [], pager: {} } satisfies ChromeProps;
}

const network = (count: number): SiteNetwork => ({
  current: "p0",
  lock: "0".repeat(64),
  projects: Array.from({ length: count }, (_, index) => ({ id: `p${index}`, path: `p${index}`, title: `P${index}`, current: index === 0 })),
});

const render = (node: unknown): string => (node == null ? "" : renderToString(node as never));

/** The CSS rule bodies whose selector list mentions `selector`, from the compiled-order source. */
function ruleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}[^{}]*\\{([^}]*)\\}`).exec(ui)?.[1] ?? "";
}

test("page tools are one native disclosure that holds the actions", () => {
  const out = render(pageTools(props() as never, null));
  assert.equal(out.match(/<details class="doc-tools"/g)?.length, 1);
  assert.match(out, /<summary>/);
  assert.match(out, /class="article-tool-panel"/);
  assert.doesNotMatch(out, /<script/, "it needs no script to open");
});

test("the header menu button is a Lucide icon with the main nav name", () => {
  const out = render(shell(props()));
  const button = /<button[^>]*data-drawer-open[^>]*>.*?<\/button>/.exec(out)?.[0] ?? "";
  assert.match(button, /aria-label="Main"/);
  assert.match(button, /<svg/);
  assert.doesNotMatch(button, /☰/);
});

test("the project switcher is named apart from the site navigation", () => {
  const switcher = render(projectSwitcher(props(network(2))));
  const side = render(sidebar(props()));
  const label = (markup: string): string | undefined => /<nav[^>]*aria-label="([^"]+)"/.exec(markup)?.[1];
  assert.equal(label(switcher), "Project navigation");
  assert.notEqual(label(switcher), label(side));
});

test("a site without a network, or with one project, renders no network chrome", () => {
  for (const value of [undefined, network(1)]) {
    assert.equal(projectSwitcher(props(value)), null);
    assert.equal(networkFooter(props(value)), null);
    assert.equal(searchScope(props(value)), null);
  }
});

test("a network of two or more projects renders its chrome", () => {
  const value = network(2);
  assert.notEqual(projectSwitcher(props(value)), null);
  assert.notEqual(networkFooter(props(value)), null);
});

test("without JavaScript a phone keeps the sidebar above the article and never offers the drawer", () => {
  assert.match(ruleFor(".drawer:not([data-enhanced])"), /display:\s*none/);
  assert.match(ui, /:root:not\(\[data-js\]\)\s*\.sidebar-nav\s*\{[^}]*position:\s*static/);
  assert.match(ui, /:root\[data-js\]\s*\.sidebar\s*\{[^}]*display:\s*none/);
});
