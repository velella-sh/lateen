import { readFileSync } from "node:fs";
import { createHighlighterCoreSync } from "shiki/core";
import type { ThemeRegistration } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";

const light = JSON.parse(readFileSync(new URL("../../tokens/code.light.json", import.meta.url), "utf8")) as ThemeRegistration;
const dark = JSON.parse(readFileSync(new URL("../../tokens/code.dark.json", import.meta.url), "utf8")) as ThemeRegistration;
const highlighter = createHighlighterCoreSync({
  themes: [light, dark],
  langs: [],
  engine: createJavaScriptRegexEngine(),
});

const languages = ["shellscript", "yaml", "markdown"] as const;
await Promise.all(languages.map(async (name) => {
  const load = bundledLanguages[name];
  if (load) highlighter.loadLanguageSync((await load()).default);
}));

const aliases: Record<string, string> = { sh: "shellscript", md: "markdown", yml: "yaml" };
const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/&(?:(amp|lt|gt|quot|apos)|#x([0-9a-f]+)|#(\d+));/gi, (match, name?: string, hex?: string, dec?: string) => {
    if (name) return entities[name.toLowerCase()] ?? match;
    const point = hex ? Number.parseInt(hex, 16) : Number(dec);
    return point <= 0x10ffff ? String.fromCodePoint(point) : match;
  }).replace(/\n$/, "");
}

export function highlightFences(html: string): string {
  return html.replace(/<pre([^>]*)><code(?:\s+class="language-([\w+#-]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_match, attrs: string, language = "text", body: string) => {
    const name = aliases[language] ?? language;
    const lang = highlighter.getLoadedLanguages().includes(name) ? name : "text";
    const highlighted = highlighter.codeToHtml(decode(body), {
      lang,
      themes: { light: "lateen-light", dark: "lateen-dark" },
      defaultColor: false,
    });
    const inner = /<code[^>]*>([\s\S]*)<\/code>/.exec(highlighted)?.[1] ?? "";
    return `<pre class="code-block shiki" tabindex="0" data-lang="${language}"${attrs}><code>${inner}</code></pre>`;
  });
}
