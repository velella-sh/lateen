import type { SiteConfig } from "@velella/mizzen/contracts";
import { isRecord } from "../../src/guards.ts";
import { optionOf } from "../../src/options.ts";
import { toneOf, type StatusTone } from "./index.ts";

/**
 * One data value as the site maps it: a tone and a label, either one string for every language or a
 * table from language to text. The theme ships no default values: every site names its own.
 */
export type StatusValue = { tone?: unknown; label?: unknown; description?: unknown };

/** What a rendered status shows for a data value. */
export type ResolvedStatus = { tone: StatusTone; label: string };

/** The `theme.options.status.values` map as the config wrote it, or undefined when the site has none. */
export function valuesOf(config: Pick<SiteConfig, "theme"> | undefined): Record<string, unknown> | undefined {
  const options = optionOf(config?.theme?.options, "status");
  if (!isRecord(options) || !isRecord(options.values)) return undefined;
  return options.values;
}

/** The label for a language: its own text, then its primary subtag (`fa-IR` reads `fa`), then English. */
export function labelOf(label: unknown, lang: string): string | undefined {
  if (typeof label === "string") return label.trim() === "" ? undefined : label;
  if (!isRecord(label)) return undefined;
  const code = lang.toLowerCase();
  for (const key of [lang, code, code.split("-")[0] ?? "", "en"]) {
    const text = label[key];
    if (typeof text === "string" && text.trim() !== "") return text;
  }
  return undefined;
}

/**
 * The tone and label for a data value. A value the map has no entry for (or a site with no map)
 * shows the raw value with the `neutral` tone. A mapped entry with no label for the language shows
 * the raw value in the mapped tone.
 */
export function resolveStatus(
  value: string,
  lang: string,
  config: Pick<SiteConfig, "theme"> | undefined,
): ResolvedStatus {
  const values = valuesOf(config);
  const entry = values !== undefined && Object.hasOwn(values, value) ? values[value] : undefined;
  if (!isRecord(entry)) return { tone: "neutral", label: value };
  return { tone: toneOf(entry.tone), label: labelOf(entry.label, lang) ?? value };
}
