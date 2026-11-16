/*
 * Ask your agent, in the browser: the ask row in the search dialog calls `open`, which builds the
 * prompt from the question and the pages the search found and shows it in a panel. The reader copies
 * it or opens it in an agent they configured; the site itself sends nothing anywhere.
 *
 * The module is pure apart from the small DOM interfaces below, so tests pass a JSDOM document, a
 * fake clipboard, and a fake `fetchText`. Nothing is fetched until the reader ticks "Include page
 * text", and the prompt module owns the page and character limits.
 */

import type { AskConfig } from "./index.ts";
import { buildPrompt, PROMPT_URL_LIMIT, type PromptPage } from "./prompt.ts";
import { twinUrl } from "../copy-markdown/twin.ts";
import type { Clipboard } from "../copy-markdown/island.ts";

/** One search result as the panel needs it: where it is and what the index calls it. */
export interface AskResult {
  readonly url: string;
  readonly title?: string | undefined;
}

/** The parts of an element the panel builds and reads. */
export interface AskElement {
  hidden?: boolean;
  value?: string;
  checked?: boolean;
  textContent?: string | null;
  append(...nodes: unknown[]): void;
  setAttribute(name: string, value: string): void;
  addEventListener?(type: string, listener: (event: AskEvent) => void): void;
  focus?(): void;
}

/** A click or change event as the panel reads it. */
export interface AskEvent {
  preventDefault(): void;
}

/** The document parts the panel uses. */
export interface AskDocument {
  createElement(tag: string): AskElement;
  createTextNode(text: string): unknown;
}

/** Everything the island reads from the world; tests pass a document and fakes. */
export interface AskEnv {
  readonly document: AskDocument;
  /** The empty element the dialog reserves for the panel. */
  readonly root: AskElement;
  readonly config: AskConfig | undefined;
  readonly clipboard?: Clipboard | undefined;
  /** `fetch` as the copy island exposes it: resolves to text and rejects on an HTTP error. */
  readonly fetchText?: ((url: string) => Promise<string>) | undefined;
  /** The page language, which formats the prompt's size. */
  readonly lang?: string | undefined;
}

/** Opens the panel for one question and the results the dialog currently shows. */
export interface AskOpener {
  (question: string, results: readonly AskResult[], container?: AskElement | undefined, focus?: boolean | undefined): void;
}

/** The panel's two actions the dialog drives: open for a question, hide when the dialog closes. */
export interface AskAgent {
  readonly open: AskOpener;
  hide(): void;
}

interface Panel {
  readonly root: AskElement;
  readonly prompt: AskElement;
  readonly size: AskElement;
  readonly status: AskElement;
  readonly providerLinks: { readonly element: AskElement; readonly template: string }[];
  setQuestion(question: string, results: readonly AskResult[]): void;
  apply(): void;
}

/** Fills `{n}` in a pattern without importing the server catalog. */
function fill(pattern: string, value: string): string {
  return pattern.replace(/\{n\}/g, value);
}

/** A number in the page language's digits; an unknown tag keeps Western digits. */
function visibleNumber(lang: string, value: number): string {
  try {
    return new Intl.NumberFormat(lang).format(value);
  } catch {
    return String(value);
  }
}

/**
 * The panel's data, read from the inert JSON the server wrote. Anything missing or shaped
 * differently yields `undefined`, so a bad build cannot break the search dialog.
 */
