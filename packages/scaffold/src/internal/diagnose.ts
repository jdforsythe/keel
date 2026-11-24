import type { Manifest } from "./Manifest.ts";
import type { ProxyDiag } from "./ProxyDiag.ts";
import { importRefs } from "./importRefs.ts";
import { isCode } from "./isCode.ts";
import { isGenerated } from "./isGenerated.ts";
import { lineCol } from "./lineCol.ts";
import { moduleOf } from "./moduleOf.ts";
import { moduleUses } from "./moduleUses.ts";
import { parseSource } from "./parseSource.ts";
import { readManifest } from "./readManifest.ts";
import { resolveImport } from "./resolveImport.ts";
import { sortedKeys } from "./sortedKeys.ts";

function cycles(manifests: ReadonlyMap<string, Manifest>): string[][] {
  const found = new Map<string, string[]>();
  const ids = sortedKeys(manifests.keys());
  const walk = (id: string, stack: string[]): void => {
    const at = stack.indexOf(id);
    if (at >= 0) {
      const cyc = stack.slice(at);
      const min = [...cyc].sort()[0] ?? id;
      const k = cyc.indexOf(min);
      const canon = [...cyc.slice(k), ...cyc.slice(0, k)];
      found.set(canon.join(" -> "), canon);
      return;
    }
    if (stack.length > ids.length) return;
    for (const d of manifests.get(id)?.deps ?? []) if (manifests.has(d)) walk(d, [...stack, id]);
  };
  for (const id of ids) walk(id, []);
  return sortedKeys(found.keys()).map((k) => found.get(k) ?? []);
}

/**
 * The check proxy: what `keel check` would report that an operation can cause. TS2307 unresolved relative
 * import; E1151 import of a non-public export of another module; E1152 import from a module not in `deps`;
 * E1153 cycle in module `deps`; E1165 a `deps` entry the module does not use (`@keel/std-*` entries are not judged). Sorted by path, then position.
 */
export function diagnose(files: ReadonlyMap<string, string>): ProxyDiag[] {
  const manifests = new Map<string, Manifest>();
  for (const p of sortedKeys(files.keys())) {
    const m = /^modules\/([^/]+)\/module\.ts$/.exec(p);
    const src = files.get(p);
    if (m?.[1] === undefined || src === undefined) continue;
    const man = readManifest(p, src);
    if (man !== null) manifests.set(m[1], man);
  }
  const out: ProxyDiag[] = [];
  for (const path of sortedKeys(files.keys())) {
    const src = files.get(path);
    if (src === undefined || !isCode(path) || isGenerated(path)) continue;
    const program = parseSource(path, src);
    if (program === null) continue;
    const from = moduleOf(path);
    for (const ref of importRefs(program)) {
      if (!ref.spec.startsWith(".")) continue;
      const { line } = lineCol(src, ref.start);
      const target = resolveImport(files, path, ref.spec);
      if (target === null) {
        out.push({ code: "TS2307", path, line, message: `cannot find module '${ref.spec}'` });
        continue;
      }
      const to = moduleOf(target);
      if (from === null || to === null || from === to) continue;
      const fm = manifests.get(from);
      const tm = manifests.get(to);
      if (fm === undefined || tm === undefined) continue;
      const isContract = target.endsWith(".contract.ts");
      const name = (target.split("/").pop() ?? "").split(".")[0] ?? "";
      if (!fm.deps.includes(to))
        out.push({ code: "E1152", path, line, message: `import from module ${to}, not in ${from} deps` });
      else if (!isContract && !tm.exports.includes(name))
        out.push({ code: "E1151", path, line, message: `${name} is not a public export of module ${to}` });
    }
  }
  for (const c of cycles(manifests)) {
    const first = c[0] ?? "";
    out.push({
      code: "E1153",
      path: `modules/${first}/module.ts`,
      line: 1,
      message: `cycle in module deps: ${[...c, first].join(" -> ")}`,
    });
  }
  const uses = moduleUses(files);
  for (const [id, man] of manifests)
    for (const dep of man.deps)
      if (!dep.startsWith("@keel/std-") && uses.get(id)?.has(dep) !== true)
        out.push({
          code: "E1165",
          path: `modules/${id}/module.ts`,
          line: 1,
          message: `module ${id} lists ${dep} in deps and does not use it`,
        });
  return out;
}
