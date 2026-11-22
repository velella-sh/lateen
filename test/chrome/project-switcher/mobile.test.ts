import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, NetworkProject, Pager, Site, SiteNetwork, SourcePos, Trail } from "@velella/mizzen/contracts";
import projectSwitcher, { projectLinks } from "../../../chrome/project-switcher/index.ts";
import { mobileProjects } from "../../../chrome/project-switcher/mobile.ts";
import { siteConfig } from "../../helpers/site.ts";
import { pageWith } from "../../helpers/page.ts";

const pos: SourcePos = { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = siteConfig({ title: "Alpha", base: "/alpha" });

const page = pageWith({ url: "/alpha/guide/install/", source: pos, frontMatter: { title: "Install" }, title: "Install" });

const trail: Trail = [];
const pager: Pager = {};

function project(id: string, title: string, current = false): NetworkProject {
  return { id, path: id, title, current };
}

function props(network?: SiteNetwork): ChromeProps {
  const site: Site = {
    config,
    pages: [page],
    nav: {},
    data: {},
    collections: {},
    ...(network === undefined ? {} : { network }),
  };
  return { site, page, trail, pager };
}

const three = (): SiteNetwork => ({
  current: "alpha",
  lock: "0".repeat(64),
  projects: [project("alpha", "Alpha", true), project("beta", "Beta Docs"), project("gamma", "Gamma")],
});

function render(network?: SiteNetwork): string {
  const node = mobileProjects(props(network));
  return node === null ? "" : renderToString(node as never);
}

/** The group as the drawer holds it: a closed or open `<dialog>` around the rendered markup. */
function drawer(open: boolean, network?: SiteNetwork): Document {
  const dialog = `<dialog class="drawer" data-drawer${open ? " open" : ""}>${render(network)}</dialog>`;
  return new JSDOM(`<body>${dialog}</body>`).window.document;
}

test("the group sits in the drawer, collapsed, and its links are out of the tab order while closed", () => {
  const doc = drawer(false, three());
  const dialog = doc.querySelector("dialog")!;
  const details = doc.querySelector<HTMLDetailsElement>("[data-project-switcher-mobile]")!;

  assert.equal(dialog.open, false);
  assert.equal(details.open, false);
  assert.equal(doc.querySelectorAll(".project-switcher-mobile-link").length, 3);
  for (const link of doc.querySelectorAll("a[href]")) {
    assert.equal(link.getAttribute("tabindex"), null);
    assert.equal(link.getAttribute("hidden"), null);
  }
  assert.equal(doc.querySelector("nav, h1, h2, h3, h4, h5, h6"), null);
});

test("opening the drawer and the group reveals the same projects in the header's order", () => {
  const doc = drawer(true, three());
  const dialog = doc.querySelector("dialog")!;
  const details = doc.querySelector<HTMLDetailsElement>("[data-project-switcher-mobile]")!;
  assert.equal(dialog.open, true);

  details.open = true;
  assert.equal(details.open, true);

  const mobile = [...doc.querySelectorAll(".project-switcher-mobile-link")].map((link) => link.getAttribute("href"));
  const header = projectLinks(props(three()).site).map((link) => link.url);
  assert.deepEqual(mobile, header);
  assert.deepEqual(mobile, ["/alpha/", "/beta/", "/gamma/"]);
  assert.equal(details.querySelector("summary")?.textContent?.trim(), "Projects▾");
});

test("the current project is marked once, and only in the group", () => {
  const doc = drawer(true, three());
  const current = doc.querySelectorAll(".project-switcher-mobile-link[aria-current='true']");
  assert.equal(current.length, 1);
  assert.equal(current[0]?.textContent, "Alpha");
  assert.equal(doc.querySelectorAll("[aria-current]").length, 1);
});

test("the group and the header switcher agree, because they read the same helper", () => {
  const value = three();
  assert.deepEqual(
    projectLinks(props(value).site).map((link) => [link.id, link.url, link.current]),
    [
      ["alpha", "/alpha/", true],
      ["beta", "/beta/", false],
      ["gamma", "/gamma/", false],
    ],
  );
  const header = renderToString(projectSwitcher(props(value)) as never);
  const headerHrefs = [...header.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const mobileHrefs = [...render(value).matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(mobileHrefs, headerHrefs);
});

test("an external project keeps its address and opens in a new tab, like the header", () => {
  const value = {
    current: "alpha",
    lock: "0".repeat(64),
    projects: [project("alpha", "Alpha", true), { ...project("beta", "Beta"), path: "https://beta.example.com/" }],
  };
  const doc = drawer(true, value);
  const links = doc.querySelectorAll(".project-switcher-mobile-link");

  assert.equal(links[0]?.getAttribute("href"), "/alpha/");
  assert.equal(links[0]?.getAttribute("rel"), null);
  assert.equal(links[0]?.getAttribute("target"), null);
  assert.equal(links[1]?.getAttribute("href"), "https://beta.example.com/");
  assert.equal(links[1]?.getAttribute("rel"), "noopener noreferrer");
  assert.equal(links[1]?.getAttribute("target"), "_blank");
});

test("renders nothing without a network or with one project", () => {
  assert.equal(render(), "");
  assert.equal(mobileProjects(props()), null);
  assert.equal(render({ current: "alpha", lock: "0".repeat(64), projects: [project("alpha", "Alpha", true)] }), "");
});
