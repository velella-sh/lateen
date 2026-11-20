import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { languageEntries, switcherLabels } from "./model.ts";

export type { LanguageEntry, SwitcherLabels, SwitcherLanguage } from "./model.ts";
export {
  alternateLinks,
  canonicalLink,
  guidanceOf,
  hrefFor,
  languageEntries,
  pagePaths,
  resolvedLanguages,
  switcherLabels,
} from "./model.ts";

/**
 * The language switcher: one entry per configured language, each to the page the site really builds
 * in that language. The interface guidance - the landmark, the current word, and the missing-translation
 * text - is read in `page.lang`, the language of the page being read, so a page rendered in another
 * configured language never shows the site default's guidance; regional tags use their catalog by
 * primary subtag. The current language opens the page itself and is marked with `aria-current` plus
 * a visible word, never colour alone. A translation that does not exist is not guessed from the URL:
 * a language served by a fallback opens that page and names the language it really shows, and a
 * language with no page at all is plain text with the reason a screen reader announces. Page URLs
 * come from the model, so `base`, version segments, and `translation_key` routes are kept exactly.
 * `_data/languages.yml` may override any link through its `alternates` map (see the README). Links are
 * plain anchors, so the switcher works without JavaScript; the reader's theme already carries across
 * languages because every language lives on the same origin and `THEME_KEY` is origin-wide.
 */
const languageSwitcher: Chrome = ({ site, page }) => {
  const entries = languageEntries(site, page);
  if (entries.length < 2) return null;

  const labels = switcherLabels(page);

  return h(
    "nav",
    { class: "language-switcher", "aria-label": labels.label, "data-language-switcher": true },
    h(
      "ul",
      { class: "language-switcher-list" },
      ...entries.map((entry) => {
        const language = entry.language;
        const classes = ["language-switcher-item"];
        if (entry.state === "current") classes.push("language-switcher-item--current");

        if (entry.state === "missing") {
          return h(
            "li",
            { class: classes.join(" "), "data-language-state": entry.state },
            h(
              "span",
              {
                class: "language-switcher-link language-switcher-link--unavailable",
                lang: language.code,
                "aria-disabled": "true",
              },
              h("span", { class: "language-switcher-name", dir: "auto" }, language.name),
              h("span", { class: "language-switcher-state", "aria-hidden": "true" }, "—"),
              h("span", { class: "language-switcher-sr", lang: labels.lang, dir: labels.dir }, labels.unavailable),
            ),
          );
        }

        return h(
          "li",
          { class: classes.join(" "), "data-language-state": entry.state },
          h(
            "a",
            {
              class: entry.state === "fallback" ? "language-switcher-link language-switcher-link--fallback" : "language-switcher-link",
              href: entry.href,
              hreflang: entry.actual?.code ?? language.code,
              lang: language.code,
              "aria-current": entry.state === "current" ? "true" : undefined,
            },
            h("span", { class: "language-switcher-name", dir: "auto" }, language.name),
            entry.actual === undefined
              ? null
              : h("span", { class: "language-switcher-sr", lang: labels.lang, dir: labels.dir }, labels.unavailable),
            entry.state === "current"
              ? h("span", { class: "language-switcher-current", lang: labels.lang, dir: labels.dir }, ` (${labels.current})`)
              : null,
            entry.actual === undefined
              ? null
              : h("span", { class: "language-switcher-state", lang: entry.actual.code, dir: "auto" }, ` (${entry.actual.name})`),
          ),
        );
      }),
    ),
  );
};

export default languageSwitcher;