import { SERVER_ONLY_NAME } from "@keel/compiler/internal";
import type { CallExpression, Program } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { RefLink } from "./RefLink.ts";
import { callsByStart } from "./callsByStart.ts";
import { followRef } from "./followRef.ts";
import { importIndex } from "./importIndex.ts";
import { isAstNode } from "./isAstNode.ts";
import { isClientReachable } from "./isClientReachable.ts";
import { isTestPath } from "./isTestPath.ts";
import type { ModuleInfo } from "./modules/ModuleInfo.ts";
import { addEntryFix } from "./modules/addEntryFix.ts";
import { moduleDiag } from "./modules/moduleDiag.ts";
import { moduleOf } from "./modules/moduleOf.ts";
import { short } from "./modules/short.ts";
import { storeClasses } from "./storeClasses.ts";
import type { Maker } from "./storeMakers/Maker.ts";
import type { MakerPath } from "./storeMakers/MakerPath.ts";
import type { SiteRead } from "./storeMakers/SiteRead.ts";
import { calleeKey } from "./storeMakers/calleeKey.ts";
import { deferredTo } from "./storeMakers/deferredTo.ts";
import { fnKeyOf } from "./storeMakers/fnKeyOf.ts";
import { makerRead } from "./storeMakers/makerRead.ts";
import { makerValueUses } from "./storeMakers/makerValueUses.ts";
import { topRefs } from "./topRefs.ts";
import { topologyFor } from "./topologyFor.ts";

/** Kernel and stdlib code and dependencies: a store a package creates is the package's. */
const LIBRARY = /^(?:packages|node_modules|\.keel)\//;
const WRAPPERS = new Set(["ParenthesizedExpression", "TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"]);
const UNREAD = "store state not readable at ; cannot show its .pii() classes";
/** E1107's message for a state schema it cannot read, naming the part, cut from its front to fit 89 units. */
const notReadable = (part: string): string => {
  const room = 89 - UNREAD.length;
  const shown = part.length <= room ? part : `...${part.slice(part.length - room + 3)}`;
  return `store state not readable at ${shown}; cannot show its .pii() classes`;
};
const STORES = "stores() in client code can send every request store to #k-state";
type Use = { readonly call: number; readonly name: string } | { readonly other: number; readonly name: string };
const unfollowed = (name: string): string => `${name} of @keel/store used other than as a call; check cannot follow it`;
const MAKER_USE = "store maker  used other than as a call; check cannot follow it";
/** E1107's message for a store maker used other than as a call, its name cut from its front to fit 89 units. */
const makerUnfollowed = (name: string): string => {
  const room = 89 - MAKER_USE.length;
  const shown = name.length <= room ? name : `...${name.slice(name.length - room + 3)}`;
  return `store maker ${shown} used other than as a call; check cannot follow it`;
};

/** What a top-level name of `file` is in `@keel/store`: its `store` or `stores` export, its namespace, or none. */
function storeExport(name: string, file: SourceFile, project: readonly SourceFile[]): string | undefined {
  const at = followRef({ type: "Identifier", name, start: 0, end: 0 }, file, project);
  if (at === null || at === "global" || !("package" in at) || at.package !== "@keel/store") return undefined;
  return at.name === "store" || at.name === "stores" || at.name === "*" ? at.name : undefined;
}

/** How the value standing below `links[at]` is used, past wrappers: called, kept as a top-level `const` or export, else other. */
function useOf(links: readonly RefLink[], at: number): { kind: "call"; start: number } | { kind: "kept" | "other" } {
  for (let i = at; i >= 0; i--) {
    const link = links[i];
    if (link === undefined) break;
    if (WRAPPERS.has(link.node.type) && link.key === "expression") continue;
    if (link.node.type === "CallExpression" && link.key === "callee") return { kind: "call", start: link.node.start };
    if (link.node.type === "ExportSpecifier" && link.key === "local") return { kind: "kept" };
    if (link.node.type === "VariableDeclarator" && link.key === "init") {
      const id = link.node.id;
      const decl = links[i - 1]?.node;
      const holder = links[i - 2]?.node;
      const top =
        holder?.type === "Program" ||
        (holder?.type === "ExportNamedDeclaration" && links[i - 3]?.node.type === "Program");
      const alias = isAstNode(id) && id.type === "Identifier";
      return alias && decl?.type === "VariableDeclaration" && decl.kind === "const" && top
        ? { kind: "kept" }
        : { kind: "other" };
    }
    return { kind: "other" };
  }
  return { kind: "other" };
}

