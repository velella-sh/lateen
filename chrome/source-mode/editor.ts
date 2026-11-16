/*
 * Open a block in a local editor. The site gives a URL template in `theme.options.sourceMode.editor` with
 * `{path}`, `{line}` and `{column}`; the reader gives the folder of their checkout once, kept in local
 * storage, and `{path}` is that folder plus the block's file. No DOM and no imports beyond a path helper, so
 * the page chrome and the browser island share it.
 *
 * Scheme allowlist: a template is used only when its scheme is one of `EDITOR_SCHEMES`, the registered URL
 * handlers of common editors. Web schemes and anything that runs script (`http`, `https`, `javascript`,
 * `data`, `file`) are rejected, so a config value can never turn the link into anything but an editor
 * handoff. To support another editor, add its scheme here.
 */

import { encodePath } from "../../src/repository.ts";
import type { SourceModeStorage } from "./state.ts";

/** The URL schemes an editor template may use. */
export const EDITOR_SCHEMES: readonly string[] = [
  "vscode",
  "vscode-insiders",
  "vscodium",
  "cursor",
  "windsurf",
  "zed",
  "idea",
  "pycharm",
  "webstorm",
  "phpstorm",
  "goland",
  "rubymine",
  "clion",
  "rider",
  "subl",
  "txmt",
  "emacs",
  "mvim",
  "nova",
];

/** localStorage key for the reader's checkout folder. */
export const SOURCE_FOLDER_KEY = "lateen-source-folder";

/** The scheme of a template (lower case, no colon), or `undefined` when it has none. */
export function schemeOf(template: string): string | undefined {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(template.trim());
  return match?.[1]?.toLowerCase();
}

/** The template when its scheme is allowed and it has a `{path}`; anything else is `undefined`. */
export function acceptEditorTemplate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const template = value.trim();
  const scheme = schemeOf(template);
  if (scheme === undefined || !EDITOR_SCHEMES.includes(scheme)) return undefined;
  return template.includes("{path}") ? template : undefined;
}

/** The saved checkout folder, trimmed; missing, refusing or empty storage reads as unset. */
export function readFolder(storage: SourceModeStorage | undefined): string | undefined {
  try {
    const value = storage?.getItem(SOURCE_FOLDER_KEY)?.trim();
    return value === undefined || value === "" ? undefined : value;
  } catch {
    return undefined;
  }
}

/** Remembers the folder (or clears it with an empty value). Returns false when storage refused. */
export function saveFolder(storage: SourceModeStorage | undefined, folder: string): boolean {
  try {
    if (storage === undefined) return false;
    storage.setItem(SOURCE_FOLDER_KEY, folder.trim());
    return true;
  } catch {
    return false;
  }
}

/** The editor URL for a file position, or `undefined` while the folder is unset or the template unusable. */
export function editorUrl(
  template: string | undefined,
  folder: string | undefined,
  file: string,
  line: number,
  column: number,
): string | undefined {
  const accepted = acceptEditorTemplate(template);
  if (accepted === undefined || folder === undefined || folder.trim() === "") return undefined;
  const joined = `${folder.trim().replace(/\\/g, "/").replace(/\/+$/, "")}/${file.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "").replace(/^\/+/, "")}`;
  return accepted
    .replaceAll("{path}", encodePath(joined))
    .replaceAll("{line}", String(line))
    .replaceAll("{column}", String(column));
}
