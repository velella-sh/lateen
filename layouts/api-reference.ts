import { Fragment, h } from "preact";
import { isRecord } from "../src/guards.ts";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import { t } from "../i18n/index.ts";
import { articleHtml } from "../src/article-html.ts";
import { articleShell } from "./shared/index.ts";

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
 *
 * All selection happens in `operationViewOf`, a pure front-matter-to-view-model step; the render
 * functions below only turn the view model into markup.
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

/** One example, ready to display: its value already rendered as code text. */
interface ExampleView {
  readonly name: string;
  readonly summary?: string;
  readonly text: string;
}

/** One metadata row of a schema: a translated label and a value ready to display. */
type SchemaMetaView =
  | { readonly kind: "code"; readonly label: string; readonly value: string }
  | { readonly kind: "codes"; readonly label: string; readonly values: readonly string[] }
  | { readonly kind: "text"; readonly label: string; readonly value: string }
  | { readonly kind: "schema"; readonly label: string; readonly schema: SchemaView };

/** One named property of a schema, with its type text and required state selected. */
interface SchemaPropertyView {
  readonly name: string;
  readonly typeLabel: string;
  readonly required: boolean;
  readonly schema: SchemaView;
}

/** A schema's description, metadata rows, and nested properties, ready to display. */
interface SchemaView {
  readonly description?: string;
  readonly meta: readonly SchemaMetaView[];
  readonly properties: readonly SchemaPropertyView[];
}

/** One media type: its name, schema, and examples. */
interface MediaView {
  readonly type: string;
  readonly schema?: SchemaView;
  readonly examples: readonly ExampleView[];
}

/** One parameter row: location, name, type text, required text, description, and examples. */
interface ParameterView {
  readonly location: string;
  readonly name: string;
  readonly deprecated: boolean;
  readonly typeLabel: string;
  readonly requiredLabel: string;
  readonly description?: string;
  readonly examples: readonly ExampleView[];
}

/** The request body: required state, description, and one view per media type. */
interface RequestBodyView {
  readonly required: boolean;
  readonly description?: string;
  readonly content: readonly MediaView[];
}

/** One response: its status, non-blank description, and media types. */
interface ResponseView {
  readonly status: string;
  readonly description?: string;
  readonly content: readonly MediaView[];
}

/** The whole operation page, selected and translated before any markup is built. */
export interface OperationView {
  readonly methodLabel: string;
  readonly methodClass: string;
  readonly path: string;
  readonly title: string;
  readonly description?: string;
  readonly deprecated: boolean;
  readonly tags: readonly string[];
  readonly server?: string;
  readonly parameters: readonly ParameterView[];
  readonly requestBody?: RequestBodyView;
  readonly responses: readonly ResponseView[];
}

