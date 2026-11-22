import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { withEnv } from "./helpers/globals.ts";
import { renderToString } from "preact-render-to-string";
import type {
  ChromeProps,
  NavLink,
  NavTree,
  
  Page,
  Pager,
  Site,
  SourcePos,
  Trail,
} from "@velella/mizzen/contracts";
import pager from "../chrome/pager/index.ts";
import { siteConfig } from "./helpers/site.ts";
import { pageWith } from "./helpers/page.ts";
import { readUiCss } from "./ui-css-helpers.ts";

/** The shared stylesheet without comments, so a rule body can be read by selector. */
const uiCss = readUiCss().replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

/** Every `selector { body }` block of the shared stylesheet. */
function cssBlocks(text: string): { selector: string; body: string }[] {
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? "").trim(),
    body: match[2] ?? "",
  }));
}

/** The declaration bodies whose selector matches `pattern`, joined. */
const cssBodyOf = (pattern: RegExp): string =>
  cssBlocks(uiCss)
    .filter((block) => pattern.test(block.selector))
    .map((block) => block.body)
    .join("\n");

const pos: SourcePos = { file: "docs/guide/install.md", line: 3, column: 1, endLine: 9, endColumn: 1 };

const config = siteConfig({ base: "/example" });

const trail: Trail = [];

const page = pageWith({ url: "/example/guide/install/", source: pos, frontMatter: { title: "Install" }, title: "Install" });

const prev: NavLink = { title: "Overview", url: "/example/guide/" };
const next: NavLink = { title: "Configure", url: "/example/guide/configure/" };
const current: NavLink = { title: "Install", url: page.url };
const start: NavLink = { title: "Start", url: "/example/guide/" };
const components: NavLink = { title: "Components", url: "/example/components/" };

function props(links: Pager, lang = "en", nav: NavTree = {}, pageTrail: Trail = trail): ChromeProps {
  const localized: Page = { ...page, lang, dir: lang === "en" ? "ltr" : "rtl" };
  const site: Site = { config, pages: [localized], nav, data: {}, collections: {} };
  return { site, page: localized, trail: pageTrail, pager: links };
}

function output(links: Pager, lang = "en", nav: NavTree = {}, pageTrail: Trail = trail): string {
  const node = pager(props(links, lang, nav, pageTrail));
  return node === null ? "" : renderToString(node as never);
}

/** Runs `run` while collecting everything written to `console.warn`. */
function warningsFrom(run: () => void): string[] {
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  try {
    run();
  } finally {
    console.warn = warn;
  }
  return warnings;
}

const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);

const MESSAGES = {
  en: { pager: "Previous and next", previous: "Previous", next: "Next" },
  fa: { pager: "صفحهٔ قبل و بعد", previous: "قبلی", next: "بعدی" },
  ar: { pager: "الصفحة السابقة والتالية", previous: "السابق", next: "التالي" },
} as const;

test("renders nothing when the page has neither a previous nor a next page", () => {
  assert.equal(output({}), "");
});

test("links previous and next with rel=prev and rel=next, previous first", () => {
  const out = output({ prev, next });

  assert.match(out, /^<nav class="pager" aria-label="Previous and next">/);
  assert.match(out, /<a class="pager-link pager-prev" href="\/example\/guide\/" rel="prev">/);
  assert.match(out, /<a class="pager-link pager-next" href="\/example\/guide\/configure\/" rel="next">/);
  assert.match(out, /<span class="pager-title"><bdi>Overview<\/bdi><\/span>/);
  assert.match(out, /<span class="pager-title"><bdi>Configure<\/bdi><\/span>/);
  assert.ok(out.indexOf("pager-prev") < out.indexOf("pager-next"));
});

test("shows only the card that exists, in the next column", () => {
  const onlyPrev = output({ prev });
  assert.match(onlyPrev, /rel="prev"/);
  assert.doesNotMatch(onlyPrev, /rel="next"/);
  assert.doesNotMatch(onlyPrev, /pager-next/);

  const onlyNext = output({ next });
  assert.match(onlyNext, /<a class="pager-link pager-next" href="\/example\/guide\/configure\/" rel="next">/);
  assert.doesNotMatch(onlyNext, /rel="prev"/);
});

test("the landmark and card labels follow the page language, with no missing-message diagnostics", () => {
  withEnv("NODE_ENV", "development", () => {
    for (const [lang, messages] of Object.entries(MESSAGES)) {
      let out = "";
      assert.deepEqual(
        warningsFrom(() => {
          out = output({ prev, next }, lang);
        }),
        [],
        `${lang} reads only shipped messages`,
      );
      assert.match(out, new RegExp(`<nav class="pager" aria-label="${messages.pager}">`));
      assert.ok(out.includes(`</svg>${messages.previous}</span>`), `${lang} previous label`);
      assert.ok(out.includes(`${messages.next}<svg`), `${lang} next label`);
    }
  });
});

