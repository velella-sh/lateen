import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "endpoint";
export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type EndpointProps = {
  method?: string;
  path?: string;
  parameters?: string;
};

export interface EndpointParameter {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}

const PARAMETER = /(\{[^{}]+\}|:[A-Za-z_][A-Za-z0-9_]*)/;

export function methodOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const method = value.trim().toUpperCase();
  return method === "" ? undefined : method;
}

export function pathSegments(path: string): { text: string; parameter: boolean }[] {
  return path.split(PARAMETER).map((text, index) => ({ text, parameter: index % 2 === 1 }));
}

export function parseParameters(raw: unknown): EndpointParameter[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return [];
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: EndpointParameter[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const record = entry as Readonly<Record<string, unknown>>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;
    const type = typeof record.type === "string" ? record.type.trim() : "string";
    out.push({
      name,
      type: type || "string",
      required: typeof record.required === "boolean" ? record.required : true,
      description: typeof record.description === "string" ? record.description.trim() : "",
    });
  }
  return out;
}

export default function endpoint({ props, html }: ComponentProps<EndpointProps>) {
  const method = methodOf(props.method);
  const path = typeof props.path === "string" ? props.path : "";
  const parameters = parseParameters(props.parameters);

  return h(
    "div",
    { class: "endpoint", "data-method": method, "data-path": path },
    h(
      "div",
      { class: "endpoint-line" },
      method
        ? h("span", { class: "badge pill ink endpoint-method", "data-variant": "ink" }, method)
        : null,
      h(
        "code",
        { class: "endpoint-path", dir: "ltr" },
        pathSegments(path).map(({ text, parameter }) =>
          parameter ? h("span", { class: "endpoint-param" }, text) : text,
        ),
      ),
    ),
    parameters.length === 0
      ? null
      : h(
          "div",
          { class: "kv endpoint-params" },
          parameters.flatMap((parameter) => [
            h("span", null, parameter.name),
            h(
              "strong",
              null,
              [parameter.type, parameter.required ? "required" : "optional", parameter.description]
                .filter(Boolean)
                .join(", "),
            ),
          ]),
        ),
    html
      ? h("div", { class: "endpoint-body", dangerouslySetInnerHTML: { __html: html } })
      : null,
  );
}
