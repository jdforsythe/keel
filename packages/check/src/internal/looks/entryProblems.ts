/** Whether `v` holds a `keel` key at any depth. */
const holdsKeel = (v: unknown): boolean =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  Object.entries(v).some(([k, inner]) => k === "keel" || holdsKeel(inner));

/** Whether a `*` key (`./*`, `./tok*`) matches `subpath`, as Node's subpath patterns match. */
function matches(key: string, subpath: string): boolean {
  const star = key.indexOf("*");
  if (star < 0) return false;
  const head = key.slice(0, star);
  const tail = key.slice(star + 1);
  return subpath.length >= head.length + tail.length && subpath.startsWith(head) && subpath.endsWith(tail);
}

/**
 * k.entries Shape (E1815): what is out of shape in a library's parsed `package.json` `exports`, as `[key, what]`
 * (`key` undefined for the whole `exports`). `exists` tells whether the library holds a file at a path relative to
 * its folder; `imported` lists the subpaths (`.`, `./tokens`) the files check reads import from the library. An
 * entry with no `keel` at all is read at its other target (k.library); a `*` key is out of shape only for an
 * imported subpath no explicit entry gives.
 */
export function entryProblems(
  pkg: unknown,
  exists: (rel: string) => boolean,
  imported: readonly string[],
): [string | undefined, string][] {
  const exportsMap: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "exports") : undefined;
  if (exportsMap === undefined) return [];
  if (typeof exportsMap !== "object" || exportsMap === null || Array.isArray(exportsMap))
    return [[undefined, "exports is no object"]];
  const out: [string | undefined, string][] = [];
  const keys = Object.keys(exportsMap);
  for (const [key, target] of Object.entries(exportsMap)) {
    if (typeof target !== "object" || target === null || Array.isArray(target)) {
      out.push([key, "is no object with keel first"]);
      continue;
    }
    const conditions = Object.keys(target);
    if (!conditions.includes("keel")) {
      if (holdsKeel(target)) out.push([key, "nests keel under another condition"]);
      continue;
    }
    if (conditions[0] !== "keel") {
      out.push([key, "lists keel after another condition"]);
      continue;
    }
    const file: unknown = Reflect.get(target, "keel");
    const rel = typeof file === "string" ? file.replace(/^\.\//, "") : "";
    const placed = /^(?:src|unsafe)\//.test(rel) && typeof file === "string" && file.startsWith("./");
    if (!placed || (!rel.includes("*") && !exists(rel))) {
      out.push([key, "keel names no file"]);
      continue;
    }
    if (key.includes("*"))
      for (const sub of imported)
        if (!keys.includes(sub) && matches(key, sub)) out.push([key, `matches "${sub}"; give it an entry`]);
  }
  return out;
}
