import type { Page, SiteConfig } from "@velella/mizzen/contracts";
import { t } from "../i18n/index.ts";
import { recordFileOf } from "./data-source.ts";
import { textOf } from "./guards.ts";

export function agentSource(page: Page): string | undefined {
  return textOf(page.frontMatter.agent?.source);
}

export function agentNotes(page: Page): string {
  const notes = textOf(page.frontMatter.agent?.notes);
  return notes === undefined ? "" : `\n${notes}`;
}

/**
 * Whether the page offers an edit prompt: not when it opts out, and not when it is a record whose data comes
 * from an API or a database, where there is no file to name.
 */
export function canEditPage(config: SiteConfig, page: Page): boolean {
  if (page.frontMatter.agent?.edit === false) return false;
  return page.record === undefined || agentSource(page) !== undefined || recordFileOf(config, page) !== undefined;
}

export function editPrompt(page: Page, config: SiteConfig): string {
  const version = textOf(page.frontMatter.version);
  const record = recordFileOf(config, page);
  const where = record === undefined ? `${page.source.file}:${page.source.line}` : record.start === undefined ? record.file : `${record.file}:${record.start}`;
  const file = agentSource(page) ?? where;
  const source = version === undefined ? file : `${file} (${page.lang}, ${version})`;
  return t(page.lang, "edit_prompt", { source, text: page.title }) + agentNotes(page);
}
