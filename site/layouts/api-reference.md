---
title: API reference
description: The operation and index pages a pinned OpenAPI document builds, and every front matter field the layouts read.
layout: doc
permalink: /layouts/api-reference/
---

The `api-reference` and `api-reference-index` layouts render a reference the engine builds from one
pinned OpenAPI 3.1 or 3.0 document. You do not write these pages or their front matter by hand: the
engine reads the document, writes an index page at the configured path and one page per operation,
and fills the `apiReference` front matter with its normalized model. The pages are ordinary doc
pages, so search, Markdown twins, and the sitemap work without extra setup, and the operation model
renders without client JavaScript.

## Configure the reference

```yaml
apiReference:
  source: openapi.yaml   # one YAML or JSON file in the site
  path: /reference/      # index and operation pages live here
```

The engine adds a navigation group named after the document, with one group per tag and the
untagged operations as top-level links. The keys are `apiReference.source` and
`apiReference.path`. Keep the data API's own OpenAPI output separate: `api` publishes
`/api/<version>/openapi.json`, and `apiReference` reads the pinned input file.

## Layouts

| Layout | What it renders |
| --- | --- |
| `api-reference` | One operation: method badge, path, title, description, tags, deprecated state, server, parameters table, request body, responses, schemas, and examples. |
| `api-reference-index` | The document title, version, description, and grouped links to the operation pages. |

An operation with no description, tags, server, parameters, or request body still gets a complete
page: the method, path, title, and its responses. The layout never leaves an empty optional section.
A page without the engine's `apiReference` model falls back to its title and body, so a hand-written
page stays readable.

## Operation front matter

A generated operation page names `layout: api-reference` and carries one `apiReference` object.

| Field | Type | What the layout reads |
| --- | --- | --- |
| `apiReference.kind` | string | Must be `operation`; otherwise the layout uses its title-and-body fallback. |
| `apiReference.operation.id` | string | The operation id the engine used in the page URL. |
| `apiReference.operation.method` | string | The HTTP method, shown as an upper-case badge. |
| `apiReference.operation.path` | string | The route, kept left to right in every language. |
| `apiReference.operation.url` | string | The page's own URL, including the site base. |
| `apiReference.operation.title` | string | The page heading: the summary, else the method and path. |
| `apiReference.operation.description` | string | A paragraph under the heading. |
| `apiReference.operation.tags` | list of strings | One tag per list item. |
| `apiReference.operation.deprecated` | boolean | Shows the Deprecated flag. |
| `apiReference.operation.server` | string | The first server URL the document declares. |
| `apiReference.operation.parameters` | list | Rows of the parameters table. |
| `apiReference.operation.requestBody` | object | The request body section. |
| `apiReference.operation.responses` | list | The responses section. |

### Parameter fields

| Field | What the layout reads |
| --- | --- |
| `name` | The parameter name, in code text. |
| `in` | The location: `path`, `query`, `header`, or `cookie`. |
| `required` | Yes or No in the page language. |
| `deprecated` | Shows the Deprecated flag beside the name. |
| `description` | The description cell. |
| `schema` | The type cell and, when the schema has more, the schema block below the table row. |
| `examples` | One name and value per example, under the description. |

### Request body and response content

The request body reads `required`, `description`, and `content`. A response reads `status`,
`description`, and `content`. One content entry is a media type:

| Field | What the layout reads |
| --- | --- |
| `type` | The media type heading, such as `application/json`. |
| `schema` | The schema block under the media type. |
| `examples` | One figure per example. |

### Schema fields

| Field | What the layout reads |
| --- | --- |
| `type` | The type name, or a union joined with `\|`. |
| `format` | A format row, and the type cell's `(format)` note. |
| `description` | A description above the schema rows. |
| `enum` | One code value per allowed value. |
| `default` | The default as code. |
| `required` | One code value per required property. |
| `properties` | Nested property list; each entry has `name` and `schema`, and the layout recurses. |
| `items` | The item schema, rendered as a nested schema block. |
| `additionalProperties` | Yes or No for a boolean, or the nested schema for an object. |

### Example fields

| Field | What the layout reads |
| --- | --- |
| `name` | The figure caption's name. |
| `summary` | A sentence beside the name. |
| `value` | The code block: a string as text, anything else as indented JSON. |

## Index front matter

A generated index page names `layout: api-reference-index` and carries one `apiReference` object.

| Field | Type | What the layout reads |
| --- | --- | --- |
| `apiReference.kind` | string | Must be `index`; otherwise the layout uses its title-and-body fallback. |
| `apiReference.title` | string | The page heading. |
| `apiReference.version` | string | The document version, under the heading. |
| `apiReference.description` | string | A paragraph under the version. |
| `apiReference.navigation` | list | The grouped links. |

One navigation entry is either a group with `title` and `children`, where each child has `title` and
`url`, or an untagged operation with `title` and `url`. Groups render under their tag and the
untagged operations render under Other operations. Every link is an ordinary anchor, so the page
works without JavaScript.

## Check a site

```bash
npx mizzen build site --out dist
npx mizzen check site --theme .
```

The fixture `fixtures/api-reference/` has one full operation and one minimal operation, the data API
beside the reference, and a test that compares the built pages with the pinned input.
