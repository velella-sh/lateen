import type { Page } from "@velella/mizzen/contracts";
import { t } from "../i18n/index.ts";
import { textOf } from "./guards.ts";

export function agentSource(page: Page): string | undefined {
  return textOf(page.frontMatter.agent?.source);
}

export function agentNotes(page: Page): string {
  const notes = textOf(page.frontMatter.agent?.notes);
  return notes === undefined ? "" : `\n${notes}`;
}

export function editPrompt(page: Page): string {
  const version = textOf(page.frontMatter.version);
  const file = agentSource(page) ?? `${page.source.file}:${page.source.line}`;
  const source = version === undefined ? file : `${file} (${page.lang}, ${version})`;
  return t(page.lang, "edit_prompt", { source, text: page.title }) + agentNotes(page);
}
