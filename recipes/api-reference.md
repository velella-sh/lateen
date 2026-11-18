# API reference from an OpenAPI document

The engine writes the pages; Lateen renders them. Nothing is fetched at runtime.

## 1. Put the document in the site

```bash
cp openapi.yaml site/openapi.yaml
```

One OpenAPI 3.1 or 3.0 file is the input, in YAML or JSON. Local `$ref`s inside that file are
resolved; external references are not.

## 2. Point the site at it

```yaml
# site/mizzen.yml
apiReference:
  source: openapi.yaml
  path: /reference/
```

`path` is optional and defaults to `/reference/`. Every operation needs an `operationId` matching
`[A-Za-z0-9][A-Za-z0-9._-]*`; its page URL is `<path><operationId>/`.

Keep the data API's own OpenAPI output separate. This publishes `/api/v1/openapi.json` and does not
feed the reference:

```yaml
api:
  version: v1
  collections:
    books:
      fields: [title, author]
```

## 3. Build and check

```bash
npx mizzen build site --out dist
npx mizzen check site
```

```bash
find dist/reference -name index.html
```

The index is `dist/reference/index.html`; one page per operation sits beside it. The operation
pages are ordinary doc pages, so `dist/reference/<operationId>/index.md`, search, and the sitemap
include them.

## 4. Confirm the data API is still there

```bash
test -f dist/api/v1/openapi.json
test -f dist/api/v1/index.json
```

## Theme fields

The layouts read only the engine's `apiReference` front matter. The full field list is on
[API reference](/layouts/api-reference/). To test the behavior against this theme's checkout:

```bash
node --test test/api-reference-layout/*.test.ts test/api-reference/*.test.ts
```
