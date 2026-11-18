import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import drawer from "../chrome/drawer/index.ts";
import header from "../chrome/header/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import { t } from "../i18n/index.ts";

/**
 * The operation page of a pinned OpenAPI reference. The engine builds one doc page per operation
 * with the normalized operation model in `apiReference` front matter; this layout renders that
 * model: method, path, title, description, tags, server, parameters, request body, responses,
 * schemas, and examples. The minimal OpenAPI operation still gets a readable page with its method,
 * path, title, and responses.
 *
 * Pages name it with `layout: api-reference`; authors do not write this front matter by hand.
 * The page is an ordinary doc page to the engine, so search, the Markdown twin, and the sitemap
 * keep working without client JavaScript.
 */

/** The part of the OpenAPI schema the engine publishes. */
interface ApiSchema {
  readonly type?: string | readonly string[];
  readonly format?: string;
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly required: readonly string[];
  readonly properties: readonly ApiProperty[];
  readonly items?: ApiSchema;
  readonly additionalProperties?: boolean | ApiSchema;
}

/** One named property of a schema. */
interface ApiProperty {
  readonly name: string;
  readonly schema: ApiSchema;
}

/** One named example, or the single `example` under the name `example`. */
interface ApiExample {
  readonly name: string;
  readonly summary?: string;
  readonly value: unknown;
}

/** One media type of a request body or a response. */
interface ApiMediaType {
  readonly type: string;
  readonly schema?: ApiSchema;
  readonly examples: readonly ApiExample[];
}

/** One parameter of an operation or its path item. */
interface ApiParameter {
  readonly name: string;
  readonly in: string;
  readonly required: boolean;
  readonly deprecated: boolean;
  readonly description?: string;
  readonly schema: ApiSchema;
  readonly examples: readonly ApiExample[];
}

/** The body a request sends. */
interface ApiRequestBody {
  readonly required: boolean;
  readonly description?: string;
  readonly content: readonly ApiMediaType[];
}

/** One response of an operation. */
interface ApiResponse {
  readonly status: string;
  readonly description: string;
  readonly content: readonly ApiMediaType[];
}

/** One operation, as the engine normalized it. */
interface ApiOperation {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly url: string;
  readonly title: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly deprecated: boolean;
  readonly server?: string;
  readonly parameters: readonly ApiParameter[];
  readonly requestBody?: ApiRequestBody;
  readonly responses: readonly ApiResponse[];
}

type MediaDepth = 3 | 4;
type ExamplesDepth = 4 | 5;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The operation from front matter, or undefined when the page is not an engine-built operation. */
function operationOf(frontMatter: LayoutProps["page"]["frontMatter"]): ApiOperation | undefined {
  const reference = frontMatter.apiReference;
  if (!isRecord(reference) || reference.kind !== "operation" || !isRecord(reference.operation)) return undefined;
  const operation = reference.operation;
  if (
    typeof operation.id !== "string" ||
    typeof operation.method !== "string" ||
    typeof operation.path !== "string" ||
    typeof operation.url !== "string" ||
    typeof operation.title !== "string" ||
    !Array.isArray(operation.responses)
  ) {
    return undefined;
  }
  return operation as unknown as ApiOperation;
}

/** The method badge colors the same methods as the endpoint component, with no script. */
function methodClassOf(method: string): string {
  const known = ["get", "post", "put", "patch", "delete"];
  const name = method.toLowerCase();
  return `api-reference-method api-reference-method-${known.includes(name) ? name : "other"}`;
}

/** A schema's type names joined for display, or undefined when it declares none. */
function typeNames(schema: ApiSchema): string | undefined {
  if (schema.type === undefined) return undefined;
  return typeof schema.type === "string" ? schema.type : schema.type.join(" | ");
}

/** A schema's type as table text: the type union, with the format in parentheses. */
function typeLabel(schema: ApiSchema | undefined): string {
  if (schema === undefined) return "—";
  const type = typeNames(schema);
  if (type !== undefined && schema.format !== undefined) return `${type} (${schema.format})`;
  return type ?? schema.format ?? "—";
}

/** A JSON value as code text; a string example stays the text it shows. */
function exampleText(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? String(value);
}

/** One description line; newlines in the source become line breaks without HTML. */
function description(text: string | undefined): ComponentChildren {
  return text === undefined || text.trim() === "" ? null : h("p", { class: "api-reference-description" }, text);
}

/** A small status label such as Required, Optional, or Deprecated. */
function flag(text: string, tone?: "caution"): ComponentChildren {
  return h("span", { class: tone === undefined ? "api-reference-flag" : `api-reference-flag api-reference-flag-${tone}` }, text);
}

