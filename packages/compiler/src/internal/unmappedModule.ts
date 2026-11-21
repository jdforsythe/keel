/**
 * The first file of a client bundle's graph that belongs to an app module the client entry's service map leaves out
 * (k.bundle E1011): `ids` are the bundle's module ids, `moduleOf` the app module a file is in, `skip` a file that
 * makes no calls (a stub, a virtual module), `importerOf` the file that pulled one in. Returns the module's id and
 * the importing file, or undefined when every bundled module is mapped.
 */
export function unmappedModule(
  ids: Iterable<string>,
  moduleOf: (id: string) => string | undefined,
  mapped: ReadonlySet<string>,
  skip: (id: string) => boolean,
  importerOf: (id: string) => string | undefined,
): { module: string; importer: string } | undefined {
  for (const id of [...ids].sort()) {
    if (skip(id)) continue;
    const m = moduleOf(id);
    if (m !== undefined && !mapped.has(m)) return { module: m, importer: importerOf(id) ?? id };
  }
  return undefined;
}
