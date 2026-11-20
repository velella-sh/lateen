import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, NetworkProject, Pager, Site, SiteNetwork, SourcePos, Trail } from "@velella/mizzen/contracts";
import networkFooter from "../chrome/network-footer/index.ts";
import { projectLinks } from "../chrome/project-switcher/index.ts";
import { siteConfig } from "./helpers/site.ts";
import { pageWith } from "./helpers/page.ts";

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

function render(network?: SiteNetwork): string {
  const node = networkFooter(props(network));
  return node === null ? "" : renderToString(node as never);
}

const three = (): SiteNetwork => ({
  current: "alpha",
  lock: "0".repeat(64),
  projects: [project("alpha", "Alpha", true), project("beta", "Beta Docs"), project("gamma", "Gamma")],
});

test("renders the network's projects as a labelled footer list", () => {
  const out = render(three());
  assert.match(out, /^<div class="network-footer"><p class="network-footer-label">Projects<\/p><ul class="network-footer-list">/);
  assert.equal([...out.matchAll(/<li class="network-footer-item">/g)].length, 3);
  assert.match(out, /<a class="network-footer-link network-footer-current" href="\/alpha\/" aria-current="true"><bdi>Alpha<\/bdi><\/a>/);
  assert.match(out, /<a class="network-footer-link" href="\/beta\/"><bdi>Beta Docs<\/bdi><\/a>/);
  assert.match(out, /<a class="network-footer-link" href="\/gamma\/"><bdi>Gamma<\/bdi><\/a>/);
  assert.doesNotMatch(out, /https?:\/\/|utm_|\?from=/);
});

test("the footer list and the header switcher read the same helper, in the same order", () => {
  const value = three();
  const links = projectLinks(props(value).site);
  assert.deepEqual(
    links.map((link) => [link.title, link.url, link.current]),
    [
      ["Alpha", "/alpha/", true],
      ["Beta Docs", "/beta/", false],
      ["Gamma", "/gamma/", false],
    ],
  );

  const out = render(value);
  const positions = links.map((link) => out.indexOf(`href="${link.url}"`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test("renders nothing without a network or with one project", () => {
  assert.equal(render(), "");
  assert.equal(networkFooter(props()), null);
  assert.equal(render({ current: "alpha", lock: "0".repeat(64), projects: [project("alpha", "Alpha", true)] }), "");
});

