/*
 * The prompt the reader hands to their own agent: plain text, built from the question they typed and
 * the pages the site already published. The module touches no DOM and reads no clock, so the same
 * question and pages always give the same prompt and the server can test it without a browser.
 *
 * Nothing is escaped and nothing is added that the reader did not type or the site did not publish:
 * the prompt is text a person reads, not markup.
 */

/** Most related pages a prompt names; the search ranks them, and the top of the list is what helps. */
export const PAGE_LIMIT = 5;

/** Most characters of page text a prompt carries; an agent reads a question, not a whole site. */
export const TEXT_LIMIT = 12000;

/** Most characters of a provider URL; longer links are copied instead of opened. */
export const PROMPT_URL_LIMIT = 8000;

/** One page the prompt may mention: its title, address, Markdown twin, and fetched text. */
export interface PromptPage {
  readonly title: string;
  readonly url: string;
  /** The page's Markdown twin, when the site publishes one. */
  readonly markdown?: string | undefined;
  /** The page's Markdown text, when the reader asked to include it. */
  readonly text?: string | undefined;
}

/** The wording of a prompt in the page language. */
export interface PromptStrings {
  /** "You are helping me with a question about the {site} documentation." */
  readonly intro: string;
  /** "Question: {question}" */
  readonly question: string;
  /** "Related pages:" */
  readonly pages: string;
  /** "Markdown" */
  readonly markdown: string;
  /** "Site index: {llms}" */
  readonly siteIndex: string;
  /** "Page text:" */
  readonly text: string;
  /** "Only the first {n} related pages are included." */
  readonly cutPages: string;
  /** "The page text was cut at {n} characters; left out: {pages}." */
  readonly cutText: string;
}

/** The English wording, used when the page carries none. */
export const DEFAULT_STRINGS: PromptStrings = {
  intro: "You are helping me with a question about the {site} documentation.",
  question: "Question: {question}",
  pages: "Related pages:",
  markdown: "Markdown",
  siteIndex: "Site index: {llms}",
  text: "Page text:",
  cutPages: "Only the first {n} related pages are included.",
  cutText: "The page text was cut at {n} characters; left out: {pages}.",
};

/** What building a prompt reads. */
export interface PromptInput {
  /** The site name, so an agent knows whose pages it is reading. */
  readonly site: string;
  /** The reader's question, kept as typed apart from trim. */
  readonly question: string;
  /** The related pages, in the order the search ranked them. */
  readonly pages: readonly PromptPage[];
  /** The site's published `llms.txt`, when it writes one. */
  readonly siteIndex?: string | undefined;
  readonly strings?: PromptStrings | undefined;
  readonly pageLimit?: number | undefined;
  readonly textLimit?: number | undefined;
}

/** The prompt and what was left out of it, so the panel can show the same limits the prompt states. */
export interface BuiltPrompt {
  readonly prompt: string;
  /** The pages the prompt names, after the page limit. */
  readonly pages: readonly PromptPage[];
  /** How many ranked pages the page limit left out. */
  readonly cutPages: number;
  /** Whether the text limit left out some page text. */
  readonly cutText: boolean;
}

/** Fills `{name}` placeholders in one pass; a missing value stays as written. */
function fill(pattern: string, values: Readonly<Record<string, string | number>>): string {
  return pattern.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

/** The page title, or its address when the index carries none. */
function titleOf(page: PromptPage): string {
  const title = page.title.trim();
  return title === "" ? page.url : title;
}

/**
 * Builds the prompt: the question, the pages with their addresses and Markdown twins, and — when the
 * reader asked — the pages' text up to the text limit. Every limit that cut something is stated in
 * the prompt itself, so an agent never reads a silently shortened list.
 */
export function buildPrompt(input: PromptInput): BuiltPrompt {
  const strings = input.strings ?? DEFAULT_STRINGS;
  const pageLimit = input.pageLimit ?? PAGE_LIMIT;
  const textLimit = input.textLimit ?? TEXT_LIMIT;
  const pages = input.pages.slice(0, Math.max(0, pageLimit));
  const cutPages = input.pages.length - pages.length;
  const lines: string[] = [fill(strings.intro, { site: input.site.trim() }), ""];
  const question = input.question.trim();
  if (question !== "") lines.push(fill(strings.question, { question }), "");

  if (pages.length > 0) {
    lines.push(strings.pages);
    for (const page of pages) {
      const twin =
        page.markdown === undefined || page.markdown === ""
          ? ""
          : ` (${strings.markdown}: ${page.markdown})`;
      lines.push(`- ${titleOf(page)} — ${page.url}${twin}`);
    }
    if (cutPages > 0) lines.push("", fill(strings.cutPages, { n: pages.length }));
    lines.push("");
  }

  if (input.siteIndex !== undefined && input.siteIndex !== "") {
    lines.push(fill(strings.siteIndex, { llms: input.siteIndex }), "");
  }

  let remaining = textLimit;
  let cutText = false;
  const leftOut: string[] = [];
  const written: string[] = [];
  for (const page of pages) {
    const text = page.text;
    if (text === undefined || text === "") continue;
    if (remaining <= 0) {
      cutText = true;
      leftOut.push(titleOf(page));
      continue;
    }
    const kept = text.slice(0, remaining);
    if (kept.length < text.length) {
      cutText = true;
      leftOut.push(titleOf(page));
    }
    remaining -= kept.length;
    written.push(`### ${titleOf(page)}`, kept, "");
  }

  if (written.length > 0) {
    lines.push(strings.text, "", ...written);
  }
  if (cutText) {
    lines.push(fill(strings.cutText, { n: textLimit, pages: leftOut.join(", ") }), "");
  }

  return { prompt: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n", pages, cutPages, cutText };
}
