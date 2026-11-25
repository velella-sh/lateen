import { h, type ComponentChildren } from "preact";
import { renderToString } from "preact-render-to-string";
import { Moon, Sun } from "lucide";
import { icon } from "../../src/icon.ts";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { DENSITIES, RADII, brandCss, brandTokens, resolveBrand } from "../../src/brand.ts";
import { adjustShiki } from "../../src/syntax-contrast.ts";
import { withBase } from "../../src/url.ts";
import { componentProps } from "../../src/component-props.ts";
import callout from "../callout/index.ts";
import code from "../code/index.ts";
import status from "../status/index.ts";
import { DEFAULT_PRESET, FONTS, STUDIO_PRESETS, optionsYaml, type StudioPreset } from "./model.ts";

export const directive = "brand-studio";

function colorField(label: string, name: string, value: string) {
  return h("div", { class: "brand-studio-colour" },
    h("label", null, label, h("input", {
      name, value, type: "text", size: 8, maxlength: 7, spellcheck: false, autocomplete: "off",
    })),
    h("input", { name: `${name}Picker`, type: "color", value, "aria-label": `Pick ${label.toLowerCase()}` }),
  );
}

function field(label: string, name: string, values: readonly (readonly [string, string])[], current: string) {
  return h("label", null, label, h("select", { name },
    values.map(([value, text]) => h("option", { value, selected: value === current }, text)),
  ));
}

const labelOf = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const optionsOf = (values: readonly string[]) => values.map((value) => [value, labelOf(value)] as const);

export default function brandStudio(input: ComponentProps) {
  const { page, site } = input;
  const presets = Object.fromEntries(STUDIO_PRESETS.map((preset) => {
    const { brand, problems } = resolveBrand({ preset });
    if (typeof brand?.accent !== "string" || typeof brand.neutral !== "string" || problems.length) throw new Error(`Invalid studio preset: ${preset}`);
    return [preset, { ...brand, accent: brand.accent, neutral: brand.neutral }] as const;
  })) as Readonly<Record<string, StudioPreset>>;
  const initial = presets[DEFAULT_PRESET];
  if (initial === undefined) throw new Error(`Missing the ${DEFAULT_PRESET} preset`);
  const base = site.config.base;

  // The browser rechecks the original syntax colors without shipping the highlighter.
  const snippet = renderToString(h("div", null, code(componentProps(
    { page, renderComponent: input.renderComponent, site: { ...site, config: { ...site.config, theme: { ...site.config.theme, options: {} } } } },
    { lang: "js" },
    "<pre><code>const retries = 3;\nawait connect({ retries });</code></pre>",
  )))).replace(/style="--shiki-light:(#[\da-f]{6});--shiki-dark:(#[\da-f]{6})"/gi,
    (match, light: string, dark: string) => `${match} data-studio-syntax="${light} ${dark}"`);
  const background = brandTokens(initial)["code-bg"];
  const snippetMarkup = adjustShiki(snippet, background);

  return h("section", { class: "brand-studio", "aria-label": "Theme Studio", "data-brand-studio": true,
    "data-presets": JSON.stringify(presets), "data-base": base },
    h("style", null, brandCss(initial, { selector: ".brand-studio-sample" })),
    h("div", { class: "brand-studio-workspace" },
      h("form", { class: "brand-studio-controls", hidden: true, autocomplete: "off" },
        h("h2", null, "Customize"),
        field("Preset", "preset", optionsOf(Object.keys(presets)), DEFAULT_PRESET),
        h("fieldset", null,
          h("legend", null, "Colors"),
          colorField("Accent color", "accent", initial.accent ?? ""),
          colorField("Neutral tint", "neutral", initial.neutral ?? ""),
          h("p", { "data-studio-feedback": true, "aria-live": "polite", "aria-atomic": "true" }),
        ),
        h("fieldset", null,
          h("legend", null, "Typography"),
          field("Text font", "sans", [["", "Manrope"], [FONTS.sans.family, FONTS.sans.family]], ""),
          field("Code font", "mono", [["", "JetBrains Mono"], [FONTS.mono.family, FONTS.mono.family]], ""),
        ),
        h("details", null, h("summary", null, "More settings"),
          field("Corner radius", "radius", optionsOf(RADII), initial.radius ?? ""),
          field("Density", "density", optionsOf(DENSITIES), initial.density ?? ""),
        ),
      ),
      h("div", { class: "brand-studio-preview" },
        h("header", { class: "brand-studio-preview-header" },
          h("h2", null, "Live preview"),
          h("div", { "data-studio-scheme-control": true, "aria-label": "Preview mode", role: "group", hidden: true },
            h("button", { type: "button", "data-studio-scheme": "light", "aria-pressed": false },
              icon({ node: Sun }), "Light",
            ),
            h("button", { type: "button", "data-studio-scheme": "dark", "aria-pressed": false },
              icon({ node: Moon }), "Dark",
            ),
          ),
        ),
        h("div", { class: "brand-studio-sample", "data-studio-preview": true },
          h("header", { class: "brand-studio-sample-header" },
            h("h3", null, "Connection guide"),
            status(componentProps(input, { tone: "positive", label: "Ready" })) as ComponentChildren,
          ),
          h("p", null, "Set up the client and choose how often it retries. ",
            h("a", { href: "#apply-settings" }, "See the settings"),
          ),
          callout(componentProps(input, { type: "tip", title: "Test your connection" },
            "<p>Start with three retries and see how the client responds.</p>")),
          h("div", { dangerouslySetInnerHTML: { __html: snippetMarkup } }),
        ),
      ),
    ),
    h("div", { class: "brand-studio-export" },
      h("header", { class: "brand-studio-preview-header" },
        h("h2", null, "mizzen.yml"),
        h("button", { type: "button", "data-studio-copy": true, hidden: true }, "Copy YAML"),
      ),
      h("p", { "data-studio-copy-status": true, role: "status" }),
      h("pre", { tabindex: 0, "aria-label": "Theme options YAML" }, h("samp", { "data-studio-yaml": true }, optionsYaml(DEFAULT_PRESET))),
      h("ul", { "data-studio-downloads": true, hidden: true },
        (["sans", "mono"] as const).map((role) => {
          const font = FONTS[role];
          const file = font.files[0];
          return h("li", { "data-studio-download": role, hidden: true },
            h("a", { href: withBase(base, file.src), download: true }, `Download ${font.family}`),
            " · Save as ", h("code", null, file.src.slice(1)),
            " · ", h("a", { href: withBase(base, file.src.replace(/[^/]+$/, "ofl.txt")) }, "Font license"),
          );
        }),
      ),
    ),
  );
}
