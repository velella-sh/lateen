import { readFileSync } from "node:fs";
import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import mermaid from "../mermaid/index.ts";
import { codeBackgrounds } from "../../src/brand.ts";
import { ensureContrast, parseHex } from "../../src/color.ts";
import { annotationLineId, parseFenceMeta, renderAnnotations } from "./annotations.ts";
import { isDiffLang, markDiffLines, stripDiffMarkers } from "./diff.ts";
import { decodeEntities } from "./escape.ts";
import { decorateLines, type LineRange } from "./lines.ts";
import { codeTitleHtml } from "./title.ts";
import { escapeHtml } from "./escape.ts";
import { t } from "../../i18n/index.ts";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";
import type { HighlighterCore, LanguageRegistration, ThemeRegistration } from "shiki/core";

/** The Markdown directive this component handles: `:::code{lang="ts"}`. */
export const directive = "code";

/** Class on the `<pre>`; `style.css` styles it. */
export const CODE_CLASS = "code";

/** A code block longer than this many lines starts collapsed, with the full text still in the DOM. */
export const COLLAPSE_AFTER = 20;

/** Class on the disclosure around a long code block. */
export const COLLAPSE_CLASS = "code-details";

/** Class on the disclosure's summary. */
export const COLLAPSE_SUMMARY_CLASS = "code-details-summary";

type Mode = "light" | "dark";
type TokenEntry = { $value: string; $extensions?: { lateen?: { dark?: string } } };

