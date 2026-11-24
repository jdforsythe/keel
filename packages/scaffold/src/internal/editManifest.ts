import MagicString from "magic-string";
import type { ManifestChange } from "./ManifestChange.ts";
import { appendItems } from "./appendItems.ts";
import { manifestArrays } from "./manifestArrays.ts";
import { parseSource } from "./parseSource.ts";
import { stringItems } from "./stringItems.ts";

/** Apply a change to a `module.ts` source: new deps and exports are appended in sorted order, removed ones dropped; absent ones skipped. */
export function editManifest(path: string, src: string, change: ManifestChange): string {
  const program = parseSource(path, src);
  const a = program === null ? null : manifestArrays(program);
  if (a === null) return src;
  const ms = new MagicString(src);
  if (a.deps !== null) {
    const have = stringItems(a.deps);
    const add = [...change.addDeps].filter((d) => !have.includes(d) && d !== a.id).sort();
    const drop = have.filter((d) => change.removeDeps.has(d) && !change.addDeps.has(d));
    if (drop.length === 0) appendItems(ms, src, a.deps, add);
    else {
      const q = src.charAt(a.deps.elements[0]?.start ?? 0) === '"' ? '"' : "'";
      const keep = [...have.filter((d) => !drop.includes(d)), ...add];
      ms.overwrite(a.deps.start, a.deps.end, `[${keep.map((d) => q.concat(d, q)).join(", ")}]`);
    }
  }
  if (a.exports !== null) {
    const have = stringItems(a.exports);
    const add = [...change.addExports].filter((e) => !have.includes(e)).sort();
    const drop = have.filter((e) => change.removeExports.has(e) && !change.addExports.has(e));
    if (drop.length === 0) appendItems(ms, src, a.exports, add);
    else {
      const q = src.charAt(a.exports.elements[0]?.start ?? 0) === '"' ? '"' : "'";
      const keep = [...have.filter((e) => !drop.includes(e)), ...add];
      ms.overwrite(a.exports.start, a.exports.end, `[${keep.map((e) => q.concat(e, q)).join(", ")}]`);
    }
  }
  return ms.toString();
}
