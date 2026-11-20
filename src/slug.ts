/**
 * The Unicode-safe text normalization that every id generator in the theme starts from. No DOM, no
 * state: each generator keeps its own trimming, case, and dash-collapse policy, because its existing
 * anchors depend on it, and calls these rules for the part they share.
 */

/**
 * The rule the id generators share: each run of characters that cannot appear in an id becomes one
 * `-`. Unicode letters and numbers survive, and `-` and `_` are kept, so an author's id in any script
 * stays a stable fragment and cannot break the markup.
 */
export function idChars(value: string): string {
  return value.replace(/[^\p{L}\p{N}_-]+/gu, "-");
}

/** A lower-case anchor from a heading or step title: letters and numbers, runs of others become `-`. */
export function headingSlug(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}
