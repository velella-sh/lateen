import assert from "node:assert/strict";
import { test } from "node:test";
import { operationViewOf } from "../../layouts/api-reference.ts";
import type { OperationView } from "../../layouts/api-reference.ts";
import { stringsOf } from "../../i18n/index.ts";
import { fullOperation, minimalOperation, operationPage, pageWith } from "./helpers.ts";

const en = stringsOf("en");

/** The view model of an operation page, which these tests always build from a valid operation. */
function viewOf(operation: unknown, lang = "en"): OperationView {
  const view = operationViewOf(operationPage(operation).frontMatter, lang);
  assert.ok(view !== undefined);
  return view;
}

test("the minimal operation selects a view with no optional fields and no empty sections", () => {
  assert.deepEqual(viewOf(minimalOperation), {
    methodLabel: "GET",
    methodClass: "api-reference-method api-reference-method-get",
    path: "/ping",
    title: "GET /ping",
    deprecated: false,
    tags: [],
    parameters: [],
    responses: [{ status: "200", description: "The service is up.", content: [] }],
  });
});

test("a page without a valid engine operation has no view model", () => {
  assert.equal(operationViewOf(pageWith().frontMatter, "en"), undefined);
  assert.equal(operationViewOf(operationPage({ ...minimalOperation, method: 7 }).frontMatter, "en"), undefined);
  assert.equal(operationViewOf(operationPage({ ...minimalOperation, responses: "200" }).frontMatter, "en"), undefined);
  assert.equal(
    operationViewOf({ layout: "api-reference", apiReference: { kind: "index", operation: minimalOperation } }, "en"),
    undefined,
  );
});

test("the method label is uppercased and the badge class falls back to other for unknown methods", () => {
  assert.equal(viewOf({ ...minimalOperation, method: "post" }).methodClass, "api-reference-method api-reference-method-post");
  const options = viewOf({ ...minimalOperation, method: "OPTIONS" });
  assert.equal(options.methodLabel, "OPTIONS");
  assert.equal(options.methodClass, "api-reference-method api-reference-method-other");
});

test("a sparse schema with no keywords selects no metadata rows and no properties", () => {
  const view = viewOf({
    ...minimalOperation,
    parameters: [{ name: "q", in: "query", required: false, deprecated: false, schema: {}, examples: [] }],
  });
  assert.deepEqual(view.parameters, [
    { location: "query", name: "q", deprecated: false, typeLabel: "—", requiredLabel: "No", examples: [] },
  ]);
});

test("schema metadata is selected in display order, with nested items and additional properties", () => {
  const view = viewOf({
    ...minimalOperation,
    requestBody: {
      required: false,
      content: [
        {
          type: "application/json",
          schema: {
            type: ["string", "null"],
            format: "uuid",
            description: "A thing.",
            required: ["name"],
            enum: ["a", 2, null],
            default: false,
            additionalProperties: true,
            items: { type: "integer" },
            properties: [
              { name: "name", schema: { type: "string" } },
              { name: "other", schema: { format: "int32" } },
            ],
          },
          examples: [],
        },
      ],
    },
  });
  assert.deepEqual(view.requestBody, {
    required: false,
    content: [
      {
        type: "application/json",
        schema: {
          description: "A thing.",
          meta: [
            { kind: "code", label: en.type, value: "string | null" },
            { kind: "code", label: en.api_format, value: "uuid" },
            { kind: "codes", label: en.required, values: ["name"] },
            { kind: "codes", label: en.api_enum, values: ["a", "2", "null"] },
            { kind: "code", label: en.default, value: "false" },
            { kind: "text", label: en.api_additional_properties, value: en.yes },
            { kind: "schema", label: en.api_items, schema: { meta: [{ kind: "code", label: en.type, value: "integer" }], properties: [] } },
          ],
          properties: [
            { name: "name", typeLabel: "string", required: true, schema: { meta: [{ kind: "code", label: en.type, value: "string" }], properties: [] } },
            { name: "other", typeLabel: "int32", required: false, schema: { meta: [{ kind: "code", label: en.api_format, value: "int32" }], properties: [] } },
          ],
        },
        examples: [],
      },
    ],
  });
});

test("an object additionalProperties schema is selected as a nested schema row", () => {
  const view = viewOf({
    ...minimalOperation,
    responses: [
      {
        status: "200",
        description: "ok",
        content: [{ type: "application/json", schema: { additionalProperties: { type: "boolean" } }, examples: [] }],
      },
    ],
  });
  assert.deepEqual(view.responses[0]?.content[0]?.schema?.meta, [
    {
      kind: "schema",
      label: en.api_additional_properties,
      schema: { meta: [{ kind: "code", label: en.type, value: "boolean" }], properties: [] },
    },
  ]);
});

test("example values become code text: strings stay text and other values become JSON", () => {
  const view = viewOf({
    ...minimalOperation,
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        deprecated: true,
        schema: { type: "string", format: "uuid" },
        examples: [
          { name: "plain", value: "w_123" },
          { name: "json", summary: "An object.", value: { id: 1 } },
        ],
      },
    ],
  });
  assert.deepEqual(view.parameters[0], {
    location: "path",
    name: "id",
    deprecated: true,
    typeLabel: "string (uuid)",
    requiredLabel: "Yes",
    examples: [
      { name: "plain", text: "w_123" },
      { name: "json", summary: "An object.", text: '{\n  "id": 1\n}' },
    ],
  });
});

test("a blank response description is dropped and a media type without a schema keeps none", () => {
  const view = viewOf({
    ...minimalOperation,
    responses: [
      { status: "204", description: "   ", content: [] },
      { status: "200", description: "ok", content: [{ type: "text/plain", examples: [{ name: "e", value: "hi" }] }] },
    ],
  });
  assert.deepEqual(view.responses, [
    { status: "204", content: [] },
    { status: "200", description: "ok", content: [{ type: "text/plain", examples: [{ name: "e", text: "hi" }] }] },
  ]);
});

test("the full operation keeps its optional header fields, parameters, body, and responses", () => {
  const view = viewOf(fullOperation);
  assert.equal(view.methodLabel, "POST");
  assert.equal(view.description, "Creates one widget and returns it.");
  assert.equal(view.deprecated, true);
  assert.deepEqual(view.tags, ["Widgets"]);
  assert.equal(view.server, "https://api.example.com/v1");
  assert.equal(view.parameters.length, 2);
  assert.equal(view.requestBody?.required, true);
  assert.equal(view.requestBody?.description, "The widget to create.");
  assert.deepEqual(view.responses.map((response) => response.status), ["201", "500"]);
});

test("labels in the view model come from the page language", () => {
  const fa = stringsOf("fa");
  const view = viewOf(fullOperation, "fa");
  assert.equal(view.parameters[0]?.requiredLabel, fa.no);
  assert.equal(view.parameters[1]?.requiredLabel, fa.yes);
  const meta = view.requestBody?.content[0]?.schema?.meta ?? [];
  assert.deepEqual(meta.map((row) => row.label), [fa.type, fa.required]);
});