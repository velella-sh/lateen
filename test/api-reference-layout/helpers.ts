import type { Heading, LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";

/** The source position of a generated page: the top of the OpenAPI file. */
export const pos: SourcePos = { file: "openapi.json", line: 1, column: 1, endLine: 1, endColumn: 1 };

export function configWith(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Example",
    base: "",
    lang: "en",
    dir: "ltr",
    languages: [],
    source: ".",
    include: [],
    exclude: [],
    navigation: "_data/navigation.yml",
    defaults: [],
    theme: { options: {} },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
    feeds: {},
    ...overrides,
  };
}

export function heading(depth: 1 | 2 | 3, text: string): Heading {
  return { depth, text, id: text.toLowerCase(), pos };
}

export function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/reference/createWidget/",
    source: pos,
    frontMatter: { layout: "api-reference" },
    title: "Create a widget",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    ...overrides,
  };
}

export function layoutProps(
  page: Page,
  nav: Site["nav"]["main"] = [],
  trail: LayoutProps["trail"] = [],
  pages: readonly Page[] = [page],
): LayoutProps {
  const site: Site = { config: configWith(), pages: [...pages], nav: { main: nav }, data: {}, collections: {} };
  return {
    renderComponent: () => "",
    site,
    page,
    trail,
    pager: {},
    head: { title: `${page.title} · Example`, meta: [], links: [], jsonLd: [] },
    islands: [],
  };
}

/** The full operation the tests render: parameters, body, schema, examples, and three responses. */
export const fullOperation = {
  id: "createWidget",
  method: "post",
  path: "/widgets",
  url: "/reference/createWidget/",
  title: "Create a widget",
  description: "Creates one widget and returns it.",
  tags: ["Widgets"],
  deprecated: true,
  server: "https://api.example.com/v1",
  parameters: [
    {
      name: "expand",
      in: "query",
      required: false,
      deprecated: false,
      description: "Related records to include.",
      schema: { type: "string", enum: ["owner", "history"] },
      examples: [],
    },
    {
      name: "id",
      in: "path",
      required: true,
      deprecated: true,
      description: "The widget id.",
      schema: { type: "string", format: "uuid" },
      examples: [{ name: "sample", value: "w_123" }],
    },
  ],
  requestBody: {
    required: true,
    description: "The widget to create.",
    content: [
      {
        type: "application/json",
        schema: {
          type: "object",
          required: ["name"],
          properties: [
            { name: "name", schema: { type: "string", description: "The widget name." } },
            {
              name: "owner",
              schema: {
                type: "object",
                properties: [{ name: "id", schema: { type: "string", format: "uuid" } }],
              },
            },
          ],
        },
        examples: [{ name: "minimal", summary: "Just a name.", value: { name: "Gizmo" } }],
      },
    ],
  },
  responses: [
    {
      status: "201",
      description: "The widget was created.",
      content: [
        {
          type: "application/json",
          schema: {
            type: "object",
            properties: [
              { name: "id", schema: { type: "string" } },
              { name: "owner", schema: { type: "object", properties: [] } },
            ],
          },
          examples: [{ name: "created", value: { id: "w_123", name: "Gizmo" } }],
        },
      ],
    },
    { status: "500", description: "The service failed.", content: [] },
  ],
};

/** The minimal operation: no description, tags, server, parameters, or body. */
export const minimalOperation = {
  id: "ping",
  method: "get",
  path: "/ping",
  url: "/reference/ping/",
  title: "GET /ping",
  tags: [],
  deprecated: false,
  parameters: [],
  responses: [{ status: "200", description: "The service is up.", content: [] }],
};

export function operationPage(operation: unknown, overrides: Partial<Page> = {}): Page {
  return pageWith({
    frontMatter: { layout: "api-reference", apiReference: { kind: "operation", operation } },
    ...overrides,
  });
}

export function indexPage(model: unknown, overrides: Partial<Page> = {}): Page {
  return pageWith({
    url: "/reference/",
    title: "Widget API",
    frontMatter: { layout: "api-reference-index", apiReference: { kind: "index", ...(model as object) } },
    ...overrides,
  });
}
