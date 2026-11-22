import { isPublicField, publicFieldsOf } from "./public-fields.ts";
import { isRecord } from "./guards.ts";
import type { Site } from "@velella/mizzen/contracts";

/** One public claim backing a record field: its stable id, the public title, and a safe URL. */
export interface EvidenceClaim {
  readonly id: string;
  readonly title: string;
  readonly url: string;
}

/** A site-relative path that is not protocol-relative, or an `https:` URL with no whitespace or quotes. */
const SAFE_URL = /^(?:\/(?![/\\])|https:\/\/)[^\s"'<>\\]*$/i;

/** The collection's configured evidence field, trimmed and non-empty; undefined when it names none. */
export function evidenceFieldOf(site: Site | undefined, collection: string): string | undefined {
  const field = site?.config?.collections?.[collection]?.evidence;
  if (typeof field !== "string") return undefined;
  const trimmed = field.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * The valid public claims backing one field of a record, in source order. A claim with no usable
 * title, id, or safe URL is skipped, and nothing but the three public keys is returned.
 */
export function claimsOf(
  site: Site | undefined,
  collection: string,
  recordId: string,
  field: string,
): EvidenceClaim[] {
  const record = site?.collections?.[collection]?.records.find((entry) => entry.id === recordId);
  if (record === undefined) return [];
  const evidenceField = evidenceFieldOf(site, collection);
  if (evidenceField === undefined) return [];
  if (!isPublicField(site, collection, field)) return [];
  const value = publicFieldsOf(site, collection, record.fields)[evidenceField];
  if (!isRecord(value)) return [];
  const entries = value[field];
  if (!Array.isArray(entries)) return [];
  const claims: EvidenceClaim[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const { id, title, url } = entry;
    if (typeof id !== "string" || id === "") continue;
    if (typeof title !== "string") continue;
    const trimmed = title.trim();
    if (trimmed === "") continue;
    if (typeof url !== "string" || !SAFE_URL.test(url)) continue;
    claims.push({ id, title: trimmed, url });
  }
  return claims;
}
