import type { Site } from "@velella/mizzen/contracts";
import { isRecord } from "./guards.ts";

type Fields = Readonly<Record<string, unknown>>;

function policyOf(site: Site | undefined, collection: string): readonly string[] | undefined {
  return site?.config?.collections?.[collection]?.public;
}

function segments(path: string): string[] {
  return path.split(".").map((key) => key.trim()).filter(Boolean);
}

/** Whether a field's entire value can be published, including by alternate sources such as normalized dates. */
export function isPublicField(site: Site | undefined, collection: string, field: string): boolean {
  const policy = policyOf(site, collection);
  if (policy === undefined) return true;
  const path = segments(field);
  return path[0] === "id" || policy.some((entry) => {
    const prefix = segments(entry);
    return prefix.length > 0 && prefix.every((key, index) => key === path[index]);
  });
}

function project(value: unknown, paths: readonly string[][]): unknown {
  if (Array.isArray(value)) return value.map((item) => project(item, paths)).filter((item) => item !== undefined);
  if (!isRecord(value)) return undefined;
  return projectFields(value, paths);
}

function projectFields(fields: Fields, paths: readonly string[][]): Fields {
  return Object.fromEntries(Object.entries(fields).flatMap(([name, value]) => {
    const matching = paths.filter(([key]) => key === name);
    if (matching.some((path) => path.length === 1)) return [[name, value]];
    if (matching.length === 0) return [];
    const child = project(value, matching.map((path) => path.slice(1)));
    return child === undefined ? [] : [[name, child]];
  }));
}

/** The record's public fields, with allowed subtrees and the containers of allowed nested fields. */
export function publicFieldsOf(site: Site | undefined, collection: string, fields: Fields): Fields {
  const policy = policyOf(site, collection);
  return policy === undefined ? fields : projectFields(fields, [["id"], ...policy.map(segments)]);
}
