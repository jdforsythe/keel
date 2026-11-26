/** Whether `v` holds a `keel` key at any depth. */
const holdsKeel = (v: unknown): boolean =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  Object.entries(v).some(([k, inner]) => k === "keel" || holdsKeel(inner));

/**
 * k.looks Entries (E1815): each `exports` entry of a library's parsed `package.json` that holds `keel` other than as
 * its first top-level key, as `[key, what]`: `lists keel after another condition`, or `nests keel under another
 * condition` when `keel` sits only deeper.
 */
export function entryProblems(pkg: unknown): [string, string][] {
  const exportsMap: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "exports") : undefined;
  if (typeof exportsMap !== "object" || exportsMap === null || Array.isArray(exportsMap)) return [];
  const keyed = Object.keys(exportsMap).some((k) => k.startsWith("."));
  const entries: [string, unknown][] = keyed ? Object.entries(exportsMap) : [[".", exportsMap]];
  const out: [string, string][] = [];
  for (const [key, target] of entries) {
    if (typeof target !== "object" || target === null || Array.isArray(target)) continue;
    const keys = Object.keys(target);
    if (keys.includes("keel")) {
      if (keys[0] !== "keel") out.push([key, "lists keel after another condition"]);
    } else if (holdsKeel(target)) out.push([key, "nests keel under another condition"]);
  }
  return out;
}