type MediaDepth = 3 | 4;
type ExamplesDepth = 4 | 5;

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
export function methodClassOf(method: string): string {
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

/** One example, with its value selected as code text. */
function exampleViewOf(example: ApiExample): ExampleView {
  return {
    name: example.name,
    ...(example.summary === undefined ? {} : { summary: example.summary }),
    text: exampleText(example.value),
  };
}

/** A schema's keywords, items, additional properties, and nested properties, selected in order. */
function schemaViewOf(schema: ApiSchema, lang: string): SchemaView {
  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = Array.isArray(schema.properties) ? schema.properties : [];
  const meta: SchemaMetaView[] = [];
  const type = typeNames(schema);
  if (type !== undefined) meta.push({ kind: "code", label: t(lang, "type"), value: type });
  if (schema.format !== undefined) meta.push({ kind: "code", label: t(lang, "api_format"), value: schema.format });
  if (required.length > 0) meta.push({ kind: "codes", label: t(lang, "required"), values: required });
  if (schema.enum !== undefined) {
    meta.push({ kind: "codes", label: t(lang, "api_enum"), values: schema.enum.map((value) => exampleText(value)) });
  }
  if (schema.default !== undefined) meta.push({ kind: "code", label: t(lang, "default"), value: exampleText(schema.default) });
  if (typeof schema.additionalProperties === "boolean") {
    meta.push({ kind: "text", label: t(lang, "api_additional_properties"), value: t(lang, schema.additionalProperties ? "yes" : "no") });
  }
  if (schema.items !== undefined) meta.push({ kind: "schema", label: t(lang, "api_items"), schema: schemaViewOf(schema.items, lang) });
  if (typeof schema.additionalProperties === "object") {
    meta.push({ kind: "schema", label: t(lang, "api_additional_properties"), schema: schemaViewOf(schema.additionalProperties, lang) });
  }
  return {
    ...(schema.description === undefined ? {} : { description: schema.description }),
    meta,
    properties: properties.map((property) => ({
      name: property.name,
      typeLabel: typeLabel(property.schema),
      required: required.includes(property.name),
      schema: schemaViewOf(property.schema, lang),
    })),
  };
}

/** One media type, with its schema and examples selected. */
function mediaViewOf(media: ApiMediaType, lang: string): MediaView {
  return {
    type: media.type,
    ...(media.schema === undefined ? {} : { schema: schemaViewOf(media.schema, lang) }),
    examples: media.examples.map(exampleViewOf),
  };
}

/** One parameter, with its type text, required text, and examples selected. */
function parameterViewOf(parameter: ApiParameter, lang: string): ParameterView {
  return {
    location: parameter.in,
    name: parameter.name,
    deprecated: parameter.deprecated,
    typeLabel: typeLabel(parameter.schema),
    requiredLabel: t(lang, parameter.required ? "yes" : "no"),
    ...(parameter.description === undefined ? {} : { description: parameter.description }),
    examples: parameter.examples.map(exampleViewOf),
  };
}

/** The request body, with each media type selected. */
function requestBodyViewOf(body: ApiRequestBody, lang: string): RequestBodyView {
  return {
    required: body.required,
    ...(body.description === undefined ? {} : { description: body.description }),
    content: body.content.map((media) => mediaViewOf(media, lang)),
  };
}

/** One response; a blank description is dropped so the heading shows the status alone. */
function responseViewOf(response: ApiResponse, lang: string): ResponseView {
  return {
    status: response.status,
    ...(response.description.trim() === "" ? {} : { description: response.description }),
    content: response.content.map((media) => mediaViewOf(media, lang)),
  };
}

/**
 * The pure operation view model: every operation, parameter, response, schema, and example
 * selection, translated for the page language, before any markup is built. Returns undefined
 * when the page is not an engine-built operation, so the layout can fall back to the doc article.
 */
export function operationViewOf(frontMatter: LayoutProps["page"]["frontMatter"], lang: string): OperationView | undefined {
  const operation = operationOf(frontMatter);
  if (operation === undefined) return undefined;
  return {
    methodLabel: operation.method.toUpperCase(),
    methodClass: methodClassOf(operation.method),
    path: operation.path,
    title: operation.title,
    ...(operation.description === undefined ? {} : { description: operation.description }),
    deprecated: operation.deprecated,
    tags: operation.tags,
    ...(operation.server === undefined ? {} : { server: operation.server }),
    parameters: operation.parameters.map((parameter) => parameterViewOf(parameter, lang)),
    ...(operation.requestBody === undefined ? {} : { requestBody: requestBodyViewOf(operation.requestBody, lang) }),
    responses: operation.responses.map((response) => responseViewOf(response, lang)),
  };
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
function exampleFigure(example: ExampleView): ComponentChildren {
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
      h("code", null, example.text),
    ),
  );
}

/** The examples of one media type, or nothing when it has none. */
function examplesBlock(examples: readonly ExampleView[], depth: ExamplesDepth, lang: string): ComponentChildren {
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

/** One selected metadata value: code text, a code list, plain text, or a nested schema. */
function metaValue(row: SchemaMetaView, lang: string): ComponentChildren {
  switch (row.kind) {
    case "code":
      return code(row.value);
    case "codes":
      return h("span", { class: "api-reference-code-list" }, ...row.values.map((value) => code(value)));
    case "text":
      return row.value;
    case "schema":
      return schemaBlock(row.schema, lang);
  }
}

/** A schema's selected description, metadata rows, and nested properties as one readable block. */
function schemaBlock(schema: SchemaView, lang: string): ComponentChildren {
  return h(
    Fragment,
    null,
    description(schema.description),
    schema.meta.length === 0
      ? null
      : h("dl", { class: "api-reference-schema-meta" }, ...schema.meta.map((row) => metaRow(row.label, metaValue(row, lang)))),
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
                  h("span", { class: "api-reference-schema-type", dir: "ltr" }, property.typeLabel),
                  property.required ? [" ", flag(t(lang, "required"))] : null,
                ),
                schemaBlock(property.schema, lang),
              ),
            ),
          ),
        ),
  );
}