test("a regional page tag reads its primary catalog without a diagnostic", () => {
  withEnv("NODE_ENV", "development", () => {
    for (const [lang, messages] of [
      ["fa-IR", MESSAGES.fa],
      ["AR-eg", MESSAGES.ar],
      ["en-GB", MESSAGES.en],
      ["fa_IR", MESSAGES.fa],
    ] as const) {
      let out = "";
      assert.deepEqual(
        warningsFrom(() => {
          out = output({ prev, next }, lang);
        }),
        [],
        `${lang} reads its primary catalog`,
      );
      assert.match(out, new RegExp(`aria-label="${messages.pager}"`));
      assert.ok(out.includes(messages.previous));
      assert.ok(out.includes(messages.next));
    }
  });
});

test("a mixed-direction title is isolated and does not reorder its own direction label", () => {
  const mixed = { title: "راهنمای API و نصب", url: "/example/guide/api/" };
  const rtlTitle = { title: "دليل التثبيت", url: "/example/guide/install-ar/" };

  const english = output({ prev, next: mixed });
  assert.match(english, /<span class="pager-title"><bdi>راهنمای API و نصب<\/bdi><\/span>/);
  const labels = [...english.matchAll(/<span class="pager-label">([\s\S]*?)<\/span>/g)].map((match) => match[1] ?? "");
  assert.equal(labels.length, 2);
  assert.ok(labels[0]?.endsWith("Previous"));
  assert.ok(labels[1]?.startsWith("Next"));
  assert.ok(labels.every((label) => !/[\u0590-\u08ff]/.test(label)), "no title text leaks into a direction label");

  const persian = output({ prev: rtlTitle, next: mixed }, "fa");
  assert.match(persian, /<bdi>دليل التثبيت<\/bdi>/);
  assert.match(persian, /<bdi>راهنمای API و نصب<\/bdi>/);
  assert.ok(persian.includes("</svg>قبلی</span>"));
  assert.ok(persian.includes("بعدی<svg"));
});

test("escaping keeps titles as text and URLs as attributes", () => {
  const hostile: NavLink = { title: '<script>alert("x")</script>', url: '/a?x=1&y="2"' };
  const out = output({ next: hostile });

  assert.match(out, /<span class="pager-title"><bdi>&lt;script>alert\(&quot;x&quot;\)&lt;\/script><\/bdi><\/span>/);
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /href="\/a\?x=1&amp;y=&quot;2&quot;"/);
});

test("an empty title leaves an empty, deterministic title element", () => {
  const out = output({ prev: { title: "", url: "/example/guide/" } });
  assert.match(out, /<span class="pager-title"><bdi><\/bdi><\/span>/);
  assert.doesNotMatch(out, /undefined/);
});

