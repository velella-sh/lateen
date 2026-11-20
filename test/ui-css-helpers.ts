// The sailcloth source is split into styles/src modules (#863). Source tests read
// one sheet through here: ui.css with its local @import modules inlined in import
// order — the same cascade Tailwind compiles into styles/generated.css.
import { readFileSync } from "node:fs";

const ENTRY = new URL("../styles/src/ui.css", import.meta.url);
const LOCAL_IMPORT = /@import\s+"(\.[^"]+)"\s*;/g;

/** The full sailcloth source text, modules inlined in import order. */
export function readUiCss(): string {
  const inline = (url: URL): string =>
    readFileSync(url, "utf8").replace(LOCAL_IMPORT, (_match, path: string) => inline(new URL(path, url)));
  return inline(ENTRY);
}