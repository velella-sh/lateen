// A site may bring its own self-hosted fonts. The family goes first in the token stack, the shipped
// fallbacks stay behind it, the files are requested through the site's base, and nothing is linked
// from another origin. Without the option, the theme's own faces and stacks are untouched.
import assert from "node:assert/strict";
import { test } from "node:test";
import { brandCss, resolveBrand } from "../src/brand.ts";

/** The validated brand of one `theme.options.brand.fonts` block, as the layout resolves it. */
function brandOf(fonts: unknown) {
  const result = resolveBrand({ brand: { fonts } });
  assert.ok(result.brand, JSON.stringify(result.problems));
  return result.brand;
}

const sans = {
  family: "Example Sans",
  files: [
    { src: "/fonts/example-sans-400.woff2", weight: 400 },
    { src: "/fonts/example-sans-700.woff2", weight: "700", style: "normal" },
  ],
};

const mono = { family: "Example Mono", files: [{ src: "/fonts/example-mono-400.woff2", weight: 400 }] };

test("one custom sans family writes its faces and leads every body stack", () => {
  const css = brandCss(brandOf({ sans }), { base: "/site" });
  assert.match(css, /@font-face \{ font-family: "Example Sans"; font-style: normal; font-display: swap; font-weight: 400;/);
  assert.match(css, /url\("\/site\/fonts\/example-sans-400\.woff2"\)/);
  assert.match(css, /--type-font-body: "Example Sans", Manrope, "Manrope Fallback", Vazirmatn, system-ui, sans-serif;/);
  assert.match(css, /--type-font-heading: "Example Sans", Manrope,/);
  assert.match(css, /--type-font-ui: "Example Sans", Manrope,/);
  assert.match(css, /--rtl-font-body: "Example Sans", Vazirmatn, Manrope,/);
  assert.match(css, /--rtl-font-heading: "Example Sans", Vazirmatn,/);
  assert.match(css, /--rtl-font-ui: "Example Sans", Vazirmatn,/);
  assert.doesNotMatch(css, /--type-font-mono: "Example Sans"/);
});

test("a sans and a mono family each lead their own stack", () => {
  const css = brandCss(brandOf({ sans, mono }));
  assert.match(css, /--type-font-body: "Example Sans", Manrope,/);
  assert.match(css, /--type-font-mono: "Example Mono", JetBrains Mono, "JetBrains Mono Fallback", ui-monospace, monospace;/);
  assert.equal(css.match(/@font-face/g)?.length, 3);
});

test("a font from another origin is refused and named", () => {
  const result = resolveBrand({
    brand: { fonts: { sans: { family: "Remote", files: [{ src: "https://cdn.example.com/x.woff2", weight: 400 }] } } },
  });
  assert.equal(result.brand, undefined);
  assert.ok(result.problems.some((problem) => problem.option.endsWith(".src") && /another origin/.test(problem.message)));
  const css = result.brand === undefined ? "" : brandCss(result.brand);
  assert.doesNotMatch(css, /@font-face/);
});

test("a family without files, a file without a source, and a bad weight are refused", () => {
  const result = resolveBrand({
    brand: {
      fonts: {
        sans: { family: "Sans", files: [] },
        mono: { family: "Mono", files: [{ weight: 400 }, { src: "/x.woff2", weight: "heavy" }, { src: "/y.woff2", weight: 400 }] },
      },
    },
  });
  const options = result.problems.map((problem) => problem.option);
  assert.ok(options.includes("theme.options.brand.fonts.sans.files"));
  assert.ok(options.includes("theme.options.brand.fonts.mono.files[0].src"));
  assert.ok(options.includes("theme.options.brand.fonts.mono.files[1].weight"));
  assert.equal(result.brand?.mono?.files.length, 1, "the usable file survives");
});

test("without the option the theme's faces and stacks are absent", () => {
  const css = brandCss({ accent: "#2f6f9f" });
  assert.doesNotMatch(css, /@font-face/);
  assert.doesNotMatch(css, /--type-font-body/);
  assert.doesNotMatch(css, /--rtl-font-body/);
});

test("a family name cannot break out of its CSS string", () => {
  const css = brandCss(brandOf({ sans: { family: 'Bad"}\nbody{color:red}', files: [{ src: "/x.woff2", weight: 400 }] } }));
  assert.match(css, /font-family: "Bad\\"} body\{color:red\}"/);
  assert.doesNotMatch(css, /\nbody\{color:red\}/);
});
