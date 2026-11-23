import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import { bundledLanguages } from "shiki/langs";
import type { ComponentProps } from "@velella/mizzen/contracts";
import code, { blockId, DEFAULT_LANGUAGES, buildTheme, highlightFences, loadGrammars, loadedLanguages, sourceText } from "../components/code/index.ts";

function render(props: Record<string, string>, html: string): string {
  const input = { props, html, page: {}, site: {} } as unknown as ComponentProps<never>;
  return renderToString(code(input as never) as never);
}

const css = "" /* lateen-legacy removed: styles/parts-code.css */;
const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<string, Record<string, unknown>>;
const tokenNames = new Set(Object.entries(names).flatMap(([g, e]) => Object.keys(e).map((n) => `${g}-${n}`)));

/** WCAG 2.2 relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.2 contrast ratio between two `#rrggbb` colors. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

test("sourceText strips tags and decodes entities", () => {
  assert.equal(sourceText('<pre><code class="language-ts">a &lt; b &amp;&amp; c\n</code></pre>'), "a < b && c");
});

test("loads the default grammars with the module, and others only when asked", async () => {
  for (const lang of DEFAULT_LANGUAGES) assert.ok(loadedLanguages().includes(lang), lang);
  assert.ok(!loadedLanguages().includes("python"));
  await loadGrammars(["python", "nope"]);
  assert.ok(loadedLanguages().includes("python"));
  assert.ok(!loadedLanguages().includes("rust"));
});

/** A promise a test settles by hand, to hold an import open while it checks what else has started. */
function gate(): { promise: Promise<void>; open: () => void } {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

test("overlapping callers import each grammar once, and distinct grammars import concurrently", async () => {
  const rustGate = gate();
  const goGate = gate();
  const calls: string[] = [];
  const loaders = {
    rust: async () => {
      calls.push("rust");
      await rustGate.promise;
      return bundledLanguages.rust();
    },
    go: async () => {
      calls.push("go");
      await goGate.promise;
      return bundledLanguages.go();
    },
  };
  const first = loadGrammars(["rust", "go"], loaders);
  const second = loadGrammars(["go", "rust", "rust"], loaders);
  // Both imports started before either was allowed to finish: no serial chain, no second import.
  assert.deepEqual(calls, ["rust", "go"]);
  goGate.open(); // Settles out of request order; registration still follows the request.
  rustGate.open();
  await Promise.all([first, second]);
  assert.deepEqual(calls, ["rust", "go"]);
  const loaded = loadedLanguages();
  assert.ok(loaded.includes("rust"));
  assert.ok(loaded.includes("go"));
  assert.ok(loaded.indexOf("rust") < loaded.indexOf("go"));
});

test("a failed grammar rejects, leaves the others loaded, and is retried on the next call", async () => {
  let rubyLoads = 0;
  let luaLoads = 0;
  let offline = true;
  const loaders = {
    ruby: async () => {
      rubyLoads += 1;
      if (offline) throw new Error("ruby grammar unavailable");
      return bundledLanguages.ruby();
    },
    lua: async () => {
      luaLoads += 1;
      return bundledLanguages.lua();
    },
  };
  await assert.rejects(loadGrammars(["ruby", "lua"], loaders), /ruby grammar unavailable/);
  assert.equal(rubyLoads, 1);
  assert.ok(!loadedLanguages().includes("ruby"));
  assert.ok(loadedLanguages().includes("lua"));
  offline = false;
  await loadGrammars(["ruby", "lua"], loaders);
  assert.equal(rubyLoads, 2);
  assert.equal(luaLoads, 1);
  assert.ok(loadedLanguages().includes("ruby"));
});

test("an alias and its canonical name share one import and highlight identically", async () => {
  let loads = 0;
  const loader = async () => {
    loads += 1;
    return bundledLanguages.kotlin();
  };
  // `kt` is a bundled alias of `kotlin`, so both names use the same loader.
  await loadGrammars(["kt", "kotlin"], { kt: loader, kotlin: loader });
  assert.equal(loads, 1);
  assert.ok(loadedLanguages().includes("kt"));
  assert.ok(loadedLanguages().includes("kotlin"));
  const inner = (lang: string) => /<code[^>]*>([\s\S]*)<\/code>/.exec(render({ lang }, "val answer = 42"))?.[1];
  assert.match(inner("kt") ?? "", /--shiki-light:#/);
  assert.equal(inner("kt"), inner("kotlin"));
});

test("the browser island never imports the highlighter", () => {
  const client = readFileSync(new URL("../chrome/code-copy/client.ts", import.meta.url), "utf8");
  assert.doesNotMatch(client, /\bfrom\s+"shiki|import\(\s*"shiki/);
});

test("sourceText decodes numeric entities as well as named ones", () => {
  assert.equal(sourceText("Record&#x3C;string, string&#62; &amp; x"), "Record<string, string> & x");
  assert.equal(sourceText("a&#x110000;b&#99999999;c"), "a&#x110000;b&#99999999;c");
});

test("sourceText drops tags until none is left, and its text is escaped again when highlighted", () => {
  assert.equal(sourceText('<span class="line"><span>a</span> <span>b</span></span>'), "a b");
  assert.doesNotMatch(sourceText("<scr<b>ipt>alert(1)</scr</b>ipt>"), /<[^>]*>/);
  const out = highlightFences("<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;\n</code></pre>");
  assert.doesNotMatch(out, /<script/);
});

test("both code renderers produce the same tokens when the build clock advances during highlighting", ({ mock }) => {
  const source = "const ready = true;";
  const fence = `<pre><code class="language-ts">${source}</code></pre>`;
  const directive = render({ lang: "ts" }, source);
  const plain = highlightFences(fence);

  let time = 0;
  mock.method(Date, "now", () => (time += 1000));

  assert.equal(render({ lang: "ts" }, source), directive);
  assert.equal(highlightFences(fence), plain);
});

test("highlightFences highlights a plain fence, keeps data-src, and gives it a stable id", () => {
  const out = highlightFences('<p>a</p><pre data-src="a.md:3:1-5:3"><code class="language-sh">npm test\n</code></pre>');
  assert.match(out, /^<p>a<\/p><pre class="code" tabindex="0" id="code-a-md-3-1-5-3" role="group" aria-label="Code: sh" data-lang="sh" data-src="a\.md:3:1-5:3"><code>/);
  assert.match(out, /--shiki-dark:#/);
  const plain = highlightFences("<pre><code>a &lt; b\n</code></pre>");
  assert.match(plain, /<pre class="code" tabindex="0" role="group" aria-label="Code" data-lang="text"><code>/);
  assert.match(plain, /a &#x3C; b|a &lt; b/);
  const diagram = '<pre><code class="language-mermaid">graph TD\n</code></pre>';
  assert.equal(highlightFences(diagram), diagram);
});

test("highlightFences preserves the terminal rows used by its copy control", () => {
  const session = '<pre class="terminal-body" tabindex="0"><code><span class="terminal-command"><span class="terminal-text">npm install</span></span><span class="terminal-output">added 1 package</span></code></pre>';
  assert.equal(highlightFences(session), session);
});

/** `data-code` as rehype writes it: the JSON's quotes and ampersands escaped for the attribute, `>` left alone. */
function dataCode(meta: Record<string, unknown>): string {
  return JSON.stringify(meta).replace(/&/g, "&amp;").replace(/"/g, "&#x22;");
}

test("highlightFences reads data-code after data-src: title, highlight, numbers, and diff marks", () => {
  const meta = dataCode({
    raw: "",
    title: "src/a > b.ts",
    highlight: [{ from: 2, to: 2 }],
    ins: [{ from: 1, to: 1 }],
    del: [{ from: 3, to: 3 }],
    diff: false,
    showLineNumbers: true,
    annotations: [],
  });
  const fence = `<pre data-src="a.md:3" data-code="${meta}"><code class="language-ts">const a = 1;\nconst b = 2;\nconst c = 3;\n</code></pre>`;
  const out = highlightFences(fence);
  assert.match(out, /^<div class="code-title">.*<span class="code-title-name" id="code-a-md-3-title">src\/a > b\.ts<\/span><\/div><pre /);
  assert.match(out, /<pre class="code" tabindex="0" id="code-a-md-3" role="group" aria-labelledby="code-a-md-3-title" data-lang="ts" data-src="a.md:3" data-code="/);
  assert.doesNotMatch(out, /<code>[^<]*src\/a > b/);
  assert.match(out, /<span class="line ins" id="code-a-md-3-L1" data-line="1">/);
  assert.match(out, /<span class="line highlighted" id="code-a-md-3-L2" data-line="2">/);
  assert.match(out, /<span class="line del" id="code-a-md-3-L3" data-line="3">/);
  assert.doesNotMatch(out, /<pre[^>]*><code[^>]*>[^<]*const/);
});

test("a diff fence in data-code strips its marker characters and still marks its ranges", () => {
  const meta = dataCode({ raw: "", title: null, highlight: [], ins: [], del: [], diff: true, showLineNumbers: false, annotations: [] });
  const fence = `<pre data-src="a.md:3" data-code="${meta}"><code class="language-diff">-old\n+new\n same\n</code></pre>`;
  const out = highlightFences(fence);
  assert.match(out, /<span class="line del" id="code-a-md-3-L1">[\s\S]*?>old<\/span>/);
  assert.match(out, /<span class="line ins" id="code-a-md-3-L2">[\s\S]*?>new<\/span>/);
  assert.match(out, /<span class="line" id="code-a-md-3-L3">[\s\S]*?>same<\/span>/);
  assert.doesNotMatch(out, />[-+]old</);
});

test("malformed data-code is ignored and the fence is highlighted as before", () => {
  const fence = '<pre data-src="a.md:3" data-code="not json"><code class="language-ts">const a = 1;\n</code></pre>';
  const out = highlightFences(fence);
  assert.match(out, /<pre class="code" tabindex="0" id="code-a-md-3" role="group" aria-label="Code: ts" data-lang="ts" data-src="a.md:3" data-code="not json"><code>/);
  assert.doesNotMatch(out, /aria-labelledby/);
  assert.doesNotMatch(out, /code-title/);
  assert.doesNotMatch(out, /data-line|highlighted|class="line (ins|del)"/);
});

test("highlightFences gives an already-highlighted block its stable id once", () => {
  const block = '<pre class="code" tabindex="0" data-lang="ts" data-src="a.md:3:1-5:3"><code>x</code></pre>';
  const out = highlightFences(block);
  assert.match(out, /^<pre class="code" id="code-a-md-3-1-5-3" tabindex="0" data-lang="ts" data-src="a\.md:3:1-5:3"><code>x<\/code><\/pre>$/);
  assert.equal(highlightFences(out), out);
});

test("highlights at build time with light and dark variables, keeps data-src", async () => {
  await loadGrammars(["json"]);
  const out = render({ lang: "json", src: "docs/a.md:3" }, "{&quot;a&quot;: 1}");
  assert.match(out, /<pre class="code"[^>]*id="code-docs-a-md-3"/);
  assert.match(out, /<pre class="code"[^>]*data-src="docs\/a\.md:3"/);
  assert.match(out, /--shiki-light:#/);
  assert.match(out, /--shiki-dark:#/);
  assert.doesNotMatch(out, /<script/);
});

test("a block without its own src leaves the span to the engine, not the page start", () => {
  const input = {
    props: { lang: "ts" },
    html: "const a = 1;",
    page: { source: { file: "docs/a.md", line: 10, column: 1, endLine: 12, endColumn: 4 } },
    site: {},
  } as unknown as ComponentProps<never>;
  const out = renderToString(code(input) as never);
  assert.doesNotMatch(out, /data-src=/);
  assert.doesNotMatch(out, /id=/);
});

test("blockId turns a span into an id-safe, stable fragment and stays unique per span", () => {
  assert.equal(blockId("docs/a.md:3:1-9:12"), "code-docs-a-md-3-1-9-12");
  assert.equal(blockId("C:\\notes\\a.md:2:3"), "code-C-notes-a-md-2-3");
  assert.equal(blockId("docs/a.md:3:1-9:12"), blockId("docs/a.md:3:1-9:12"));
  assert.notEqual(blockId("docs/a.md:3:1-9:12"), blockId("docs/a.md:4:1-9:12"));
  assert.equal(blockId(":::"), "code-block");
});

test("an unloaded language renders as plain escaped text", () => {
  const out = render({ lang: "klingon" }, "a &lt; b");
  assert.match(out, /a (&lt;|&#x3C;) b/);
});

test("a recorded session fence keeps its language and source identity", () => {
  const out = render({ lang: "console", src: "docs/a.md:3:1-6:2" }, "$ npm ci\nadded 1 package");
  assert.match(out, /data-lang="console"/);
  assert.match(out, /data-src="docs\/a\.md:3:1-6:2"/);
  assert.match(out, /id="code-docs-a-md-3-1-6-2"/);
});

test("the light theme comes from code.light.json (#1095)", () => {
  const theme = buildTheme("light");
  assert.equal(theme.name, "lateen-light");
  assert.equal(theme.type, "light");
  assert.equal(theme.colors?.["editor.background"], "#e7e7ed");
  const scopes = (theme.settings ?? []).map((setting) => setting.scope).join(", ");
  for (const scope of ["comment", "keyword", "string", "constant.numeric", "entity.name.function", "entity.name.tag", "punctuation"]) {
    assert.ok(scopes.includes(scope), scope);
  }
});

test("every syntax color meets 4.5:1 on its code background", () => {
  for (const mode of ["light", "dark"] as const) {
    const theme = buildTheme(mode);
    const background = theme.colors?.["editor.background"] ?? "";
    const foregrounds = new Set(
      [theme.colors?.["editor.foreground"], ...(theme.settings ?? []).map((setting) => setting.settings?.foreground)].filter(
        (color): color is string => color !== undefined,
      ),
    );
    assert.ok(foregrounds.size > 1);
    for (const color of foregrounds) assert.ok(contrast(color, background) >= 4.5, `${mode}: ${color} on ${background}`);
  }
});

test("the dark theme comes from code.dark.json (#1096)", () => {
  assert.equal(buildTheme("dark").name, "lateen-dark");
  assert.equal(buildTheme("dark").colors?.["editor.background"], "#1b1a26");
  assert.ok(buildTheme("dark").settings?.some((s) => s.scope?.includes("keyword")));
});


test("highlights real Mizzen test fences and keeps the example metadata", async () => {
  const mizzen = import.meta.resolve("@velella/mizzen/package.json");
  const { parseMarkdown } = await import(new URL("dist/markdown/parse.js", mizzen).href);
  const { markdownToHtml } = await import(new URL("dist/markdown/to-html.js", mizzen).href);
  const markdown = ['```sh test title="Example"', "echo hello", "```"].join("\n");
  const { html } = await markdownToHtml(await parseMarkdown(markdown), "examples.md");
  const out = highlightFences(html);
  const reordered = html.replace(/<code class="language-sh"([^>]*)>/, "<code$1 data-extra='x > y' class='language-sh'>");
  assert.match(highlightFences(reordered), /data-lang="sh"[^>]*><code[^>]*data-extra='x > y'/);
  assert.match(out, /<pre class="code"[^>]*id="[^"]+"[^>]*data-lang="sh"/);
  assert.match(out, /class="code-title-name"[^>]*>Example</);
  for (const name of ["data-example", "data-example-lang", "data-example-id"]) {
    const attribute = html.match(new RegExp(` ${name}="[^"]*"`))?.[0];
    assert.ok(attribute, name);
    assert.ok(out.includes(attribute), name);
  }
});

test("every code block is a named group: its title when it has one, else its language in the page language (#1212)", () => {
  const plain = highlightFences('<pre><code class="language-ts">const a = 1;\n</code></pre>');
  assert.match(plain, /<pre class="code" tabindex="0" role="group" aria-label="Code: ts" data-lang="ts"/);

  const text = highlightFences("<pre><code>no language\n</code></pre>");
  assert.match(text, /role="group" aria-label="Code" data-lang="text"/, "plain text is just Code");

  const meta = dataCode({ raw: "", title: "a.ts", highlight: [], ins: [], del: [], diff: false, showLineNumbers: false, annotations: [] });
  const titled = highlightFences(`<pre data-src="a.md:3" data-code="${meta}"><code class="language-ts">x\n</code></pre>`);
  assert.match(titled, /role="group" aria-labelledby="code-a-md-3-title"/);
  assert.doesNotMatch(titled, /<pre[^>]* aria-label=/, "a titled block is named by its title, once");

  const persian = highlightFences('<pre><code class="language-ts">x\n</code></pre>', undefined, "fa");
  assert.match(persian, /role="group" aria-label="کد: [^"]*ts[^"]*"/, "the name follows the page language");

  const directive = renderToString(code({ props: { lang: "sh" }, html: "echo hi", page: { lang: "en" }, site: {} } as never) as never);
  assert.match(directive, /<pre class="code" tabindex="0" role="group" aria-label="Code: sh" data-lang="sh"/);
});

test("two untitled blocks never share a name source that needs an id (#1212)", () => {
  const out = highlightFences(
    '<pre data-src="a.md:3"><code class="language-ts">a\n</code></pre><pre data-src="a.md:9"><code class="language-ts">b\n</code></pre>',
  );
  const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "no duplicate ids");
  assert.doesNotMatch(out, /aria-labelledby/);
});
