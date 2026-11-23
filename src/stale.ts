import type { ComponentChildren } from "preact";
import type { LayoutProps, PageStaleFile } from "@velella/mizzen/contracts";
import staleNotice from "../components/stale-notice/index.ts";
import { editHref } from "../chrome/edit-page/index.ts";
import { providersOf, safeAgentHref } from "../chrome/page-agent-menu/providers.ts";
import { agentNotes, agentSource } from "./agent.ts";
import { t } from "../i18n/index.ts";

/** A provider template that takes a prompt and nothing else this unit cannot fill. */
const PROMPT_ONLY = /\{(?!prompt\})[a-z]+\}/;

/** The changed files in one sentence, for an agent that takes a prompt. */
function promptOf({ page, site }: LayoutProps, files: readonly PageStaleFile[]): string {
  const changed = files.map(({ path, change }) => `${path} (${t(page.lang, `stale_${change}`)})`).join(`${t(page.lang, "comma")} `);
  const url = `${site.config.url ?? ""}${page.url}`;
  const base = t(page.lang, "stale_agent_prompt", { title: page.title, url, changed });
  const source = agentSource(page);
  const instruction = source === undefined ? "" : `\n${t(page.lang, "stale_agent_source", { source })}`;
  return base + instruction + agentNotes(page);
}

/** The first configured agent that takes a prompt, with the changed files filled in. */
function agentUrlOf(props: LayoutProps): string | undefined {
  const stale = props.page.stale;
  if (stale === undefined || props.page.frontMatter.agent?.edit === false) return undefined;
  const prompt = encodeURIComponent(promptOf(props, stale.files));
  for (const provider of providersOf(props.site.config)) {
    if (!provider.url.includes("{prompt}") || PROMPT_ONLY.test(provider.url)) continue;
    const href = safeAgentHref(provider.url.replace("{prompt}", prompt));
    if (href !== undefined) return href;
  }
  return undefined;
}

/**
 * The one place the article layouts place the stale notice: under the title. A page without `stale`
 * gets nothing, and `theme.options.stale.show` stays the component's decision, so the layouts never
 * repeat its markup or its rules. The notice's actions come from the page's edit link and the first
 * agent provider that takes a prompt, so a site without either keeps the note alone.
 */
export function staleSlot(props: LayoutProps): ComponentChildren {
  if (props.page.stale === undefined) return null;
  const editUrl = editHref(props.site, props.page);
  const agentUrl = agentUrlOf(props);
  return staleNotice({
    inline: false, renderComponent: props.renderComponent,
    props: {
      stale: props.page.stale,
      ...(props.site.config.repository === undefined ? {} : { repository: props.site.config.repository }),
      ...(editUrl === undefined ? {} : { editUrl }),
      ...(agentUrl === undefined ? {} : { agentUrl }),
    },
    page: props.page,
    site: props.site,
    html: "",
  }) as ComponentChildren;
}
