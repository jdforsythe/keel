/** The conditions Node matches for an `import` (k.library: an entry with no `keel` is read at its other target). */
const NODE = new Set(["node", "import", "default"]);

/**
 * The file an `exports` entry's `target` names: the target itself when a string, else its `keel` condition, else the
 * first condition Node matches for an import, in the order written, read the same way.
 */
export function entryTarget(target: unknown): string | undefined {
  if (typeof target === "string") return target;
  if (typeof target !== "object" || target === null || Array.isArray(target)) return undefined;
  const keel: unknown = Reflect.get(target, "keel");
  if (typeof keel === "string") return keel;
  for (const [cond, next] of Object.entries(target)) if (NODE.has(cond)) return entryTarget(next);
  return undefined;
}
