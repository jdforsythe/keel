import type { Program } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { Checked } from "../Checked.ts";
import { bindingCalls } from "../bindingCalls.ts";
import { contractCalls } from "../contractCalls.ts";
import { isTestPath } from "../isTestPath.ts";
import { propertyOf } from "../propertyOf.ts";
import { schemaMarks } from "../schemaMarks.ts";
import { stemOf } from "../stemOf.ts";
import type { Entry } from "./Entry.ts";
import type { FileFacts } from "./FileFacts.ts";
import type { Manifest } from "./Manifest.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { addEntryFix } from "./addEntryFix.ts";
import { depsCycles } from "./depsCycles.ts";
import { discoverModules } from "./discoverModules.ts";
import { joinPath } from "./joinPath.ts";
import { moduleDiag } from "./moduleDiag.ts";
import { moduleOf } from "./moduleOf.ts";
import { prefixFix } from "./prefixFix.ts";
import { removeEntryFix } from "./removeEntryFix.ts";
import { resolveImport } from "./resolveImport.ts";
import { scanFile } from "./scanFile.ts";
import { short } from "./short.ts";
import { stdConfig } from "./stdConfig.ts";

type Scanned = {
  readonly file: SourceFile;
  readonly module: ModuleInfo;
  readonly facts: FileFacts;
  readonly client: boolean;
  /** The keys of the file's `contract(...)` calls. */
  readonly routes: readonly Entry[];
  /** The literal `layout` values of the file's `manifest(...)` bindings. */
  readonly layouts: readonly Entry[];
};

const SERVER = /\.server\.[cm]?[jt]sx?$/;

/**
 * E1107 (k.leave Snapshots): a `store(...)` call in a client-reachable file (a `.tsx` or `.jsx` file, or a file one imports
 * through relative imports, never a `*.server.*` file) whose state schema holds a `.pii(class)` of a class its
 * module's `clientPii` does not list; once per call, the fix adds the classes to `clientPii`.
 */
function clientPii(scanned: readonly Scanned[], files: readonly SourceFile[]): Diagnostic[] {
  const byPath = new Map(scanned.map((s) => [s.file.path, s]));
  const todo = scanned.filter((s) => s.client);
  const reached = new Set(todo);
  for (let s = todo.pop(); s !== undefined; s = todo.pop()) {
    const dir = s.file.path.slice(0, Math.max(0, s.file.path.lastIndexOf("/")));
    for (const imp of s.facts.imports) {
      const next = imp.value.startsWith(".") ? byPath.get(joinPath(dir, imp.value)) : undefined;
      if (next === undefined || reached.has(next) || SERVER.test(next.file.path)) continue;
      reached.add(next);
      todo.push(next);
    }
  }
  const out: Diagnostic[] = [];
  for (const { file, module, facts } of reached) {
    const man = module.manifest;
    if (man === null) continue;
    const listed = values(man, "clientPii");
    for (const arg of facts.stores) {
      const classes = new Set<string>();
      schemaMarks(arg, file, files, new Set(), classes);
      const missing = [...classes].filter((c) => !listed.has(c));
      if (missing.length === 0) continue;
      const msg = `store state reaching #k-state holds .pii('${short(missing.join("', '"))}'), not in clientPii`;
      const fix = addEntryFix(module.file, man.clientPii, missing, { key: "clientPii", at: man.tail });
      out.push({ ...moduleDiag("E1107", file, arg.start, msg, fix), see: "k.leave" });
    }
  }
  return out;
}
type Project = {
  readonly modules: readonly ModuleInfo[];
  readonly byKey: ReadonlyMap<string, ModuleInfo>;
};

const values = (m: Manifest, k: "deps" | "capabilities" | "exports" | "clientPii"): Set<string> =>
  new Set(m[k].entries.map((e) => e.value));

/** E1154: `public.exports` naming no file stem of the module (fix removes it). */
function publicMissing(m: ModuleInfo, stems: ReadonlySet<string>): Diagnostic[] {
  const man = m.manifest;
  if (man === null) return [];
  const out: Diagnostic[] = [];
  man.exports.entries.forEach((e, i) => {
    if (stems.has(e.value)) return;
    const msg = `module ${short(m.key)} public.exports names ${short(e.value)}, which does not exist`;
    out.push(moduleDiag("E1154", m.file, e.start, msg, removeEntryFix(m.file, man.exports, i)));
  });
  return out;
}

/** The keys of every `contract(id, entries)` call of a file (k.contract), as route id entries at the key. */
function contractRoutes(file: SourceFile, program: Program): Entry[] {
  return contractCalls(file, program).flatMap((c) =>
    c.list.map((e) => ({ value: e.id, start: e.prop.key.start, end: e.prop.key.end })),
  );
}

/** The literal `layout` of every `manifest(contract, binding)` entry of a file (k.routes Layouts), at the value. */
function bindingLayouts(file: SourceFile, program: Program): Entry[] {
  const out: Entry[] = [];
  for (const call of bindingCalls(file, program))
    for (const { obj } of call.list) {
      const v = obj === null ? undefined : propertyOf(obj, "layout")?.value;
      if (v?.type === "Literal" && typeof v.value === "string")
        out.push({ value: v.value, start: v.start, end: v.end });
    }
  return out;
}