/** One media type: its name, schema, and examples. */
function mediaBlock(media: MediaView, depth: MediaDepth, lang: string): ComponentChildren {
  return h(
    "section",
    { class: "api-reference-media" },
    h(`h${depth}`, { class: "api-reference-media-type" }, code(media.type)),
    media.schema === undefined ? null : schemaBlock(media.schema, lang),
    examplesBlock(media.examples, depth === 3 ? 4 : 5, lang),
  );
}

/** One parameter row: location, name, type, required state, description, and examples. */
function parameterRow(parameter: ParameterView, lang: string): ComponentChildren {
  return h(
    "tr",
    null,
    h("td", null, code(parameter.location)),
    h(
      "td",
      null,
      code(parameter.name),
      parameter.deprecated ? [" ", flag(t(lang, "deprecated"), "caution")] : null,
    ),
    h("td", null, code(parameter.typeLabel)),
    h("td", null, parameter.requiredLabel),
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
                code(example.text),
              ),
            ),
          ),
    ),
  );
}

/** The parameters table, or nothing when the operation has no parameter. */
function parametersSection(parameters: readonly ParameterView[], lang: string): ComponentChildren {
  if (parameters.length === 0) return null;
  const heading = t(lang, "parameters");
  return h(
    "section",
    { class: "api-reference-section" },
    h("h2", null, heading),
    h(
      "div",
      { class: "api-reference-table-wrap table-scroll", tabIndex: 0 },
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
        h("tbody", null, ...parameters.map((parameter) => parameterRow(parameter, lang))),
      ),
    ),
  );
}

/** The request body section: required state, description, and one block per media type. */
function requestBodySection(body: RequestBodyView | undefined, lang: string): ComponentChildren {
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
function responseBlock(response: ResponseView, lang: string): ComponentChildren {
  return h(
    "section",
    { class: "api-reference-response" },
    h(
      "h3",
      null,
      h("code", { class: "api-reference-status", dir: "ltr" }, response.status),
      response.description === undefined ? null : h("span", { class: "api-reference-response-description" }, " ", response.description),
    ),
    ...response.content.map((media) => mediaBlock(media, 4, lang)),
  );
}

/** The responses section; every valid operation has at least one. */
function responsesSection(responses: readonly ResponseView[], lang: string): ComponentChildren {
  if (responses.length === 0) return null;
  return h(
    "section",
    { class: "api-reference-section" },
    h("h2", null, t(lang, "api_responses")),
    ...responses.map((response) => responseBlock(response, lang)),
  );
}

/** The operation header: method and path, title, description, tags, server, and deprecation. */
function operationHeader(view: OperationView, lang: string): ComponentChildren {
  return h(
    "header",
    { class: "api-reference-operation-header" },
    h(
      "div",
      { class: "api-reference-line" },
      h("span", { class: `version-badge ${view.methodClass}` }, view.methodLabel),
      " ",
      h("code", { class: "api-reference-path", dir: "ltr" }, view.path),
    ),
    h("h1", null, view.title),
    view.deprecated ? h("p", { class: "api-reference-deprecated" }, flag(t(lang, "deprecated"), "caution")) : null,
    description(view.description),
    view.tags.length === 0
      ? null
      : h(
          "ul",
          { class: "api-reference-tags", "aria-label": t(lang, "tags") },
          ...view.tags.map((tag) => h("li", { class: "api-reference-tag" }, tag)),
        ),
    view.server === undefined
      ? null
      : h(
          "p",
          { class: "api-reference-server" },
          h("span", { class: "api-reference-server-label" }, t(lang, "api_server")),
          " ",
          code(view.server),
        ),
  );
}

/**
 * The operation article, marked for Pagefind. A page without the engine's operation front matter
 * falls back to the ordinary doc article, so a hand-written page stays readable instead of blank.
 */
function article(props: LayoutProps): ComponentChildren {
  const { page } = props;
  const view = operationViewOf(page.frontMatter, page.lang);
  if (view === undefined) {
    return h(
      "article",
      { class: "doc api-reference", "data-pagefind-body": true },
      breadcrumb(props) as ComponentChildren,
      h("h1", null, page.title),
      h("div", { class: "doc-body", dangerouslySetInnerHTML: { __html: articleHtml(page.html, page.lang) } }),
    );
  }
  const lang = page.lang;
  return h(
    "article",
    { class: "doc api-reference", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    operationHeader(view, lang),
    parametersSection(view.parameters, lang),
    requestBodySection(view.requestBody, lang),
    responsesSection(view.responses, lang),
  );
}

/** The API reference operation page: the docs shell around the generated operation article. */
const apiReference: Layout = (props) =>
  articleShell(props, { main: article(props) });

export default apiReference;