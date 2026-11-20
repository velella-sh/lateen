/*
 * One boot per island and page. The browser runs an island's script when it loads the page, but the
 * same bundle can be evaluated twice (two theme copies, or a fixture mounted twice), so an entry
 * point claims its island before it wires listeners. The ledger lives on the realm, so every copy of
 * the bundle shares it, and each island holds its pages weakly: a discarded document is collected
 * while the island stays marked booted. Names are a fixed set, one per island, never one per page.
 */

/** True the first time `island` boots this `page`; a later evaluation leaves the page alone. */
export function bootOnce(island: string, page: object): boolean {
  const realm = globalThis as unknown as Record<symbol, WeakSet<object> | undefined>;
  const booted = (realm[Symbol.for(`lateen.island.boot:${island}`)] ??= new WeakSet());
  if (booted.has(page)) return false;
  booted.add(page);
  return true;
}
