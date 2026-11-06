import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { Checked } from "../Checked.ts";
import { isTestPath } from "../isTestPath.ts";
import { stemOf } from "../stemOf.ts";
import type { FileFacts } from "./FileFacts.ts";
import type { Manifest } from "./Manifest.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { addEntryFix } from "./addEntryFix.ts";
import { depsCycles } from "./depsCycles.ts";
import { discoverModules } from "./discoverModules.ts";
import { moduleDiag } from "./moduleDiag.ts";
import { moduleOf } from "./moduleOf.ts";
import { removeEntryFix } from "./removeEntryFix.ts";
import { resolveImport } from "./resolveImport.ts";
import { scanFile } from "./scanFile.ts";
import { short } from "./short.ts";

type Scanned = { readonly file: SourceFile; readonly module: ModuleInfo; readonly facts: FileFacts };
type Project = {
  readonly modules: readonly ModuleInfo[];
  readonly byKey: ReadonlyMap<string, ModuleInfo>;
  /** Route id -> the module whose `manifest({...})` declares it (first by path). */
  readonly routeOwner: ReadonlyMap<string, ModuleInfo>;
};

const values = (m: Manifest, k: "deps" | "capabilities" | "exports" | "routes"): Set<string> =>
  new Set(m[k].entries.map((e) => e.value));

/** E1154: `public.exports` naming no file stem of the module, `public.routes` naming no declared route. */
function publicMissing(m: ModuleInfo, stems: ReadonlySet<string>, routes: ReadonlySet<string>): Diagnostic[] {
  const man = m.manifest;
  if (man === null) return [];
  const out: Diagnostic[] = [];
  man.exports.entries.forEach((e, i) => {
    if (stems.has(e.value)) return;
    const msg = `module ${short(m.key)} public.exports names ${short(e.value)}, which does not exist`;
    out.push(moduleDiag("E1154", m.file, e.start, msg, removeEntryFix(m.file, man.exports, i)));
  });
  man.routes.entries.forEach((e, i) => {
    if (routes.has(e.value)) return;
    const msg = `module ${short(m.key)} public.routes names ${short(e.value)}, which does not exist`;
    out.push(moduleDiag("E1154", m.file, e.start, msg, removeEntryFix(m.file, man.routes, i)));
  });
  return out;
}

/** E1155: declared route ids, store ids, transaction names, and error codes not prefixed `<module id>.`. */
function unprefixed({ file, module, facts }: Scanned): Diagnostic[] {
  const want = `${module.prefix}.`;
  const all = [...facts.routes.map((e) => ({ ...e, kind: "route id" })), ...facts.ids];
  return all
    .filter((e) => !e.value.startsWith(want))
    .map((e) => {
      const msg = `${e.kind} '${short(e.value)}' is not prefixed by module id '${short(module.prefix)}.'`;
      return moduleDiag("E1155", file, e.start, msg);
    });
}

/** The module owning a route id: its declaring module, else the module whose prefix is the id's first segment. */
function ownerOf(route: string, p: Project): ModuleInfo | undefined {
  const declared = p.routeOwner.get(route);
  if (declared !== undefined) return declared;
  const head = route.slice(0, Math.max(0, route.indexOf(".")));
  return p.modules.find((m) => m.prefix === head);
}

/** E1151, E1152, E1156, E1157 for one file of a non-opaque module. */
function access({ file, module, facts }: Scanned, man: Manifest, p: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  const deps = values(man, "deps");
  const own = short(module.key);
  const notInDeps = (target: ModuleInfo, at: number, msg: string): void => {
    if (deps.has(target.key)) return;
    out.push(moduleDiag("E1152", file, at, msg, addEntryFix(module.file, man.deps, target.key)));
  };
  for (const imp of facts.imports) {
    const r = resolveImport(file.path, imp.value, p.modules, p.byKey);
    if (r === null || r.module === module) continue;
    const t = short(r.module.key);
    notInDeps(r.module, imp.start, `module ${own} imports from ${t}, which is not in its deps`);
    const tm = r.module.manifest;
    if (tm === null || r.name === null || values(tm, "exports").has(r.name)) continue;
    const msg = `${short(r.name)} is not in public.exports of module ${t}; ${own} cannot import it`;
    out.push(moduleDiag("E1151", file, imp.start, msg));
  }
  for (const h of facts.hrefs) {
    const target = ownerOf(h.value, p);
    if (target === undefined || target === module) continue;
    const t = short(target.key);
    notInDeps(target, h.start, `module ${own} links to ${short(h.value)} of ${t}, which is not in its deps`);
    const tm = target.manifest;
    if (tm === null || values(tm, "routes").has(h.value)) continue;
    const msg = `route ${short(h.value)} is not in public.routes of module ${t}; ${own} cannot link to it`;
    out.push(moduleDiag("E1157", file, h.start, msg));
  }
  const caps = values(man, "capabilities");
  const reported = new Set<string>();
  for (const c of facts.ctx) {
    if (caps.has(c.value) || reported.has(c.value)) continue;
    reported.add(c.value);
    const msg = `module ${own} uses ctx.${short(c.value)} but it is not in its capabilities`;
    out.push(moduleDiag("E1156", file, c.start, msg, addEntryFix(module.file, man.capabilities, c.value)));
  }
  return out;
}

/**
 * The k.module project pass (E1151-E1157) over every parsed code file: discover manifests (`modules/<id>/module.ts`
 * and stdlib `node_modules/@keel/std-x/module.ts`), map each non-test file to its module by folder, read the
 * manifests statically, then check deps cycles, the public surface, id prefixes, and cross-module access from
 * imports, `href()` calls, and `ctx` capability uses. Files outside every module are not checked. Deterministic:
 * files are visited in path order and the caller sorts the result.
 */
export function moduleChecks(checked: readonly Checked[]): Diagnostic[] {
  const modules = discoverModules(checked);
  if (modules.length === 0) return [];
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const scanned: Scanned[] = [];
  const stems = new Map<ModuleInfo, Set<string>>();
  const routes = new Map<ModuleInfo, Set<string>>();
  const routeOwner = new Map<string, ModuleInfo>();
  const ordered = [...checked].sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));
  for (const { file, parsed } of ordered) {
    const module = moduleOf(file.path, modules);
    if (module === undefined || isTestPath(file.path.slice(module.root.length))) continue;
    const facts = scanFile(parsed.program);
    scanned.push({ file, module, facts });
    stems.set(module, (stems.get(module) ?? new Set()).add(stemOf(file.path)));
    const declared = routes.get(module) ?? new Set();
    routes.set(module, declared);
    for (const r of facts.routes) {
      declared.add(r.value);
      if (!routeOwner.has(r.value)) routeOwner.set(r.value, module);
    }
  }
  const project: Project = { modules, byKey, routeOwner };
  const out: Diagnostic[] = [...depsCycles(modules, byKey)];
  for (const m of modules) out.push(...publicMissing(m, stems.get(m) ?? new Set(), routes.get(m) ?? new Set()));
  for (const s of scanned) {
    out.push(...unprefixed(s));
    if (s.module.manifest !== null) out.push(...access(s, s.module.manifest, project));
  }
  return out;
}