/** The `store`/`stores` names a destructuring of the namespace takes, else `store`. */
function destructured(links: readonly RefLink[]): string[] {
  const up = links.at(-1);
  const id = up?.node.type === "VariableDeclarator" && up.key === "init" ? up.node.id : undefined;
  const props = isAstNode(id) && id.type === "ObjectPattern" && Array.isArray(id.properties) ? id.properties : [];
  const names = props.flatMap((p) => {
    const key = isAstNode(p) ? p.key : undefined;
    const name = isAstNode(key) ? (key.type === "Literal" ? key.value : key.name) : undefined;
    return name === "store" || name === "stores" ? [name] : [];
  });
  return names.length > 0 ? names : ["store"];
}

/**
 * The uses of `@keel/store`'s `store` and `stores` in `file` (k.leave E1107): each call, under any local name, as a
 * namespace member, through a top-level `const` alias or a project re-export, and each other use with the name it
 * reads (`unfollowed`), at its identifier.
 */
function storeUses(file: SourceFile, program: Program, project: readonly SourceFile[]): Use[] {
  const out: Use[] = [];
  for (const [local, refs] of topRefs(program)) {
    const what = storeExport(local, file, project);
    if (what === undefined) continue;
    for (const ref of refs) {
      const top = ref.links.length - 1;
      if (what !== "*") {
        const use = useOf(ref.links, top);
        if (use.kind === "call") out.push({ call: use.start, name: what });
        else if (use.kind === "other") out.push({ other: ref.ident.start, name: what });
        continue;
      }
      const up = ref.links[top];
      const property = up?.node.property;
      const member = up?.node.type === "MemberExpression" && up.key === "object" ? up.node : undefined;
      if (member !== undefined && member.computed !== true && isAstNode(property)) {
        const name = property.name;
        if (name !== "store" && name !== "stores") continue;
        const use = useOf(ref.links, top - 1);
        if (use.kind === "call") out.push({ call: use.start, name });
        else if (use.kind === "other") out.push({ other: ref.ident.start, name });
      } else if (member !== undefined) {
        const name = isAstNode(property) && property.type === "Literal" ? property.value : undefined;
        if (typeof name !== "string" || name === "store" || name === "stores")
          out.push({ other: ref.ident.start, name: typeof name === "string" ? name : "store" });
      } else for (const name of destructured(ref.links)) out.push({ other: ref.ident.start, name });
    }
  }
  return out;
}

/** Whether a deployable of `module`'s project serves it as `node` or `static` (any module, with no `topology.ts`). */
function served(module: ModuleInfo, path: string, project: readonly SourceFile[]): boolean {
  const read = topologyFor(path, project);
  if (read?.topology === undefined) return true;
  return Object.values(read.topology).some((d) => d.adapter !== "client" && d.modules.includes(module.key));
}

/**
 * The modules whose `clientPii` judges `file` (k.leave E1107): its own module when it is client-reachable (k.boundary
 * Reach) and a `node` or `static` deployable serves it; for a file outside every module, each such module with a
 * file importing it, directly or through other files (k.boundary Following), no server-only file on the way.
 */
