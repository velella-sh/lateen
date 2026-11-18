/*
 * Ask your agent: the search dialog offers a prompt built from the reader's question and the pages
 * the site published, and the reader copies it or opens it in an agent they already use. The theme
 * sends nothing anywhere; the panel is built in the browser from the JSON this unit writes into the
 * search dialog.
 *
 * The visible row belongs to the search dialog's one listbox (`chrome/search/client.ts`); this unit
 * only publishes the panel's data and, on the search results page, a static section that works
 * without JavaScript. `chrome/ask-agent/client.ts` reads both.
 */

import { h } from "preact";
import type { Chrome, ChromeProps, SiteConfig } from "@velella/mizzen/contracts";
import { patternOf, t } from "../../i18n/index.ts";
import { providersOf, originOf, SAFE_SCHEME, type Provider } from "../page-agent-menu/providers.ts";
import { PAGE_LIMIT, TEXT_LIMIT, type PromptStrings } from "./prompt.ts";

/** Marks the inert JSON inside the search dialog; the panel island reads it once. */
export const ASK_AGENT_ATTRIBUTE = "data-ask-agent-config";

/** The panel's wording in the page language. */
export interface AskMessages {
  readonly heading: string;
  readonly explain: string;
  readonly copy: string;
  readonly includeText: string;
  readonly size: string;
  readonly openIn: string;
  readonly copied: string;
  readonly copyFailed: string;
  readonly textFailed: string;
  readonly urlTooLong: string;
  readonly sectionText: string;
  readonly llms: string;
  readonly prompt: PromptStrings;
}

/** Everything the browser needs to build the panel, without fetching a catalog at run time. */
export interface AskConfig {
  readonly site: string;
  /** Whether the site publishes Markdown twins, so the prompt may name them and fetch their text. */
  readonly markdown: boolean;
  /** Whether the site publishes page JSON, so the prompt may name it for record pages. */
  readonly pageJson: boolean;
  /** The site's origin and path, so page addresses in the prompt are absolute. */
  readonly origin?: string | undefined;
  /** The published `llms.txt`, when the site writes it. */
  readonly llms?: string | undefined;
  /** The configured providers whose URL takes `{prompt}`. */
  readonly providers: readonly Provider[];
  readonly limits: { readonly pages: number; readonly text: number };
  readonly messages: AskMessages;
}

/** A placeholder a provider template may use; anything else cannot be filled from a question. */
const PROMPT_PLACEHOLDER = "{prompt}";
const OTHER_PLACEHOLDER = /\{(?!prompt\})[a-z]+\}/;

/** The site base without a trailing slash, `""` at a domain root. */
function baseOf(config: SiteConfig): string {
  return config.base.replace(/\/+$/, "");
}

/** Whether an output is on; every output is on unless the site turns it off by name. */
function publishes(config: SiteConfig, name: string): boolean {
  return config.outputs[name] !== false;
}

/** The configured providers that can take a prompt and nothing else. */
function promptProviders(config: SiteConfig): readonly Provider[] {
  return providersOf(config).filter(
    (provider) => provider.url.includes(PROMPT_PLACEHOLDER) && !OTHER_PLACEHOLDER.test(provider.url) && SAFE_SCHEME.test(provider.url),
  );
}

/** The wording of the panel and the prompt in the page language. */
function messagesOf(lang: string): AskMessages {
  return {
    heading: t(lang, "ask_agent_heading"),
    explain: t(lang, "ask_agent_explain"),
    copy: t(lang, "ask_agent_copy"),
    includeText: t(lang, "ask_agent_include_text"),
    size: patternOf(lang, "ask_agent_size"),
    openIn: t(lang, "page_agent_open_in"),
    copied: t(lang, "copied"),
    copyFailed: t(lang, "search_copy_failed"),
    textFailed: t(lang, "ask_agent_text_failed"),
    urlTooLong: t(lang, "ask_agent_url_too_long"),
    sectionText: t(lang, "ask_agent_section_text"),
    llms: t(lang, "ask_agent_llms"),
    prompt: {
      intro: patternOf(lang, "ask_agent_prompt_intro"),
      question: patternOf(lang, "ask_agent_prompt_question"),
      pages: t(lang, "ask_agent_prompt_pages"),
      markdown: t(lang, "ask_agent_prompt_markdown"),
      json: t(lang, "ask_agent_prompt_json"),
      siteIndex: patternOf(lang, "ask_agent_prompt_site"),
      text: t(lang, "ask_agent_prompt_text"),
      cutPages: patternOf(lang, "ask_agent_prompt_cut_pages"),
      cutText: patternOf(lang, "ask_agent_prompt_cut_text"),
    },
  };
}

/** The panel's data for a page: no DOM, no clock, and nothing the site did not publish. */
export function askConfig(props: ChromeProps): AskConfig {
  const { site, page } = props;
  const markdown = publishes(site.config, "twins");
  const pageJson = publishes(site.config, "page-json");
  const llms = publishes(site.config, "llms") ? `${baseOf(site.config)}/llms.txt` : undefined;
  const origin = originOf(site.config);
  return {
    site: site.config.title,
    markdown,
    pageJson,
    ...(origin === undefined ? {} : { origin }),
    ...(llms === undefined ? {} : { llms }),
    providers: promptProviders(site.config),
    limits: { pages: PAGE_LIMIT, text: TEXT_LIMIT },
    messages: messagesOf(page.lang),
  };
}

/** JSON safe inside a `<script>` element: a `<` can never close the tag early. */
export function askJson(config: AskConfig): string {
  return JSON.stringify(config).replace(/</g, "\\u003c");
}

/**
 * The panel's data as one inert JSON script, placed inside the search dialog by
 * `chrome/search/index.ts`. Nothing appears without JavaScript, and a reader never sees the script.
 */
const askAgent: Chrome = (props) =>
  h("script", {
    type: "application/json",
    [ASK_AGENT_ATTRIBUTE]: "",
    dangerouslySetInnerHTML: { __html: askJson(askConfig(props)) },
  });

export default askAgent;

/**
 * The search results page's static section: what asking your agent does, and the site's own
 * `llms.txt` when it publishes one. Without JavaScript this is the whole answer; with it,
 * `chrome/ask-agent/client.ts` adds the panel for the page's query. A site that publishes no
 * Markdown twins has no prompt to offer here, so the section stays out.
 */
export function askAgentSection(props: ChromeProps): unknown {
  if (!publishes(props.site.config, "twins")) return null;
  const config = askConfig(props);
  return h(
    "section",
    { class: "ask-agent-section", "data-ask-agent-section": "" },
    h("h2", { class: "ask-agent-section-title" }, config.messages.heading),
    h("p", { class: "ask-agent-section-text" }, config.messages.sectionText),
    config.llms === undefined
      ? null
      : h("p", { class: "ask-agent-section-link" }, h("a", { href: config.llms }, config.messages.llms)),
  );
}
