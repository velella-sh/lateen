import { ensureContrast } from "./color.ts";

export const SYNTAX_MODES = ["light", "dark"] as const;

export interface CodeBackdrops {
  readonly light: string;
  readonly dark: string;
}

export function syntaxColor(color: string, backdrop: string): string {
  return ensureContrast(color, backdrop, 4.5);
}

/** Corrects the hex values Shiki emits. Values such as `inherit` keep their CSS behavior. */
export function adjustShiki(html: string, backdrops: CodeBackdrops | undefined): string {
  if (backdrops === undefined) return html;
  return html.replace(/--shiki-(light|dark):(#[0-9a-fA-F]{6})/g, (_, mode: keyof CodeBackdrops, color: string) =>
    `--shiki-${mode}:${syntaxColor(color, backdrops[mode])}`);
}
