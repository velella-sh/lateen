# Ask your agent

Lateen lets a reader hand a question to an agent they already use. The search dialog builds a
prompt in the reader's browser from the question and the pages the site published; the reader copies
it or opens it in a configured agent. No server answers the question, and the site sends nothing
anywhere.

## The flow

1. The reader types a question of at least two words into search. The list shows the page results,
   the page's actions, and then one **Ask your agent about “…”** row.
2. Choosing the row opens a panel in the same dialog with the prompt in a read-only text area, the
   prompt's size, a **Copy prompt** button, an optional **Include page text** switch, and the agents
   the site configured.
3. The reader copies the prompt, or follows an agent link that carries the prompt in its address.
   The agent does the work outside the site.

The search results page offers the same panel under its results, so a reader who never opens the
dialog can still copy a prompt. The page's static section explains the feature and links
`llms.txt` when the site publishes it; without JavaScript the section is the whole answer.

## The prompt

The prompt is plain text, in the page language:

```
You are helping me with a question about the {site} documentation.

Question: {question}

Related pages:
- {title} — {url} (Markdown: {markdown})
- …

Site index: {llms}

Page text:

### {title}
{the page's Markdown text}
```

The question is kept as the reader typed it apart from trimming. Each page contributes its title,
its address, and its Markdown twin when the site publishes twins. The site index line appears only
when the site publishes `llms.txt`, and its address is absolute when the site names its origin. Page text comes only from the
page's twin and only after the reader turns **Include page text** on.

Nothing is escaped and nothing is added that the reader did not type or the site did not publish: the
prompt is text a person reads, never markup and never a command the site invented.

## Limits

| Limit | Value | What happens |
| --- | --- | --- |
| Related pages | 5 | The prompt states that only the first five pages are included. |
| Page text | 12,000 characters | Text is cut at the limit and the prompt names the pages that were left out. |
| Agent link | 8,000 characters | The link is not opened; the prompt is copied instead and the panel says why. |

The page limit keeps the prompt useful to an agent that reads a question, not a site. The text limit
bounds what a link can carry in one address. The size of the prompt is shown in the panel before the
reader copies it.

## Privacy

- The site sends nothing: no analytics call, no prompt upload, no query to an AI service.
- The prompt is built in the browser from the search index the site already ships.
- Page text is fetched from the site's own Markdown twins, and only after the reader turns the option
  on. Turning it off fetches nothing.
- Following an agent link hands the prompt to that agent's site, exactly as typing it there would.
  The reader chooses the agent; Lateen ships no provider and runs no answer service.

## Providers

The agents in the panel are the site's own `theme.options.pageAgent.providers`. A provider joins the
ask panel only when its URL template contains `{prompt}` and no other placeholder, so a link is never
half-filled:

```yaml
theme:
  options:
    pageAgent:
      providers:
        - title: Claude
          url: "https://claude.ai/new?q={prompt}"
```

The page agent menu keeps using providers that take `{markdown}`; a provider that takes `{prompt}`
is left out of that menu instead of receiving an empty value. A site with no prompt provider gets
the copy button and no agent links.