/** Read a token file next to this theme's tokens, or `undefined` when it is not there yet. */
function readTokens(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(new URL(`../../tokens/${file}`, import.meta.url), "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Token name to the TextMate scopes it colors. */
const SCOPES: Record<string, string[]> = {
  comment: ["comment", "punctuation.definition.comment"],
  keyword: ["keyword", "storage", "storage.type", "keyword.operator.new"],
  string: ["string", "string.regexp"],
  number: ["constant.numeric", "constant.language", "constant"],
  function: ["entity.name.function", "support.function", "meta.function-call"],
  tag: ["entity.name.tag", "support.class.component", "entity.name.type", "entity.other.attribute-name"],
  punctuation: ["punctuation", "meta.brace"],
};

/**
 * The Shiki theme for one mode. `code.light.json` or `code.dark.json` (a Shiki theme) wins when present;
 * otherwise the theme is built from the `code` group of `names.json`.
 */
export function buildTheme(mode: Mode): ThemeRegistration {
  const file = readTokens(`code.${mode}.json`);
  if (file) return { name: `lateen-${mode}`, type: mode, ...file } as ThemeRegistration;
  const group = ((readTokens("names.json") ?? {}).code ?? {}) as Record<string, TokenEntry>;
  const pick = (name: string): string => {
    const token = group[name];
    return (mode === "dark" ? token?.$extensions?.lateen?.dark : undefined) ?? token?.$value ?? "inherit";
  };
  return {
    name: `lateen-${mode}`,
    type: mode,
    colors: { "editor.background": pick("bg"), "editor.foreground": pick("fg") },
    settings: [
      { settings: { foreground: pick("fg"), background: pick("bg") } },
      ...Object.entries(SCOPES).map(([name, scope]) => ({ scope, settings: { foreground: pick(name) } })),
    ],
  };
}

let highlighter: HighlighterCore | undefined;
function get(): HighlighterCore {
  highlighter ??= createHighlighterCoreSync({
    themes: [buildTheme("light"), buildTheme("dark")],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

/** The two backgrounds a brand gives the code block, or the theme's own when it sets no neutral tint. */
export interface CodeBackdrops {
  readonly light: string;
  readonly dark: string;
}

/**
 * Re-checks every highlighted token against the brand's code background. Shiki writes each colour as
 * `--shiki-light` and `--shiki-dark` on the token; being inline, they cannot be overridden by a
 * stylesheet, so a colour that falls below 4.5:1 is corrected here, at emit time, keeping the shipped
 * theme's hue and only moving its lightness. A token without a hex value (`inherit`) is left alone.
 */
export function adjustShiki(html: string, backdrops: CodeBackdrops | undefined): string {
  if (backdrops === undefined) return html;
  return html.replace(/--shiki-(light|dark):(#[0-9a-fA-F]{6})/g, (match, mode: string, colour: string) => {
    if (parseHex(colour) === undefined) return match;
    const against = mode === "light" ? backdrops.light : backdrops.dark;
    return `--shiki-${mode}:${ensureContrast(colour, against, 4.5)}`;
  });
}

/** Languages whose grammar is loaded. Only these are highlighted; anything else renders as plain text. */
export function loadedLanguages(): string[] {
  return get().getLoadedLanguages();
}

/** One bundled grammar module and the loader that imports it. Aliases share the same loader. */
type GrammarModule = { default: LanguageRegistration[] };
type GrammarLoader = () => Promise<GrammarModule>;
type GrammarLoaders = Record<string, GrammarLoader | undefined>;

/** Imports in flight or done, keyed by loader: one grammar module is imported once for every caller. */
const imports = new Map<GrammarLoader, Promise<GrammarModule>>();

/** The module for a bundled loader, shared with every caller; a rejection is not cached, so a later call retries it. */
function importGrammar(load: GrammarLoader): Promise<GrammarModule> {
  let module = imports.get(load);
  if (!module) {
    module = load();
    imports.set(load, module);
    module.catch(() => {
      if (imports.get(load) === module) imports.delete(load);
    });
  }
  return module;
}

/**
 * Load the grammars a site uses, and only those. Call it once before rendering, with the languages found in the
 * site's code fences. Unknown names are ignored.
 *
 * Distinct grammars import concurrently, overlapping callers share one import, and registration happens in the
 * requested order, so the loaded set and the highlighted output do not depend on which import settles first.
 * A grammar that fails to import or register rejects this call and stays unloaded; the other grammars in the
 * same call still load, and a later call retries the failed one.
 */
export async function loadGrammars(langs: Iterable<string>, loaders: GrammarLoaders = bundledLanguages): Promise<void> {
  const hl = get();
  const loaded = new Set(hl.getLoadedLanguages());
  const requested = new Map<string, GrammarLoader>();
  for (const lang of langs) {
    const load = loaders[lang];
    if (load && !loaded.has(lang)) requested.set(lang, load);
  }
  const names = [...requested.keys()];
  const results = await Promise.allSettled(names.map((name) => importGrammar(requested.get(name)!)));
  const failed: string[] = [];
  const errors: unknown[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failed.push(names[index]!);
      errors.push(result.reason);
      return;
    }
    try {
      hl.loadLanguageSync(result.value.default);
    } catch (error) {
      failed.push(names[index]!);
      errors.push(error);
    }
  });
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, `Could not load grammars: ${failed.join(", ")}`);
}

/**
 * Grammars loaded with the module, so a code block is highlighted without the site listing its languages:
 * the ones a docs site writes most. A site that needs another calls {@link loadGrammars}.
 */
export const DEFAULT_LANGUAGES = [
  "bash", "css", "diff", "html", "javascript", "json", "markdown", "powershell", "shellscript", "toml", "tsx", "typescript", "yaml",
] as const;

/** Short names a fence may use for a loaded grammar. */
const ALIASES: Record<string, string> = { sh: "shellscript", shell: "shellscript", zsh: "shellscript", js: "javascript", ts: "typescript", md: "markdown", yml: "yaml", ps1: "powershell" };

await loadGrammars(DEFAULT_LANGUAGES);

const TAG = /<[^>]*>/g;

/** `html` with every tag dropped. It repeats until nothing is left to drop, so removing one tag cannot join the pieces of another. */
function stripTags(html: string): string {
  let text = html;
  for (;;) {
    const next = text.replace(TAG, "");
    if (next === text) return text;
    text = next;
  }
}

/**
 * The code text inside a rendered body: tags dropped, entities decoded (named, decimal, and hexadecimal).
 * The result is plain text, not HTML: it may hold `<` again after decoding, and every caller hands it to the
 * highlighter, which escapes it. A number that is no code point is left as written.
 */
export function sourceText(html: string): string {
  return decodeEntities(stripTags(html)).replace(/\n$/, "");
}

/** The language named by a `language-x` class in the body, when the props give none. */
function langFromBody(html: string): string | undefined {
  return /class="[^"]*\blanguage-([\w+#-]+)/.exec(html)?.[1];
}

/**
 * A stable DOM id for a block from its source span: `code-docs-a-md-3-1-9-12`. Letters, digits,
 * `_` and `-` survive; everything else becomes `-`, so an id is safe in CSS and in a URL fragment.
 * The span is unique within a page, so two blocks never share an id.
 */
export function blockId(src: string): string {
  const slug = src
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `code-${slug || "block"}`;
}

export type CodeProps = {
  /** Language of the fence. */
  lang?: string;
  /** Source position, kept as `data-src` on the `pre`. */
  src?: string;
};

/**
 * Code highlighted at build time. Colors are emitted as `--shiki-light` and `--shiki-dark` variables on each
 * token, and `style.css` picks one with `light-dark()`, so the theme switch needs no rebuild and no
 * highlighting runs in the browser.
 */
export default function code({ props, html, page, site }: ComponentProps<CodeProps>) {
  const lang = (typeof props.lang === "string" ? props.lang.trim() : "") || langFromBody(html) || "text";
  const text = sourceText(html);
  // No page-start fallback: the engine stamps the directive's own span on the root, so each block
  // keeps a precise, unique source identity instead of all blocks sharing the page's first line.
  const src = typeof props.src === "string" ? props.src : undefined;
  // A fence marked `mermaid` is a diagram, not text; `mermaidComponents` in the engine sends fences
  // straight to the mermaid component, and this keeps `:::code{lang=mermaid}` working too.
  if (lang === "mermaid") {
    return mermaid({ props: { source: text, ...(src ? { src } : {}) }, page, site, html });
  }
  const hl = get();
  const grammar = ALIASES[lang] ?? lang;
  const known = hl.getLoadedLanguages().includes(grammar);
  const options = site.config?.theme?.options;
  const out = adjustShiki(
    hl.codeToHtml(text, { lang: known ? grammar : "text", themes: { light: "lateen-light", dark: "lateen-dark" }, defaultColor: false }),
    codeBackgrounds(options),
  );
  const inner = /<code[^>]*>([\s\S]*)<\/code>/.exec(out)?.[1] ?? "";
  const block = src === undefined ? undefined : blockId(src);
  const decorated = block === undefined ? inner : decorateLines(inner, { block, lang: page.lang });
  const pre = h(
    "pre",
    { class: CODE_CLASS, tabindex: 0, "data-lang": lang, ...(block === undefined ? {} : { id: block, "data-src": src }) },
    h("code", { dangerouslySetInnerHTML: { __html: decorated } }),
  );
  if (text.split("\n").length <= COLLAPSE_AFTER) return pre;
  return h(
    "details",
    { class: COLLAPSE_CLASS },
    h("summary", { class: COLLAPSE_SUMMARY_CLASS }, t(typeof page.lang === "string" ? page.lang : "en", "cli_demo_show_all")),
    pre,
  );
}

/**
 * A plain Markdown fence as the engine writes it: `<pre data-src [data-code]><code class="language-x">…</code></pre>`.
 * Only quoted values are matched, so a `>` inside `data-code`'s JSON (an annotation may hold one) is not
 * mistaken for the end of the tag.
 */
const FENCE = /<pre((?:\s[^\s=>]+="[^"]*")*)><code(?:\s+class="language-([\w+#-]+)")?>([\s\S]*?)<\/code><\/pre>/g;

/** A stable id on any highlighted `<pre class="code">` that has a source span but no id yet. */
const IDENTIFY = /<pre class="code"((?:\s[^\s=>]+="[^"]*")*)>/g;

/** The value of one quoted attribute in a tag's attribute text. */
function attribute(attrs: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];
}

/**
 * The attributes the replacement `<pre>` keeps: class merges with the theme's own, and the names the
 * replacement writes are dropped so the tag never carries a duplicate attribute. A component's `<pre>`
 * (such as an output block) keeps its class and the behaviour its island looks for.
 */
function keptAttributes(attrs: string): { readonly extraClass: string; readonly rest: string; readonly originalId?: string } {
  const originalId = attribute(attrs, "id");
  const extraClass = attribute(attrs, "class") ?? "";
  const rest = attrs.replace(/\s(?:class|id|tabindex|data-lang)="[^"]*"/g, "");
  return originalId === undefined ? { extraClass, rest } : { extraClass, rest, originalId };
}

/**
 * Highlights the plain fences in a rendered body, so a fence and the `:::code` directive look the same.
 * Each fence becomes the markup {@link code} writes, with its language as `data-lang` and its `data-src` kept.
 * The engine's `data-code` adds the fence's title bar, highlighted and numbered lines, diff marks, and notes.
 * Every highlighted block that has a span but no id gets {@link blockId}, including a directive block whose
 * span the engine stamped after the component ran. A `mermaid` fence is left alone: the engine sends it to
 * the diagram component.
 */
export function highlightFences(html: string, backdrops?: CodeBackdrops, lang = "en"): string {
  if (!html.includes("<pre")) return html;
  const hl = get();
  return html
    .replace(FENCE, (match, attrs: string, fenceLang: string | undefined, body: string) => {
      if (fenceLang === "mermaid" || /\sclass="code"/.test(attrs)) return match;
      const name = fenceLang ?? "text";
      const meta = parseFenceMeta(attribute(attrs, "data-code"));
      const grammar = ALIASES[name] ?? name;
      const known = hl.getLoadedLanguages().includes(grammar);
      const out = adjustShiki(
        hl.codeToHtml(sourceText(body), { lang: known ? grammar : "text", themes: { light: "lateen-light", dark: "lateen-dark" }, defaultColor: false }),
        backdrops,
      );
      const inner = /<code[^>]*>([\s\S]*)<\/code>/.exec(out)?.[1] ?? "";
      const src = attribute(attrs, "data-src");
      const block = blockId(src ?? "");
      const kept = keptAttributes(attrs);
      const lineBase = kept.originalId ?? (src === undefined ? undefined : block);
      let decorated = inner;
      if (meta !== undefined || lineBase !== undefined) {
        const annotations = meta?.annotations ?? [];
        decorated = decorateLines(inner, {
          ...(meta === undefined ? {} : { highlight: meta.highlight, numbers: meta.showLineNumbers }),
          ...(lineBase === undefined ? {} : { block: lineBase, lang }),
          ...(annotations.length === 0 ? {} : { lineId: annotationLineId(block, annotations) }),
        });
      }
      if (meta !== undefined) {
        if (isDiffLang(name) || meta.diff) decorated = stripDiffMarkers(decorated);
        decorated = markDiffLines(decorated, { ins: meta.ins, del: meta.del });
      }
      const id = kept.originalId ?? (src === undefined ? undefined : block);
      const idAttr = id === undefined ? "" : ` id="${id}"`;
      const className = kept.extraClass === "" ? CODE_CLASS : `${CODE_CLASS} ${kept.extraClass}`;
      const titleId = meta === undefined || (meta.title ?? "").trim() === "" ? undefined : `${block}-title`;
      const title = meta === undefined ? "" : codeTitleHtml(meta.title, titleId);
      const labelled = titleId === undefined ? "" : ` aria-labelledby="${titleId}"`;
      const notes = meta === undefined ? "" : renderAnnotations(meta.annotations, block, lang);
      const pre = `<pre class="${className}" tabindex="0"${idAttr}${labelled} data-lang="${name}"${kept.rest}><code>${decorated}</code></pre>`;
      if (decorated.split("\n").length <= COLLAPSE_AFTER) return `${title}${pre}${notes}`;
      const summary = `<summary class="${COLLAPSE_SUMMARY_CLASS}">${escapeHtml(t(lang, "cli_demo_show_all"))}</summary>`;
      return `${title}<details class="${COLLAPSE_CLASS}">${summary}${pre}</details>${notes}`;
    })
    .replace(IDENTIFY, (match, attrs: string) => {
      if (/\sid=/.test(attrs)) return match;
      const src = attribute(attrs, "data-src");
      if (src === undefined) return match;
      return `<pre class="${CODE_CLASS}" id="${blockId(src)}"${attrs}>`;
    });
}
