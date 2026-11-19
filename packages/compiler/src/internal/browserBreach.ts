/** What a build tells about one module of its graph. */
export type GraphInfo = {
  readonly isEntry: boolean;
  readonly importedIds: readonly string[];
  readonly dynamicallyImportedIds: readonly string[];
};

/**
 * The E1007 message for a browser build's module graph (k.boundary Assertion), else undefined: the first module, in
 * breadth-first order from the entries over static and dynamic imports, that `reason` names, with the chain of
 * `show`n ids from its entry. A module `opaque` names (a stub) is not entered.
 */
export function browserBreach(
  ids: Iterable<string>,
  info: (id: string) => GraphInfo | null,
  reason: (id: string) => string | undefined,
  show: (id: string) => string,
  opaque: (id: string) => boolean,
): string | undefined {
  const from = new Map<string, string | null>();
  const todo = [...ids].filter((id) => info(id)?.isEntry === true).sort();
  for (const id of todo) from.set(id, null);
  for (let i = 0; i < todo.length; i++) {
    const id = todo[i] ?? "";
    const why = reason(id);
    if (why !== undefined) {
      const chain: string[] = [];
      for (let at: string | null | undefined = id; typeof at === "string"; at = from.get(at)) chain.unshift(show(at));
      return `server code in browser build: ${why}: ${chain.join(" -> ")}`;
    }
    const m = info(id);
    if (m === null || opaque(id)) continue;
    for (const next of [...m.importedIds, ...m.dynamicallyImportedIds])
      if (!from.has(next)) {
        from.set(next, id);
        todo.push(next);
      }
  }
  return undefined;
}
