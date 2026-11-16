import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import embedCode, { type EmbedCodeProps } from "../components/embed-code/index.ts";
import { activate, type El, type Env, type Frame } from "../components/embed-code/client.ts";
import { html, pageWith, siteWith } from "./helpers-embed.ts";

function fake(attrs: Record<string, string | undefined> = {}, init: Partial<El> = {}): El & { listeners: Record<string, ((e?: never) => void)[]>; children: El[]; attrs: Record<string, string>; sel: Record<string, El[]> } {
  const el = {
    hidden: false, id: "", className: "", textContent: null, dataset: { ...attrs },
    listeners: {} as Record<string, ((e?: never) => void)[]>, children: [] as El[], attrs: {} as Record<string, string>, sel: {} as Record<string, El[]>,
    querySelector(s: string) { return this.sel[s]?.[0] ?? null; },
    querySelectorAll(s: string) { return this.sel[s] ?? []; },
    appendChild(c: El) { this.children.push(c); },
    removeChild() {}, setAttribute(n: string, v: string) { this.attrs[n] = v; },
    addEventListener(t: string, l: (e?: never) => void) { (this.listeners[t] ??= []).push(l); },
    ...init,
  };
  return el as never;
}

function build() {
  const v0 = fake({ embedVariant: "0", src: "https://e.com/light/", height: "300" });
  const v1 = fake({ embedVariant: "1", src: "https://e.com/dark/", height: "500" });
  const panels = ["frame", "html", "markdown"].map((id) => fake({ embedPanel: id }, { id: `p-${id}` }));
  for (const p of panels) p.sel["h3"] = [fake({}, { textContent: p.dataset.embedPanel ?? null })];
  const list = fake();
  const variants = fake();
  const select = fake({}, { value: "0" });
  const button = fake();
  const link = fake();
  const preview = fake({ title: "Guide" });
  preview.sel["[data-embed-preview-load]"] = [button];
  const root = fake({ sandbox: "allow-popups" });
  root.sel = {
    ".embed-code-tablist": [list], "[data-embed-panel]": panels, "[data-embed-variants]": [variants], "[data-embed-variant-select]": [select],
    "[data-embed-variant]": [v0, v1], "[data-embed-preview]": [preview], "[data-embed-preview-load]": [button], ".embed-code-preview-link": [link],
  };
  const env: Env = { createElement: () => fake(), createFrame: () => fake() as unknown as Frame };
  activate(root, env);
  return { root, v0, v1, panels, list, variants, select, button, link, preview };
}

test("the preview is not loaded until the reader asks", () => {
  const { preview, button } = build();
  assert.equal(preview.children.length, 0);
  assert.equal(button.hidden, false);
  button.listeners.click?.[0]?.();
  assert.equal(preview.children.length, 1);
  const frame = preview.children[0] as unknown as Frame;
  assert.equal(frame.src, "https://e.com/light/");
  assert.equal(frame.title, "Guide");
  assert.equal(frame.height, "300");
  assert.equal(button.hidden, true);
  button.listeners.click?.[0]?.();
  assert.equal(preview.children.length, 1);
});

test("each choice changes the shown code, the preview and the fallback link together", () => {
  const { v0, v1, select, button, preview, link } = build();
  button.listeners.click?.[0]?.();
  select.value = "1";
  select.listeners.change?.[0]?.();
  assert.equal(v0.hidden, true);
  assert.equal(v1.hidden, false);
  const frame = preview.children[0] as unknown as Frame;
  assert.equal(frame.src, "https://e.com/dark/");
  assert.equal(frame.height, "500");
  assert.equal(link.attrs.href, "https://e.com/dark/");
});

test("tabs show one panel at a time", () => {
  const { panels, list } = build();
  assert.equal(list.hidden, false);
  assert.deepEqual(panels.map((p) => p.hidden), [false, true, true]);
  const tab = list.children[1] as unknown as ReturnType<typeof fake>;
  tab.listeners.click?.[0]?.();
  assert.deepEqual(panels.map((p) => p.hidden), [true, false, true]);
});

test("without JavaScript the markup shows a link to the embedded page and a hidden load button", () => {
  const page = pageWith({ url: "/docs/" });
  const a = pageWith({ url: "/embed/a/", frontMatter: { embedded: { of: "/a/", scheme: "light" } } });
  const b = pageWith({ url: "/embed/b/", frontMatter: { embedded: { of: "/a/", scheme: "dark" } } });
  const out = html(embedCode({ props: { src: "/embed/a/" }, site: siteWith([page, a, b], { url: "https://e.com" }), page, html: "" } as unknown as ComponentProps<EmbedCodeProps>));
  assert.match(out, /<a class="embed-code-preview-link" href="https:\/\/e\.com\/embed\/a\/"/);
  assert.match(out, /<button type="button" class="embed-code-preview-load" hidden/);
  assert.match(out, /<select[^>]*>.*light, 360 px.*dark, 360 px/);
  assert.doesNotMatch(out, /<iframe /);
});
