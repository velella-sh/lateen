# Data explorer

The `data-explorer` component lets a reader search, filter, and sort the records of one collection
in the page, without a server. It reads the compact index the engine writes under `data/`, and it
never searches page bodies. This note fixes the rules the `data-explorer` epic (#384, #283 to #293)
follows and the numbers its tests use.

The explorer is **not** the site search. `chrome/search` keeps searching pages with Pagefind; the
explorer matches the named fields of records. The two share the combobox pattern and the query
parameter names, not an index.

## The component

```md
::data-explorer{from=books columns=title,author,year,status filters=status,tags sort=year}
```

- `from` names one collection, lowercase as the config writes it.
- `columns` is the fields the table shows and the fields the reader can match, in display order.
  It is required and never empty.
- `filters` names the fields offered as value filters. Optional.
- `sort` names the fields offered by the sort control. Optional.
- The field named `title` is the ranking field. A collection without one ranks exact matches first
  and then keeps source order; it has no title-prefix tier.

The collection must declare `index` with every field the explorer uses:

```yaml
collections:
  books:
    source: _data/books.yml
    template: _templates/book.md
    permalink: /books/{id}/
    search:
      aliases: aka
    index:
      fields: [title, author, year, status, tags, aka]
      bytes: 100000
```

The index is the only source of result rows in the browser. The static table below comes from the
build, not from a second copy of the index. A collection without `index` gets the form and the static
table, but no in-page matching; the form still searches the site.

## The index

### When it is fetched

**Never on page load.** The first focus of the query field, by pointer or keyboard, starts the load.
If the field already has focus when the island starts, the load starts then. A second focus uses the
rows already in memory.

One load is in flight at a time. A retry aborts the old request with `AbortController`. Blur does not
abort: a reader who leaves the field and comes back should not download the index twice.
The rows live for the life of the page, in memory only; there is no `localStorage`, IndexedDB, or
service worker copy. The browser's HTTP cache may keep the files between visits.

### Head and chunks

The loader fetches `<base>/data/<collection>.index.json` first. The head is one of two shapes the
engine writes:

```json
{"collection":"books","columns":["title","author","year"],"rows":[...]}
{"collection":"books","columns":["title","author","year"],"chunks":["data/books.index.1.json","data/books.index.2.json"]}
```

When `rows` is present, that file is the whole index and the reader made one request. When `chunks`
is present, the head carries no rows: the loader fetches each chunk, **at most four at a time**, in
the listed order. Chunk paths are relative to the site root, so `base` is prefixed to each one.
Results wait until every chunk is loaded; the explorer never ranks a half index.

The engine splits by bytes, not by records, at `index.bytes` (default `100000`). The explorer takes
the chunk list the head describes and never chooses a budget. A larger budget means fewer, larger
requests; a smaller budget means more requests. The measured numbers below use the default.

The head's `chunks` array and every chunk's `collection` and `columns` must agree. A chunk that fails
either check, a row whose length does not match `columns`, or a row whose last value is not a URL is a
load failure, not a row to skip. The static table stays, the status region names the failure, and a
retry button starts again from the head.

### Rows

The columns are the declared fields once, then `url`. A row is an array in that order. The raw rows
are kept once; a second array holds one normalized form per row (a string or its word list), which is
derived text, not a copy of the record. Values are text, numbers, booleans, `null`, or arrays of those.
`null` is empty; an array is joined with spaces for matching and contributes one value per item to a
filter. A URL is rendered as a link only when it starts with `/`, `./`, `../`, or an `http`/`https`
address, the same rule the search results page uses. Every value is written as text, never as HTML.

## Matching

### Normalization

Matching compares normalized text, once per row when the chunk loads and once per query token. The
normalizer is locale-independent:

| Input | Rule |
| --- | --- |
| Latin letters | NFKD, combining marks removed, simple lowercase (not the page locale's casing) |
| Arabic diacritics and tatweel | removed |
| Alef forms (`أ`, `إ`, `آ`, `ٱ`) | bare alef `ا` |
| Yeh forms (`ي`, `ى`, `ئ`) | Farsi yeh `ی` |
| Kaf (`ك`) | keheh `ک` |
| Teh marbuta and heh with yeh (`ة`, `ۀ`) | heh `ه` |
| Waw with hamza (`ؤ`) | waw `و` |
| Persian and Arabic digits (`۰`–`۹`, `٠`–`٩`) | ASCII `0`–`9` |
| Whitespace, punctuation, zero-width non-joiner | word boundaries |

The matching tests in #285 fix the complete table; this table names the classes they cover. A word is
a run of letters or numbers after normalization. Two query forms that normalize to the same text
match the same rows, whether the reader typed Persian, Arabic, or Latin digits.

### Tokens

An empty query matches every row. Otherwise the query is trimmed, normalized, and split into tokens
on word boundaries. **Every token must be a prefix of a word in the searched text.** Matching is
conjunctive: `tidal chart` finds rows where one word starts `tidal` and any word starts `chart`,
in any searched field and in either order.

The searched text is the `columns` in order, joined with spaces, plus the alternate-name field. A
field that is only a filter or a sort key is not searched unless `columns` also names it. A token
matches a whole word or the start of a word, never the middle: `idal` finds neither `tidal` nor
`tides`, while `tid` finds both.

There is no stemming, synonym list, fuzzy match, typo tolerance, phrase requirement, negation, or
ranking by page text. A word match is a prefix match; that is the whole query language.

### Other names

A record's other names are the list or string field named by `collections.<name>.search.aliases`.
The explorer reads that field's column when `index.fields` includes it, matches it like any other
searched text, and never shows it in the table or in a filter chip. An alias that is not in the index
cannot match in the explorer; it still matches in Pagefind, which carries the same aliases.

### Ranking

A matching row lands in the first tier that fits:

1. **Exact**: every query token is a whole word in the searched text.
2. **Title prefix**: not exact, and every query token is a prefix of a word in the `title` field.
3. **Rest**: every token matches, but not by the two rules above.

Within a tier, rows keep the index order, which is the collection's source order. There is no score
to tie, so a query cannot reorder equal rows between two keystrokes. A query with more tokens is
narrower, not lower ranked: a row must match all of them to appear at all.

## Results

A query returns at most **50 rows**; a **Show more** button appends the next 50 in the same order. The
result count is announced in the live region, and an empty result names the query and offers to clear
it. The initial table, before a query, is the first 50 rows in source order.

Each result keeps the table's columns: the title column (or the first column when there is no title)
is the row's link, the other columns follow as text, and an empty value is left out. The static table
and the island render the same columns, so a result looks the same before and after hydration.

Every message the island shows — loading, count, empty, failure, retry, and **Show more** — is written
into the static markup as a `data-` attribute in the page language, as the search dialog does, so the
island carries no message catalog.

Typing is debounced by **120 ms**; clearing the field shows the first 50 immediately. A query change
while the index is loading is kept and applied once the rows arrive. The first interaction pays the
fetch, parse, and preparation cost; later keystrokes only match and render.

### Filters and counts

A filter control is one field and its distinct values, read from the loaded rows. A list value gives
one value per item; a repeated value within one row counts once. A field with one distinct value is
not offered as a control, and a field with none is not either; an active value from the address still
appears as a chip so it can be removed. The explorer does not fetch `search-facets.json`; the facets
file is for the search results page, while these counts must follow the query.

Filters combine with **OR inside one field** and **AND across fields**, and with the text query as
another AND. The counts for a field are computed over the rows that match the text query and the
**other** active filters, not its own. Its active values stay visible even when their count becomes
zero, so a reader can always remove one. Active filters appear as removable chips; removing a chip
updates the counts. Values are compared by their text form (`String(value)`), not normalized, and are
displayed as written. A filter is equality only: no ranges, wildcards, or free text.

### Sorting

Relevance is the default. A sort control offers relevance and each field named by `sort`. The
comparison is the one `record-table` uses: text in the page language's collation, numbers, dates, and
empty values last, with a stable tie-break. The explorer does not duplicate that comparator. A query
change returns the sort to relevance; a filter change keeps the chosen field. The order is one field
at a time, ascending or descending.

## The address

The explorer keeps its state in the query string with the engine's search results names:

| State | Parameter |
| --- | --- |
| Text | `q` |
| One filter value | `filter.<field>` |
| Sort field | `sort` |
| Direction | `order` (`asc` or `desc`) |

A filter with several active values repeats its parameter. Defaults are left out: an empty query, no
filter, relevance, and ascending order. The address is rewritten with `history.replaceState` — 120 ms
after a keystroke, immediately after a filter or sort change — never with `pushState` per keystroke;
back and forward restore the state from `popstate`. The page loads with the state the address names,
after the index is ready. An unknown field, value, or sort is ignored, never an error, as the engine's
contract says.

## Without JavaScript

The component renders a labelled `GET` form and the first 50 records as a `record-table`:

- the form's action is `<base>/search/`, the site's search results page;
- the field is `q`;
- a hidden field is `filter.collection=<collection>`, so the page search is narrowed to the
  collection's record pages;
- the table has the same columns and record links as the enhanced table;
- no filter, sort, active-row, or **Show more** control is rendered, because none would work.

Submitting the form is the whole no-JavaScript answer: the search results page searches the site's
Pagefind index, which includes record pages, their declared metadata, and their aliases. The form
uses the same parameter names as the explorer, so the names work on both pages.

A static page cannot filter itself. Without JavaScript, a link to the explorer page still shows the
first 50 records and the form; it does not apply a `q` from its own address. The search results page
is the address that answers a shared query without JavaScript. This is a deliberate limit, not a
missing script.

When the island runs, it keeps the form and the table, turns the field into a combobox, and replaces
the table body with matches. A failed index load leaves the form and the static table in place and
offers a retry. A submit that happens before the rows are ready follows the form to the search
results page.

## Keyboard

The pattern is the search dialog's, without the dialog and without a focus trap.

| Key | From the query field |
| --- | --- |
| `ArrowDown` / `ArrowUp` | Move to the next or previous result, wrapping at the ends. Focus stays in the field. |
| `Enter` | Open the active result, or the first one when no result is active. With no results, submit the form. |
| `Escape` | Clear the query and the active result. When the query is already empty, do nothing. |
| `Tab` / `Shift+Tab` | The browser's order: field, filters, sort, result links, Show more. Nothing is trapped. |

The field is the combobox and the result list is its listbox. The active row is the control the field
names in `aria-activedescendant`; the attribute is removed when no row is active. The active row
carries `aria-selected="true"` and no other row does. Row ids are positional (`explorer-option-1`, …)
and each row also has a key from its URL plus its occurrence, so a redraw re-finds the active row by
key and never points at a row the new query removed. A pointer entering a row moves the active row,
as in the search dialog; a click follows the row's link. Arrow keys are handled only when the field
has focus.

The field's `aria-expanded` is `true` while it controls the loaded listbox and `false` before that.
On a load failure the field loses the combobox role and `aria-expanded`, `aria-controls`, and
`aria-activedescendant`, because it no longer controls a list; the plain search form remains.

## Limits and measurements

### Method

Measured with Node 24.22.3, the installed `@velella/mizzen` 0.2.2 binary, and one throwaway script
outside the repository. The script generated two sites with **1,000** and **10,000** records, all
with the same seven columns: `title`, `author`, `year`, `category`, `tags`, `aka`, and `url`. Titles
were 30–90 characters, with 1–3 tags and 1–2 aliases; about one title in twelve carried Persian text.
The collection used `index.bytes: 100000` and `index.fields` naming all six fields. Each site was
built with `mizzen build` and a minimal theme; `html: false` kept the measurement independent of the
theme without changing the index output.

The script read `data/books.index*.json`, summed raw bytes and gzip bytes (`node:zlib`, level 9),
counted the head and chunks, parsed every file, prepared the normalized words once, and ran 50
two-token prefix queries. Parse time is the median of 15 runs. Match time is the median and 95th
percentile of those 50 queries, after preparation, with no ranking sort. Node timings are a floor,
not a browser promise: no DOM, no rendering, no network. The build time is not reported; the explorer
never builds an index at runtime.

### Numbers

| | 1,000 records | 10,000 records |
| --- | --- | --- |
| Files | 3 (head + 2 chunks) | 17 (head + 16 chunks) |
| Requests | 3 | 17 |
| Raw bytes | 150,236 | 1,507,623 |
| Gzip bytes | 24,874 | 242,746 |
| `JSON.parse` all files | 0.28 ms | 3.28 ms |
| Prepare normalized words, all chunks | 6.61 ms | 49.48 ms |
| Match, median | 0.05 ms | 0.6 ms |
| Match, 95th percentile | 0.2 ms | 1.95 ms |

The index is **supported up to 10,000 records per collection**. At that size the whole index is a
few hundred kilobytes gzipped and a few milliseconds of parsing; matching after preparation is far
under the **50 ms per-keystroke budget**. Preparing every chunk at once is the largest cost at this
size (49.48 ms), so the island prepares each chunk as it arrives (about 3 ms per chunk), never on a
keystroke and never again on a redraw.

A collection above 10,000 records still loads if the engine writes it, but it is outside the measured
budget. Such a site should use the search results page, split the collection, or raise this limit in
a later note with new numbers. A worker is not used: the measured match is far under the budget at
10,000. #291 records the budget in a scale test and moves matching to a worker only if that test
misses it.

## Accessibility, RTL, and print

- The form has a visible label; the result list is a labelled listbox; each row's link is the option's
  control; the count, loading, empty, and failure messages share one `role="status"` region. The
  count uses the page language's plural categories, as the search dialog does.
- Filter controls are native checkboxes with the value and count in the label; chips are buttons with
  an accessible name that names the value. The sort control is a labelled `select`.
- The active row is marked by `aria-selected` and a border or surface change, never by colour alone.
  Focus is visible in both themes and forced colours.
- Logical properties keep the table, controls, and counts right-to-left ready; the page's `dir` and
  `lang` are inherited, and Persian and Arabic text is never letter-spaced.
- Print hides the form, filters, sort, chips, and **Show more**, and prints the current rows with a
  column header. With no JavaScript that is the static table's first 50 records.
- Nothing animates, so reduced motion needs no special case. The component fetches only same-origin
  index files; it sends no analytics and stores nothing.

## Out of scope

- A query language: operators, quoted phrases, negation, wildcards, `field:value`, ranges, and
  boolean grouping. The text field takes plain words and the controls take values.
- Fuzzy matching, stemming, synonyms, typo correction, and ranking by page body text.
- Searching several collections in one explorer, merging the Pagefind and collection indexes, or
  searching across languages. The index is the default language's, one row per record.
- Live or server-side data, websockets, a search API, and a build-time full-text index.
- Saved searches, recent queries, analytics, and state in local storage. The address is the only
  saved state.
- Numeric or date ranges as filters, multi-field sort, and grouping. `record-table` and the list
  layout keep those jobs.
- A worker for matching, until #291's measurement asks for one.
