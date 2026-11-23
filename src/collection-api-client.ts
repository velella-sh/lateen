import { isRecord } from "./guards.ts";
import { safeHref } from "./url.ts";

/** Reveal the schema link only when Mizzen's version index advertises the file. */
export async function revealApiSchema(doc: Pick<Document, "querySelector">, request = fetch): Promise<void> {
  const row = doc.querySelector<HTMLElement>('section[aria-labelledby="collection-api"] > ul > [data-api-schema]');
  const index = row?.dataset.apiIndex;
  const schema = row?.dataset.apiSchema;
  const link = row?.querySelector("a");
  if (!row || !index || !schema?.startsWith("/") || safeHref(schema) !== schema || !link) return;

  try {
    const response = await request(index, { mode: "same-origin" });
    if (!response.ok) return;
    const manifest: unknown = await response.json();
    if (!isRecord(manifest) || !Array.isArray(manifest.collections)) return;
    if (!manifest.collections.some((entry: unknown) => isRecord(entry) && entry.schema === schema)) return;
    link.setAttribute("href", schema);
    row.hidden = false;
  } catch {
    // The static API links remain usable when the index cannot be read.
  }
}
