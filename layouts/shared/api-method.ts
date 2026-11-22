/** The method badge colors the same methods as the endpoint component, with no script. */
export function methodClassOf(method: string): string {
  const known = ["get", "post", "put", "patch", "delete"];
  const name = method.toLowerCase();
  return `api-reference-method api-reference-method-${known.includes(name) ? name : "other"}`;
}