/** E1155: contract route ids, store ids, transaction names, and error codes not prefixed `<module id>.` (fix: prefix). */
function unprefixed({ file, module, facts, routes }: Scanned): Diagnostic[] {
  const want = `${module.prefix}.`;
  const all = [...routes.map((e) => ({ ...e, kind: "route id" })), ...facts.ids];
  return all
    .filter((e) => !e.value.startsWith(want))
    .map((e) => {
      const msg = `${e.kind} '${short(e.value)}' is not prefixed by module id '${short(module.prefix)}.'`;
      return moduleDiag("E1155", file, e.start, msg, prefixFix(file, e, module.prefix));
    });
}

/**
 * E1151, E1152, E1156 for one file of a non-opaque module. An import from another module needs it in `deps` (E1152); a
 * binding's `layout` naming a layout id of another module (k.routes Layouts, at `layout`) needs the two related by `deps`
 * in either direction: this module lists the layout's, or the layout's module, which composes the page, lists this
 * one (E1152 when neither does; the `layout` adds no `deps` edge). An import, unless
 * it is that module's contract, the export in its `public.exports` (E1151). Fixes add the missing entry
 * to a manifest list: the target's `public.exports` (E1151), this module's `deps` (E1152) or `capabilities` (E1156).
 */
function access({ file, module, facts, layouts }: Scanned, man: Manifest, p: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  const deps = values(man, "deps");
  const own = short(module.key);
  for (const imp of facts.imports) {
    const r = resolveImport(file.path, imp.value, p.modules, p.byKey);
    if (r === null || r.module === module) continue;
    const t = short(r.module.key);
    if (!deps.has(r.module.key)) {
      const msg = `module ${own} imports from ${t}, which is not in its deps`;
      out.push(moduleDiag("E1152", file, imp.start, msg, addEntryFix(module.file, man.deps, r.module.key)));
    }
    const tm = r.module.manifest;
    if (tm === null || r.contract || r.name === null || values(tm, "exports").has(r.name)) continue;
    const msg = `${short(r.name)} is not in public.exports of module ${t}; ${own} cannot import it`;
    out.push(moduleDiag("E1151", file, imp.start, msg, addEntryFix(r.module.file, tm.exports, r.name)));
  }
  for (const l of layouts) {
    const prefix = l.value.slice(0, Math.max(0, l.value.indexOf(".")));
    const target = prefix === module.prefix ? undefined : p.modules.find((m) => m.prefix === prefix);
    if (target === undefined || target === module || deps.has(target.key)) continue;
    if (target.manifest !== null && values(target.manifest, "deps").has(module.key)) continue;
    const t = short(target.key);
    const msg = `module ${own} binds layout ${short(l.value)} of ${t}; neither lists the other in its deps`;
    out.push(moduleDiag("E1152", file, l.start, msg, addEntryFix(module.file, man.deps, target.key)));
  }
  const caps = values(man, "capabilities");
  const reported = new Set<string>();
  for (const c of facts.ctx) {
    if (caps.has(c.value) || reported.has(c.value)) continue;
    reported.add(c.value);
    const use = c.value === "observe" ? "calls observe" : `uses ctx.${short(c.value)}`;
    const msg = `module ${own} ${use} but it is not in its capabilities`;
    out.push(moduleDiag("E1156", file, c.start, msg, addEntryFix(module.file, man.capabilities, c.value)));
  }
  return out;
}

/**
 * The k.module project pass (E1151-E1158) over every parsed code file: discover manifests (`modules/<id>/module.ts`
 * and stdlib `node_modules/@keel/std-x/module.ts`), map each non-test file to its module by folder, read the
 * manifests statically, then check deps cycles, the public surface, `std` config (E1158), id prefixes (contract keys
 * among them), and cross-module access from imports and `ctx` capability uses. Files outside every module are not
 * checked. Deterministic: files are visited in path order and the caller sorts the result.
 */
export function moduleChecks(checked: readonly Checked[]): Diagnostic[] {
  const modules = discoverModules(checked);
  if (modules.length === 0) return [];
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const scanned: Scanned[] = [];
  const stems = new Map<ModuleInfo, Set<string>>();
  const ordered = [...checked].sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));
  for (const { file, parsed } of ordered) {
    const module = moduleOf(file.path, modules);
    if (module === undefined || isTestPath(file.path.slice(module.root.length))) continue;
    const facts = scanFile(parsed.program);
    const client = !SERVER.test(file.path) && /\.[jt]sx$/.test(file.path);
    scanned.push({
      file,
      module,
      facts,
      client,
      routes: contractRoutes(file, parsed.program),
      layouts: bindingLayouts(file, parsed.program),
    });
    stems.set(module, (stems.get(module) ?? new Set()).add(stemOf(file.path)));
  }
  const project: Project = { modules, byKey };
  const files = checked.map((c) => c.file);
  const out: Diagnostic[] = [...depsCycles(modules, byKey), ...clientPii(scanned, files)];
  for (const m of modules) {
    out.push(...publicMissing(m, stems.get(m) ?? new Set()));
    out.push(...stdConfig(m));
  }
  for (const s of scanned) {
    out.push(...unprefixed(s));
    if (s.module.manifest !== null) out.push(...access(s, s.module.manifest, project));
  }
  return out;
}