export function parseAskConfig(text: string | null): AskConfig | undefined {
  if (text === null || text.trim() === "") return undefined;
  try {
    const value = JSON.parse(text) as Partial<AskConfig>;
    const messages = value.messages;
    if (typeof value.site !== "string" || typeof value.markdown !== "boolean") return undefined;
    if (!Array.isArray(value.providers)) return undefined;
    if (typeof value.limits !== "object" || value.limits === null) return undefined;
    if (typeof value.limits.pages !== "number" || typeof value.limits.text !== "number") return undefined;
    if (typeof messages !== "object" || messages === null) return undefined;
    const strings: Readonly<Record<string, unknown>> = messages as unknown as Readonly<Record<string, unknown>>;
    for (const key of [
      "heading",
      "explain",
      "copy",
      "includeText",
      "size",
      "openIn",
      "copied",
      "copyFailed",
      "textFailed",
      "urlTooLong",
      "sectionText",
      "llms",
    ]) {
      if (typeof strings[key] !== "string") return undefined;
    }
    const prompt = strings.prompt;
    if (typeof prompt !== "object" || prompt === null) return undefined;
    const promptStrings: Readonly<Record<string, unknown>> = prompt as Readonly<Record<string, unknown>>;
    for (const key of ["intro", "question", "pages", "markdown", "text", "cutPages", "cutText"]) {
      if (typeof promptStrings[key] !== "string") return undefined;
    }
    if (value.llms !== undefined && typeof value.llms !== "string") return undefined;
    if (value.origin !== undefined && typeof value.origin !== "string") return undefined;
    return value as AskConfig;
  } catch {
    return undefined;
  }
}