function judges(file: SourceFile, modules: readonly ModuleInfo[], project: readonly SourceFile[]): ModuleInfo[] {
  if (SERVER_ONLY_NAME.test(file.path)) return [];
  const own = moduleOf(file.path, modules);
  if (own !== undefined) return isClientReachable(file.path, project) && served(own, file.path, project) ? [own] : [];
  const index = importIndex(project);
  const byPath = new Map(project.map((f) => [f.path, f]));
  const found = new Set<ModuleInfo>();
  const seen = new Set([file.path]);
  for (const p of seen)
    for (const entry of index.get(p) ?? []) {
      const from = entry.from.path;
      if (seen.has(from) || SERVER_ONLY_NAME.test(from) || isTestPath(from)) continue;
      seen.add(from);
      const m = moduleOf(from, modules);
      const f = byPath.get(from);
      if (m !== undefined && f !== undefined && served(m, from, project)) found.add(m);
    }
  return [...found].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** A site E1107 reads: a `store` call (its first argument) or a store maker's call (its maker and key). */
type Site = { readonly call: CallExpression; readonly maker: Maker | undefined; readonly key: string | undefined };
/** The store makers by key (`fnKeyOf`). */
type Makers = ReadonlyMap<string, Maker>;
/**
 * Bounds the reads of `storeMakers`: a function holding a `store` call is a maker of depth 1, one calling a maker of
 * depth n is of depth n + 1. Round n finds depth n + 1; a maker the round after this many still makes or changes (depth
 * 17 and on) is unsettled, and each call of it is E1107 not readable at its callee, never judged or deferred.
 */
const MAKER_ROUNDS = 16;

/** The `store` calls and store makers' calls of `file`. */
function sitesOf(
  file: SourceFile,
  program: Program,
  uses: readonly Use[],
  makers: Makers,
  project: readonly SourceFile[],
): Site[] {
  const calls = callsByStart(program);
  const out: Site[] = [];
  const stores = new Set<number>();
  for (const use of uses) {
    if (!("call" in use) || use.name !== "store") continue;
    const call = calls.get(use.call);
    if (call === undefined) continue;
    stores.add(call.start);
    out.push({ call, maker: undefined, key: undefined });
  }
  if (makers.size > 0)
    for (const call of calls.values()) {
      if (stores.has(call.start)) continue;
      const key = calleeKey(call.callee, file, project);
      const maker = key === undefined ? undefined : makers.get(key);
      if (maker !== undefined) out.push({ call, maker, key });
    }
  return out.sort((a, b) => a.call.start - b.call.start);
}

const readSite = (site: Site, file: SourceFile, project: readonly SourceFile[]): SiteRead | undefined => {
  if (site.maker !== undefined) return makerRead(site.call, file, project, site.maker);
  const arg = site.call.arguments[0];
  return arg === undefined ? undefined : storeClasses(arg, file, project);
};

/**
 * The store makers of the libraries' files and the sites they defer (k.leave E1107): a top-level function of a
 * library file holding a `store` call, or a call of another store maker, whose state schema it cannot read only at
 * that function's parameters (or their members) is a store maker reading those argument paths and holding the
 * classes the read took, and the site is judged at the maker's callers. Read again until the makers stop changing, so
 * a maker calling a maker is one; the makers the round after `MAKER_ROUNDS` still makes or changes are `unsettled`.
 */
function storeMakers(
  checked: readonly Checked[],
  modules: readonly ModuleInfo[],
  projectOf: (path: string) => readonly SourceFile[],
): { readonly makers: Makers; readonly deferred: ReadonlySet<string>; readonly unsettled: ReadonlySet<string> } {
  const libs = checked.filter(
    ({ file }) =>
      moduleOf(file.path, modules)?.library === true && !isTestPath(file.path) && !SERVER_ONLY_NAME.test(file.path),
  );
  let makers: Makers = new Map();
  let deferred = new Set<string>();
  let seen = new Map<string, string>();
  for (let round = 0; round <= MAKER_ROUNDS; round++) {
    const next = new Map<string, { paths: MakerPath[]; classes: Set<string> }>();
    const later = new Set<string>();
    for (const { file, parsed } of libs) {
      const project = projectOf(file.path);
      const program = parsed.program;
      for (const site of sitesOf(file, program, storeUses(file, program, project), makers, project)) {
        const read = readSite(site, file, project);
        const to = read === undefined ? undefined : deferredTo(read, site.call.start, file, program);
        if (to === undefined) continue;
        later.add(`${file.path}:${site.call.start}`);
        const key = fnKeyOf(file, to.fn);
        const maker = next.get(key) ?? { paths: [], classes: new Set<string>() };
        for (const p of to.paths)
          if (!maker.paths.some((q) => q.index === p.index && q.members.join(".") === p.members.join(".")))
            maker.paths.push(p);
        for (const c of to.classes) maker.classes.add(c);
        next.set(key, maker);
      }
    }
    const shown = new Map(
      [...next].map(([k, m]) => [
        k,
        JSON.stringify([m.paths.map((p) => [p.index, ...p.members].join(".")).sort(), [...m.classes].sort()]),
      ]),
    );
    makers = next;
    deferred = later;
    const changed = [...shown].filter(([k, v]) => seen.get(k) !== v).map(([k]) => k);
    if (changed.length === 0 && shown.size === seen.size) return { makers, deferred, unsettled: new Set() };
    if (round === MAKER_ROUNDS) return { makers, deferred, unsettled: new Set(changed) };
    seen = shown;
  }
  return { makers, deferred, unsettled: new Set() };
}

/**
 * E1107 (k.leave E1107) over the checked files: each `store` call of `@keel/store`, and each call of a library's store
 * maker (`storeMakers`: its own classes and those at the argument paths its state schema reads), whose state schema
 * holds a `.pii(class)` a judging module's `clientPii` does not list (the fix adds the classes when one module lacks
 * them), a state schema it cannot read (a call of an unsettled maker among them), a `stores()` call, and `store`,
 * `stores` or a store maker used other than as a call; none of the last four has a fix. `projectOf` gives each file's
 * project.
 */
export function clientStores(
  checked: readonly Checked[],
  modules: readonly ModuleInfo[],
  projectOf: (path: string) => readonly SourceFile[],
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { makers, deferred, unsettled } = storeMakers(checked, modules, projectOf);
  for (const { file, parsed } of checked) {
    if (LIBRARY.test(file.path) || isTestPath(file.path)) continue;
    const project = projectOf(file.path);
    const uses = storeUses(file, parsed.program, project);
    if (uses.length === 0 && makers.size === 0) continue;
    const judging = judges(file, modules, project).filter((m) => m.manifest !== null);
    if (judging.length === 0) continue;
    const at = (pos: number, message: string, fix?: string): void => {
      out.push({ ...moduleDiag("E1107", file, pos, message, fix), see: "k.leave" });
    };
    for (const use of uses) {
      if ("other" in use) at(use.other, unfollowed(use.name));
      else if (use.name === "stores") at(use.call, STORES);
    }
    if (makers.size > 0)
      for (const use of makerValueUses(file, parsed.program, project, makers, modules))
        at(use.at, makerUnfollowed(use.name));
    for (const site of sitesOf(file, parsed.program, uses, makers, project)) {
      if (site.key !== undefined && unsettled.has(site.key)) {
        const callee = site.call.callee;
        at(site.call.start, notReadable(`${file.source.slice(callee.start, callee.end).replace(/\s+/g, " ")}()`));
        continue;
      }
      if (deferred.has(`${file.path}:${site.call.start}`)) continue;
      const read = readSite(site, file, project);
      if (read === undefined) continue;
      const pos = site.maker !== undefined ? site.call.start : (site.call.arguments[0]?.start ?? site.call.start);
      if ("unread" in read) {
        at(pos, notReadable(read.unread));
        continue;
      }
      const classes = read.classes;
      const lacking = judging.flatMap((m) => {
        const listed = new Set(m.manifest?.clientPii.entries.map((e) => e.value) ?? []);
        const missing = [...classes].filter((c) => !listed.has(c));
        return missing.length === 0 ? [] : [{ m, missing }];
      });
      const first = lacking[0];
      if (first === undefined) continue;
      const missing = [...new Set(lacking.flatMap((l) => l.missing))];
      const msg = `store state reaching #k-state holds .pii('${short(missing.join("', '"))}'), not in clientPii`;
      const man = first.m.manifest;
      const fix =
        lacking.length === 1 && man !== null
          ? addEntryFix(first.m.file, man.clientPii, first.missing, { key: "clientPii", at: man.tail })
          : undefined;
      at(pos, msg, fix);
    }
  }
  return out;
}
