import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, NetworkProject, Pager, Site, SiteNetwork, SourcePos, Trail } from "@velella/mizzen/contracts";
import projectSwitcher, { projectLinks } from "../chrome/project-switcher/index.ts";
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

function network(projects: readonly NetworkProject[], current = "alpha"): SiteNetwork {
  return { current, lock: "0".repeat(64), projects };
}

function props(networkValue?: SiteNetwork): ChromeProps {
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {}, ...(networkValue === undefined ? {} : { network: networkValue }) };
  return { site, page, trail, pager };
}

/** The rendered markup for a network; a missing network or a single project renders nothing at all. */
function render(networkValue?: SiteNetwork): string {
  const node = projectSwitcher(props(networkValue));
  return node === null ? "" : renderToString(node as never);
}

/** Count the non-overlapping matches of `pattern` in `text`. */
function count(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

test("renders three projects in network order, with the current one marked", () => {
  const value = network([project("alpha", "Alpha", true), project("beta", "Beta Docs"), project("gamma", "Gamma")]);
  const out = render(value);

  assert.match(out, /^<nav class="project-switcher" aria-label="Site navigation"><details class="project-switcher-details"[^>]*><summary class="project-switcher-summary">.*<ul class="project-switcher-list">/);
  assert.equal(count(out, /<li class="project-switcher-item">/g), 3);

  assert.match(out, /<a class="project-switcher-link project-switcher-current" href="\/alpha\/" aria-current="true"><bdi>Alpha<\/bdi><\/a>/);
  assert.match(out, /<a class="project-switcher-link" href="\/beta\/"><bdi>Beta Docs<\/bdi><\/a>/);
  assert.match(out, /<a class="project-switcher-link" href="\/gamma\/"><bdi>Gamma<\/bdi><\/a>/);

  assert.equal(count(out, /aria-current=/g), 1);
  assert.ok(out.indexOf("Alpha") < out.indexOf("Beta Docs"));
  assert.ok(out.indexOf("Beta Docs") < out.indexOf("Gamma"));

  assert.doesNotMatch(out, /<img|logo/);
  assert.equal(projectLinks(props(value).site).length, 3);
});

test("renders nothing when the network has one project", () => {
  assert.equal(render(network([project("alpha", "Alpha", true)])), "");
  assert.equal(projectSwitcher(props(network([project("alpha", "Alpha", true)]))), null);
  assert.deepEqual(projectLinks(props(network([project("alpha", "Alpha", true)])).site), []);
});

test("renders nothing when the site has no network", () => {
  assert.equal(render(), "");
  assert.equal(projectSwitcher(props()), null);
  assert.deepEqual(projectLinks(props().site), []);
});

test("marks only an absolute https project as external, keeping its address", () => {
  const value = network([
    project("alpha", "Alpha", true),
    { ...project("beta", "Beta"), path: "https://beta.example.com/" },
    { ...project("gamma", "Gamma"), path: "http://gamma.example.com" },
    { ...project("delta", "Delta"), path: "//delta.example.com" },
    { ...project("epsilon", "Epsilon"), path: "javascript:alert(1)" },
  ]);
  const out = render(value);

  assert.match(out, /<a class="project-switcher-link project-switcher-current" href="\/alpha\/" aria-current="true"><bdi>Alpha<\/bdi><\/a>/);
  assert.match(out, /<a class="project-switcher-link" href="https:\/\/beta\.example\.com\/" rel="noopener noreferrer" target="_blank"><bdi>Beta<\/bdi><\/a>/);
  assert.equal(count(out, /rel="noopener noreferrer"/g), 1);
  assert.equal(count(out, /target="_blank"/g), 1);
});

test("leaves a base path and unsafe schemes unmarked", () => {
  const value = network([
    project("alpha", "Alpha"),
    { ...project("beta", "Beta"), path: "http://beta.example.com" },
    { ...project("gamma", "Gamma"), path: "//gamma.example.com" },
  ]);
  const out = render(value);

  assert.match(out, /<a class="project-switcher-link" href="\/alpha\/"><bdi>Alpha<\/bdi><\/a>/);
  assert.match(out, /<a class="project-switcher-link" href="\/http:\/\/beta\.example\.com\/"><bdi>Beta<\/bdi><\/a>/);
  assert.match(out, /<a class="project-switcher-link" href="\/\/\/gamma\.example\.com\/"><bdi>Gamma<\/bdi><\/a>/);
  assert.doesNotMatch(out, /rel=|target=/);
});

test("takes every name and address from the network input", () => {
  const value = network([project("docs", "Handbook", true), project("notes", "Field Notes"), project("lab", "Workshop")], "docs");
  const out = render(value);

  assert.match(out, /href="\/docs\/"/);
  assert.match(out, /href="\/notes\/"/);
  assert.match(out, /href="\/lab\/"/);
  assert.match(out, /Handbook/);
  assert.match(out, /Field Notes/);
  assert.match(out, /Workshop/);
  assert.doesNotMatch(out, /https?:\/\//);
  assert.deepEqual(projectLinks(props(value).site), [
    { id: "docs", title: "Handbook", url: "/docs/", current: true },
    { id: "notes", title: "Field Notes", url: "/notes/", current: false },
    { id: "lab", title: "Workshop", url: "/lab/", current: false },
  ]);
});

