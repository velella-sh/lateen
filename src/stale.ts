import type { ComponentChildren } from "preact";
import type { LayoutProps, PageStaleFile, Site } from "@velella/mizzen/contracts";
import staleNotice from "../components/stale-notice/index.ts";
import { editUrlOf } from "../chrome/edit-page/index.ts";
import { providersOf, SAFE_SCHEME } from "../chrome/page-agent-menu/providers.ts";

/** A provider template that takes a prompt and nothing else this unit cannot fill. */
const PROMPT_ONLY = /\{(?!prompt\})[a-z]+\}/;

/** The edit link a stale page offers, when the site names a repository. */
function editUrlOfPage(props: LayoutProps): string | undefined {
  const repository = props.site.config.repository;
  return repository === undefined ? undefined : editUrlOf(repository, props.page.source.file);
}

/** The changed files in one sentence, for an agent that takes a prompt. */
function promptOf(site: Site, title: string, url: string, files: readonly PageStaleFile[]): string {
  const changed = files.map((file) => `${file.path} (${file.change})`).join(", ");
  return `The page "${title}" (${site.config.url}${url}) may be out of date. These files changed since its last review: ${changed}. Please review the page and update it.`;
}

/** The first configured agent that takes a prompt, with the changed files filled in. */
function agentUrlOf(props: LayoutProps): string | undefined {
  const stale = props.page.stale;
  if (stale === undefined) return undefined;
  const prompt = encodeURIComponent(
    promptOf(props.site, props.page.title, props.page.url, stale.files),
  );
  for (const provider of providersOf(props.site.config)) {
    if (!provider.url.includes("{prompt}") || PROMPT_ONLY.test(provider.url)) continue;
    const href = provider.url.replace("{prompt}", prompt);
    if (SAFE_SCHEME.test(href)) return href;
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
  const editUrl = editUrlOfPage(props);
  const agentUrl = agentUrlOf(props);
  return staleNotice({
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