/** One example: its name and summary above the JSON or text value. */
function exampleFigure(example: ApiExample): ComponentChildren {
  return h(
    "figure",
    { class: "api-reference-example" },
    h(
      "figcaption",
      null,
      h("code", { class: "api-reference-example-name", dir: "ltr" }, example.name),
      example.summary === undefined ? null : h("span", { class: "api-reference-example-summary" }, " ", example.summary),
    ),
    h(
      "pre",
      { class: "api-reference-example-code", dir: "ltr" },
      h("code", null, exampleText(example.value)),
    ),
  );
}

/** The examples of one media type, or nothing when it has none. */
function examplesBlock(examples: readonly ApiExample[], depth: ExamplesDepth, lang: string): ComponentChildren {
  if (examples.length === 0) return null;
  return h(
    "div",
    { class: "api-reference-examples" },
    h(`h${depth}`, { class: "api-reference-examples-title" }, t(lang, "api_examples")),
    ...examples.map(exampleFigure),
  );
}

/** One label and value row in a schema's metadata list. */
function metaRow(label: string, value: ComponentChildren): ComponentChildren {
  return [h("dt", null, label), h("dd", null, value)];
}

/** One code value that must stay in its own direction inside a translated sentence. */
function code(value: string): ComponentChildren {
  return h("code", { dir: "ltr" }, value);
}

/** A schema's keywords, items, additional properties, and nested properties as one readable block. */
function schemaBlock(schema: ApiSchema, lang: string): ComponentChildren {
  const rows: ComponentChildren[] = [];
  const type = typeNames(schema);
  if (type !== undefined) rows.push(metaRow(t(lang, "type"), code(type)));
  if (schema.format !== undefined) rows.push(metaRow(t(lang, "api_format"), code(schema.format)));
  if (schema.required.length > 0) {
    rows.push(metaRow(t(lang, "required"), h("span", { class: "api-reference-code-list" }, ...schema.required.map(code))));
  }
  if (schema.enum !== undefined) {
    rows.push(
      metaRow(
        t(lang, "api_enum"),
        h("span", { class: "api-reference-code-list" }, ...schema.enum.map((value) => code(exampleText(value)))),
      ),
    );
  }
  if (schema.default !== undefined) rows.push(metaRow(t(lang, "default"), code(exampleText(schema.default))));
  if (typeof schema.additionalProperties === "boolean") {
    rows.push(metaRow(t(lang, "api_additional_properties"), t(lang, schema.additionalProperties ? "yes" : "no")));
  }
  if (schema.items !== undefined) {
    rows.push(metaRow(t(lang, "api_items"), schemaBlock(schema.items, lang)));
  }
  if (typeof schema.additionalProperties === "object") {
    rows.push(metaRow(t(lang, "api_additional_properties"), schemaBlock(schema.additionalProperties, lang)));
  }

  const properties =
    schema.properties.length === 0
      ? null
      : h(
          "div",
          { class: "api-reference-schema-properties" },
          h("p", { class: "api-reference-schema-label" }, t(lang, "schema_properties")),
          h(
            "ul",
            { class: "api-reference-schema-list" },
            ...schema.properties.map((property) =>
              h(
                "li",
                { class: "api-reference-schema-property" },
                h(
                  "div",
                  { class: "api-reference-schema-line" },
                  code(property.name),
                  " ",
                  h("span", { class: "api-reference-schema-type", dir: "ltr" }, typeLabel(property.schema)),
                  schema.required.includes(property.name) ? [" ", flag(t(lang, "required"))] : null,
                ),
                schemaBlock(property.schema, lang),
              ),
            ),
          ),
        );

  return h(
    Fragment,
    null,
    description(schema.description),
    rows.length === 0 ? null : h("dl", { class: "api-reference-schema-meta" }, ...rows),
    properties,
  );
}

/** One media type: its name, schema, and examples. */
function mediaBlock(media: ApiMediaType, depth: MediaDepth, lang: string): ComponentChildren {
  return h(
    "section",
    { class: "api-reference-media" },
    h(`h${depth}`, { class: "api-reference-media-type" }, code(media.type)),
    media.schema === undefined ? null : schemaBlock(media.schema, lang),
    examplesBlock(media.examples, depth === 3 ? 4 : 5, lang),
  );
}

/** One parameter row: location, name, type, required state, description, and examples. */
function parameterRow(parameter: ApiParameter, lang: string): ComponentChildren {
  return h(
    "tr",
    null,
    h("td", null, code(parameter.in)),
    h(
      "td",
      null,
      code(parameter.name),
      parameter.deprecated ? [" ", flag(t(lang, "deprecated"), "caution")] : null,
    ),
    h("td", null, code(typeLabel(parameter.schema))),
    h("td", null, t(lang, parameter.required ? "yes" : "no")),
    h(
      "td",
      null,
      description(parameter.description),
      parameter.examples.length === 0
        ? null
        : h(
            "ul",
            { class: "api-reference-examples-inline" },
            ...parameter.examples.map((example) =>
              h(
                "li",
                null,
                code(example.name),
                example.summary === undefined ? null : ` ${example.summary}`,
                ": ",
                code(exampleText(example.value)),
              ),
            ),
          ),
    ),
  );
}