/** The panel's elements, built once per container. */
function createPanel(env: AskEnv, config: AskConfig, container: AskElement): Panel {
  const { document } = env;
  const element = (tag: string, className?: string, text?: string): AskElement => {
    const node = document.createElement(tag);
    if (className !== undefined) node.setAttribute("class", className);
    if (text !== undefined) node.append(document.createTextNode(text));
    return node;
  };

  const root = element("section", "ask-agent-panel");
  root.setAttribute("aria-label", config.messages.heading);
  root.append(element("h2", "ask-agent-title", config.messages.heading));
  root.append(element("p", "ask-agent-explain", config.messages.explain));

  const prompt = element("textarea", "ask-agent-prompt");
  prompt.setAttribute("readonly", "");
  prompt.setAttribute("rows", "8");
  prompt.setAttribute("aria-label", config.messages.heading);
  root.append(prompt);

  let include: AskElement | undefined;
  if (config.markdown && env.fetchText !== undefined) {
    const label = element("label", "ask-agent-option");
    include = element("input");
    include.setAttribute("type", "checkbox");
    label.append(include, document.createTextNode(config.messages.includeText));
    root.append(label);
  }

  const size = element("p", "ask-agent-size");
  root.append(size);

  const copy = element("button", "ask-agent-copy", config.messages.copy);
  copy.setAttribute("type", "button");
  root.append(copy);

  const providerLinks: { element: AskElement; template: string }[] = [];
  if (config.providers.length > 0) {
    root.append(element("p", "ask-agent-providers-heading", config.messages.openIn));
    const list = element("ul", "ask-agent-providers");
    for (const provider of config.providers) {
      const item = element("li");
      const link = element("a", "ask-agent-provider", provider.title);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
      item.append(link);
      list.append(item);
      providerLinks.push({ element: link, template: provider.url });
    }
    root.append(list);
  }

  const status = element("p", "ask-agent-status");
  status.setAttribute("role", "status");
  root.append(status);

  container.append(root);

  let question = "";
  let results: readonly AskResult[] = [];
  let includeText = false;
  const texts = new Map<string, string>();

  /** The published address of a result, absolute when the site names its origin. */
  const addressOf = (result: AskResult): string =>
    /^https?:\/\//i.test(result.url) || config.origin === undefined ? result.url : `${config.origin}${result.url}`;

  /** The prompt's pages: title, address, Markdown twin, and any text the reader asked for. */
  const pagesOf = (): PromptPage[] =>
    results.map((result) => {
      const url = addressOf(result);
      const markdown = config.markdown ? twinUrl(url) : undefined;
      const text = includeText ? texts.get(result.url) : undefined;
      return {
        title: result.title?.trim() === "" || result.title === undefined ? result.url : result.title,
        url,
        ...(markdown === undefined ? {} : { markdown }),
        ...(text === undefined ? {} : { text }),
      };
    });

  const expanded = (template: string, promptText: string): string =>
    template.replace(/\{prompt\}/g, () => encodeURIComponent(promptText));

  /** Rebuilds the prompt and everything that shows it. */
  const apply = (): void => {
    const siteIndex =
      config.llms === undefined
        ? undefined
        : config.origin === undefined || /^https?:\/\//i.test(config.llms)
          ? config.llms
          : `${config.origin}${config.llms}`;
    const built = buildPrompt({
      site: config.site,
      question,
      pages: pagesOf(),
      strings: config.messages.prompt,
      pageLimit: config.limits.pages,
      textLimit: config.limits.text,
      ...(siteIndex === undefined ? {} : { siteIndex }),
    });
    prompt.value = built.prompt;
    size.textContent = fill(config.messages.size, visibleNumber(env.lang ?? "en", built.prompt.length));
    for (const link of providerLinks) link.element.setAttribute("href", expanded(link.template, built.prompt));
  };

  /** Copies the prompt; the status region says whether it worked. */
  const copyPrompt = (): void => {
    const clipboard = env.clipboard;
    if (clipboard === undefined) {
      status.textContent = config.messages.copyFailed;
      return;
    }
    status.textContent = "";
    clipboard.writeText(prompt.value ?? "").then(
      () => {
        status.textContent = config.messages.copied;
      },
      () => {
        status.textContent = config.messages.copyFailed;
      },
    );
  };

  /** Fetches the Markdown twin of every shown page, in order, until the text limit is reached. */
  const loadText = (): void => {
    const fetchText = env.fetchText;
    if (fetchText === undefined) return;
    let taken = 0;
    for (const result of results.slice(0, config.limits.pages)) taken += texts.get(result.url)?.length ?? 0;
    let chain = Promise.resolve();
    for (const result of results.slice(0, config.limits.pages)) {
      const url = addressOf(result);
      const markdown = twinUrl(url);
      if (markdown === undefined || texts.has(result.url)) continue;
      chain = chain.then(() => {
        if (taken >= config.limits.text) return;
        return fetchText(markdown).then(
          (text) => {
            taken += text.length;
            texts.set(result.url, text);
          },
          () => {
            status.textContent = config.messages.textFailed;
          },
        );
      });
    }
    void chain.then(() => apply());
  };

  copy.addEventListener?.("click", () => copyPrompt());
  include?.addEventListener?.("change", () => {
    includeText = include.checked === true;
    if (includeText) loadText();
    else apply();
  });
  for (const link of providerLinks) {
    link.element.addEventListener?.("click", (event) => {
      const href = expanded(link.template, prompt.value ?? "");
      if (href.length <= PROMPT_URL_LIMIT) return;
      event.preventDefault();
      const clipboard = env.clipboard;
      if (clipboard !== undefined) void clipboard.writeText(prompt.value ?? "").catch(() => undefined);
      status.textContent = config.messages.urlTooLong;
    });
  }

  return {
    root,
    prompt,
    size,
    status,
    providerLinks,
    apply,
    setQuestion(nextQuestion: string, nextResults: readonly AskResult[]): void {
      question = nextQuestion;
      results = nextResults;
    },
  };
}

/**
 * Wires the panel and returns the opener the search dialog calls. A page with no readable config
 * gets `undefined`, so the dialog draws no ask row and search keeps working.
 */
export function activateAskAgent(env: AskEnv): AskAgent | undefined {
  const config = env.config;
  if (config === undefined) return undefined;
  const panels = new WeakMap<AskElement, Panel>();

  const panelFor = (container: AskElement): Panel => {
    let panel = panels.get(container);
    if (panel === undefined) {
      panel = createPanel(env, config, container);
      panels.set(container, panel);
    }
    return panel;
  };

  return {
    open(question, results, container, focus = true) {
      const target = container ?? env.root;
      const panel = panelFor(target);
      panel.setQuestion(question.trim(), results);
      target.hidden = false;
      panel.apply();
      if (focus) panel.prompt.focus?.();
    },
    hide() {
      env.root.hidden = true;
    },
  };
}
