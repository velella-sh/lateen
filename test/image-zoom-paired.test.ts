import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import figure, { type FigureProps } from "../components/figure/index.ts";
import { readUiCss } from "./ui-css-helpers.ts";

function render(props: FigureProps) {
  return renderToString(
    figure({ props, html: "", page: {} as ComponentProps["page"], site: {} as ComponentProps["site"] } as ComponentProps<FigureProps>) as never,
  );
}

const paired: FigureProps = { src: "/a-light.png", src_dark: "/a-dark.png", alt: "A chart", zoom: "true", href: "https://cdn.test/light-large.png" };

test("a paired figure zooms: one panel with a light and a dark full-size image and link", () => {
  const html = render(paired);
  assert.match(html, /<button type="button" class="figure-zoom" popovertarget="figure-zoom"[^>]*><div class="figure-pair" role="img" aria-label="A chart">/);
  assert.match(html, /class="figure-zoom-img figure-zoom-img-light" src="https:\/\/cdn\.test\/light-large\.png" alt="A chart" loading="lazy"/);
  assert.match(html, /class="figure-zoom-img figure-zoom-img-dark" src="\/a-dark\.png" alt="A chart" loading="lazy"/);
  assert.match(html, /class="figure-zoom-full figure-zoom-full-light" href="https:\/\/cdn\.test\/light-large\.png"/);
  assert.match(html, /class="figure-zoom-full figure-zoom-full-dark" href="\/a-dark\.png"/);
  assert.doesNotMatch(html, /<script/);
});

test("the full-size images are lazy, so the hidden scheme's image is not loaded before the panel opens", () => {
  const imgs = render(paired).match(/<img class="figure-zoom-img[^>]*>/g) ?? [];
  assert.equal(imgs.length, 2);
  for (const img of imgs) assert.match(img, /loading="lazy"/);
});

test("a figure without a distinct dark image keeps the single-image panel", () => {
  const html = render({ src: "/a.png", src_dark: "/a.png", alt: "A", zoom: "true" });
  assert.match(html, /class="figure-zoom-img" /);
  assert.doesNotMatch(html, /figure-zoom-img-dark/);
});

test("the styles pick the panel image by the active scheme, and by prefers-color-scheme without script", () => {
  const css = readUiCss();
  assert.match(css, /\.figure-zoom-img-dark,\s*\.figure-zoom-full-dark\s*\{\s*display:\s*none/);
  assert.match(css, /\[data-theme="dark"\] \.figure-zoom-img-light/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-js\]\) \.figure-zoom-img-light/);
});