/** The parameters table, or nothing when the operation has no parameter. */
function parametersSection(operation: ApiOperation, lang: string): ComponentChildren {
  if (operation.parameters.length === 0) return null;
  const heading = t(lang, "parameters");
  return h(
    "section",
    { class: "api-reference-section" },
    h("h2", null, heading),
    h(
      "div",
      { class: "api-reference-table-wrap" },
      h(
        "table",
        { class: "api-reference-table" },
        h("caption", { class: "api-reference-caption" }, heading),
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            ...["endpoint_in", "name", "type", "required", "description"].map((key) =>
              h("th", { scope: "col" }, t(lang, key)),
            ),
          ),
        ),
        h("tbody", null, ...operation.parameters.map((parameter) => parameterRow(parameter, lang))),
      ),
    ),
  );
}

/** The request body section: required state, description, and one block per media type. */
function requestBodySection(body: ApiRequestBody | undefined, lang: string): ComponentChildren {
  if (body === undefined) return null;
  return h(
    "section",
    { class: "api-reference-section" },
    h(
      "h2",
      null,
      t(lang, "api_request_body"),
      " ",
      flag(body.required ? t(lang, "required") : t(lang, "api_optional")),
    ),
    description(body.description),
    ...body.content.map((media) => mediaBlock(media, 3, lang)),
  );
}

/** One response: its status, description, and media types. */
function responseBlock(response: ApiResponse, lang: string): ComponentChildren {
  return h(
    "section",
    { class: "api-reference-response" },
    h(
      "h3",
      null,
      code(response.status),
      response.description.trim() === "" ? null : h("span", { class: "api-reference-response-description" }, " ", response.description),
    ),
    ...response.content.map((media) => mediaBlock(media, 4, lang)),
  );
}

/** The responses section; every valid operation has at least one. */
function responsesSection(operation: ApiOperation, lang: string): ComponentChildren {
  if (operation.responses.length === 0) return null;
  return h(
    "section",
    { class: "api-reference-section" },
    h("h2", null, t(lang, "api_responses")),
    ...operation.responses.map((response) => responseBlock(response, lang)),
  );
}

/** The operation header: method and path, title, description, tags, server, and deprecation. */
function operationHeader(operation: ApiOperation, lang: string): ComponentChildren {
  return h(
    "header",
    { class: "api-reference-operation-header" },
    h(
      "div",
      { class: "api-reference-line" },
      h("span", { class: methodClassOf(operation.method) }, operation.method.toUpperCase()),
      h("code", { class: "api-reference-path", dir: "ltr" }, operation.path),
    ),
    h("h1", null, operation.title),
    operation.deprecated ? h("p", { class: "api-reference-deprecated" }, flag(t(lang, "deprecated"), "caution")) : null,
    description(operation.description),
    operation.tags.length === 0
      ? null
      : h(
          "ul",
          { class: "api-reference-tags", "aria-label": t(lang, "tags") },
          ...operation.tags.map((tag) => h("li", { class: "api-reference-tag" }, tag)),
        ),
    operation.server === undefined
      ? null
      : h(
          "p",
          { class: "api-reference-server" },
          h("span", { class: "api-reference-server-label" }, t(lang, "api_server")),
          " ",
          code(operation.server),
        ),
  );
}

/**
 * The operation article, marked for Pagefind. A page without the engine's operation front matter
 * falls back to the ordinary doc article, so a hand-written page stays readable instead of blank.
 */
function article(props: LayoutProps): ComponentChildren {
  const { page } = props;
  const operation = operationOf(page.frontMatter);
  if (operation === undefined) {
    return h(
      "article",
      { class: "doc api-reference", "data-pagefind-body": true },
      breadcrumb(props) as ComponentChildren,
      h("h1", null, page.title),
      h("div", { class: "doc-body", dangerouslySetInnerHTML: { __html: page.html } }),
    );
  }
  const lang = page.lang;
  return h(
    "article",
    { class: "doc api-reference", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    operationHeader(operation, lang),
    parametersSection(operation, lang),
    requestBodySection(operation.requestBody, lang),
    responsesSection(operation, lang),
  );
}

/** The API reference operation page: the docs shell around the generated operation article. */
const apiReference: Layout = (props) =>
  base({
    ...props,
    header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
    sidebar: sidebar(props) as ComponentChildren,
    main: article(props),
    aside: toc(props) as ComponentChildren,
  });

export default apiReference;