test("both cards are plain links, reachable and ordered for keyboard navigation", () => {
  const out = output({ prev, next });
  const links = out.match(/<a [^>]*>/g) ?? [];

  assert.equal(links.length, 2);
  assert.equal(links.filter((link) => / href="[^"]+"/.test(link)).length, 2);
  assert.ok(links.every((link) => !/tabindex|role=|onclick|onkeydown/.test(link)));
  assert.ok(out.indexOf('class="pager-link pager-prev"') < out.indexOf('class="pager-link pager-next"'));
});

test("a destination in the same section keeps the plain direction label", () => {
  const nav: NavTree = { main: [{ title: "Start", children: [prev, current, next] }] };
  const out = output({ prev, next }, "en", nav, [start]);

  assert.doesNotMatch(out, /pager-section/);
  assert.ok(out.includes("</svg>Previous</span>"));
  assert.ok(out.includes("Next<svg"));
});

test("a next page in another section names that section while keeping its URL", () => {
  const nav: NavTree = {
    main: [
      { title: "Start", children: [prev, current] },
      { title: "Components", children: [next] },
    ],
  };
  const out = output({ prev, next }, "en", nav, [start]);

  assert.match(
    out,
    /<a class="pager-link pager-next" href="\/example\/guide\/configure\/" rel="next"><span class="pager-label">Next<span class="pager-section"> · <bdi>Components<\/bdi><\/span><svg/,
  );
  const previousCard = out.match(/<a class="pager-link pager-prev"[\s\S]*?<\/a>/)?.[0] ?? "";
  assert.doesNotMatch(previousCard, /pager-section/);
});

test("a previous page in another section names that section while keeping its URL", () => {
  const nav: NavTree = {
    main: [
      { title: "Components", children: [prev] },
      { title: "Start", children: [current, next] },
    ],
  };
  const out = output({ prev, next }, "en", nav, [start]);

  assert.match(
    out,
    /<span class="pager-label"><svg[\s\S]*?<\/svg>Previous<span class="pager-section"> · <bdi>Components<\/bdi><\/span><\/span>/,
  );
  const nextCard = out.match(/<a class="pager-link pager-next"[\s\S]*?<\/a>/)?.[0] ?? "";
  assert.doesNotMatch(nextCard, /pager-section/);
});

test("a destination missing from the navigation keeps the plain label", () => {
  const nav: NavTree = { main: [{ title: "Start", children: [current, next] }] };
  const out = output({ prev, next }, "en", nav, [start]);

  assert.doesNotMatch(out, /pager-section/);
  assert.match(out, /href="\/example\/guide\/" rel="prev"/);
});

test("section names keep their direction and the localized label under RTL", () => {
  const persianStart: NavLink = { title: "شروع", url: "/example/fa/" };
  const persianPrev: NavLink = { title: "راهنما", url: "/example/fa/guide/" };
  const persianNext: NavLink = { title: "پیکربندی", url: "/example/fa/components/" };
  const nav: NavTree = {
    main: [
      { title: "پیکربندی", children: [persianNext] },
      { title: "راهنما", children: [persianPrev] },
    ],
  };
  const out = output({ prev: persianPrev, next: persianNext }, "fa", nav, [persianStart]);

  assert.ok(out.includes('<span class="pager-section"> · <bdi>راهنما</bdi></span>'));
  assert.ok(out.includes('</svg>قبلی<span class="pager-section">'), out);
  assert.ok(out.includes('بعدی<span class="pager-section"> · <bdi>پیکربندی</bdi></span><svg'), out);
  assert.ok(out.includes('href="/example/fa/guide/" rel="prev"'));
  assert.ok(out.includes('href="/example/fa/components/" rel="next"'));
});

test("a section name is escaped text, never markup", () => {
  const hostile = '<script>alert("x")</script>';
  const nav: NavTree = { main: [{ title: hostile, children: [next] }] };
  const out = output({ next }, "en", nav, [start]);

  assert.ok(
    out.includes('<span class="pager-section"> · <bdi>&lt;script>alert(&quot;x&quot;)&lt;/script></bdi></span>'),
    out,
  );
  assert.doesNotMatch(out, /<script>/);
});

test("the section label is server-rendered into plain links that work without JavaScript", () => {
  const nav: NavTree = { main: [{ title: "Components", children: [next] }] };
  const out = output({ next }, "en", nav, [start]);

  assert.match(out, /^<nav class="pager" aria-label="Previous and next">/);
  assert.match(out, /<a class="pager-link pager-next" href="\/example\/guide\/configure\/" rel="next">/);
  assert.match(out, /<span class="pager-section"> · <bdi>Components<\/bdi><\/span>/);
  assert.doesNotMatch(out, /onclick|onkeydown|tabindex|<script/);
});

test("the pager puts the direction word and its arrow on one line above the destination", () => {
  // The card keeps label-then-title order in the DOM; the stylesheet places the arrow inline with the
  // word instead of absolutely beside the whole card, so the destination gets the full line.
  const out = output({ prev, next });
  assert.match(out, /<span class="pager-label"><svg class="pager-arrow"[^>]*>[\s\S]*?<\/svg>Previous<\/span><span class="pager-title">/);
  const label = cssBodyOf(/^\.pager-label$/);
  assert.match(label, /@apply[^;]*\bflex\b/, "the label row lays the arrow beside the word");
  assert.doesNotMatch(label, /position:\s*absolute/, "the arrow is in the label flow, not pinned to the card");

  const arrow = cssBodyOf(/^\.pager-arrow$/);
  assert.doesNotMatch(arrow, /position:\s*absolute/, "the arrow no longer floats beside the card");
  const title = cssBodyOf(/^\.pager-title$/);
  assert.match(title, /@apply[^;]*\bfont-bold\b/, "the destination carries the weight");
});

test("a lone previous or next card fills the row instead of leaving a dead half", () => {
  // `grid-column: 2` pins a next-only card to the second column of a two-column grid; the
  // `:only-child` rule overrides it so one destination spans both columns.
  const nextColumn = cssBodyOf(/^\.pager-next$/);
  assert.match(nextColumn, /grid-column:\s*2/, "a next card sits in the second column when both exist");

  const onlyChild = cssBodyOf(/\.pager-link:only-child/);
  assert.match(onlyChild, /grid-column:\s*1\s*\/\s*-1/, "a single card spans the whole row");

  const onlyNext = output({ next });
  const onlyPrev = output({ prev });
  assert.equal((onlyNext.match(/class="pager-link/g) ?? []).length, 1);
  assert.equal((onlyPrev.match(/class="pager-link/g) ?? []).length, 1);
});

test("the end-of-article tool chips stay quieter than the continue-reading links", () => {
  const tools = cssBodyOf(/^\.article-tools details > summary$/);
  assert.match(tools, /font-size:\s*0?\.75rem|text-xs/, "the chips use the small size");
  assert.match(tools, /color:\s*var\(--muted-foreground\)/, "the chips stay muted until hover");
  assert.match(tools, /background:\s*transparent/, "the chips do not compete with the pager card fill");

  const toolsRow = cssBodyOf(/^\.article-tools$/);
  assert.doesNotMatch(toolsRow, /text-base|text-lg/, "the tools row does not grow into the pager's weight");
});


