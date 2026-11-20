/** The language tag's name in `lang`, or the tag itself when the runtime has no name for it. */
export function languageName(tag: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
