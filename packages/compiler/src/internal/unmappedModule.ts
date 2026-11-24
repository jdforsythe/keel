/**
 * The first file of a client bundle's graph that belongs to an app module the client entry's service map leaves out
 * (k.bundle E1011): `ids` are the bundle's module ids, `moduleOf` the app module a file is in, `skip` a file that
 * makes no calls (a stub, a virtual module), `importersOf` the files that pulled one in, in the order the bundler
 * records them. Returns the module's id and the first file outside that module that imports one of its files, or
 * undefined when every bundled module is mapped.
 */
export function unmappedModule(
  ids: Iterable<string>,
  moduleOf: (id: string) => string | undefined,
  mapped: ReadonlySet<string>,
  skip: (id: string) => boolean,
  importersOf: (id: string) => readonly string[],
): { module: string; importer: string } | undefined {
  const all = [...ids].sort();
  for (const id of all) {
    if (skip(id)) continue;
    const m = moduleOf(id);
    if (m === undefined || mapped.has(m)) continue;
    const files = [...all].filter((x) => moduleOf(x) === m && !skip(x));
    for (const f of files) {
      const importer = importersOf(f).find((i) => moduleOf(i) !== m);
      if (importer !== undefined) return { module: m, importer };
    }
    return { module: m, importer: id };
  }
  return undefined;
}
