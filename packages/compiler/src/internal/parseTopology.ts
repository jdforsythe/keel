import { type Expression, parseSync } from "oxc-parser";
import { declaredOrigins } from "../hosting/declaredOrigins.ts";
import { deployableNameProblem } from "../hosting/deployableNameProblem.ts";
import type { Topology } from "../types/Topology.ts";
import { SERVED_BY_NOT_LITERAL } from "./SERVED_BY_NOT_LITERAL.ts";

type Deployable = Topology[string];
const ADAPTERS: readonly Deployable["adapter"][] = ["node", "static", "client"];

function unwrap(e: Expression): Expression {
  if (e.type === "ParenthesizedExpression") return unwrap(e.expression);
  if (e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression") return unwrap(e.expression);
  return e;
}

function keyName(k: Expression | { type: string }): string | undefined {
  if ("name" in k && typeof k.name === "string" && k.type === "Identifier") return k.name;
  if (k.type === "Literal" && "value" in k && typeof k.value === "string") return k.value;
  return undefined;
}

const adapterOf = (v: unknown): Deployable["adapter"] | undefined => ADAPTERS.find((x) => x === v);
type Storage = NonNullable<Deployable["storage"]>;
const STORAGES: readonly Storage[] = ["file", "sqlite", "postgres"];
const storageOf = (v: unknown): Storage | undefined => STORAGES.find((x) => x === v);
const KEYS: ReadonlySet<string> = new Set([
  "modules",
  "adapter",
  "servedBy",
  "storage",
  "shells",
  "caller",
  "origins",
  "styles",
]);
type Shell = { readonly id: string; readonly name: string };

/** A shell's `{ id, name }` when both are string literals, else undefined. */
function shellOf(e: Expression): Shell | undefined {
  if (e.type !== "ObjectExpression") return undefined;
  const got: Record<string, string> = {};
  for (const f of e.properties) {
    const k = f.type === "Property" && !f.computed ? keyName(f.key) : undefined;
    const v = f.type === "Property" ? unwrap(f.value) : undefined;
    if (k !== undefined && v?.type === "Literal" && typeof v.value === "string") got[k] = v.value;
  }
  const { id, name } = got;
  return id === undefined || name === undefined ? undefined : { id, name };
}

/**
 * Read `topology.ts` statically (k.topology Declaration): `export default topology({ name: { modules: [...],
 * adapter, servedBy?, storage?, shells?, caller?, origins?, styles? } })` (or a bare object); a `storage` that is not one of its literals, or a
 * `shells` entry that is not `capacitor` or `tauri` with literal `id` and `name`, is a problem. Only literal deployable names (in the form `deployableNameProblem` takes),
 * module ids, adapters and `servedBy` count; anything else is a problem, `[deployable, message]` (`deployable` is the key,
 * `""` for the whole file; the message is one short line), and the deployable is skipped (one with a key it does not list, `host` too, as well), except a `servedBy` that is not a
 * string literal, which is dropped from the kept deployable. A spread, a computed key or a key written twice in a
 * deployable's declaration, or a deployable name written twice, is a problem too: what it holds is known only when it
 * runs. Each kept deployable carries the `origins` the static read accepts (`declaredOrigins`), the one declaration
 * every policy Keel emits reads (k.origins), and the string literals of its `styles` (any other entry is E1587's, read by
 * `stylesProblems`, and is left out here). Nothing is executed.
 */
export function parseTopology(source: string): { topology: Topology; problems: [string, string][] } {
  const problems: [string, string][] = [];
  const out: Record<string, Deployable> = Object.create(null);
  const { program, errors } = parseSync("topology.ts", source, { sourceType: "module", lang: "ts" });
  if (errors.length > 0) return { topology: out, problems: [["", `syntax error: ${errors[0]?.message ?? ""}`]] };
  const def = program.body.find((s) => s.type === "ExportDefaultDeclaration");
  if (def === undefined) return { topology: out, problems: [["", "no default export"]] };
  const d = def.declaration;
  if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration" || d.type === "TSInterfaceDeclaration")
    return { topology: out, problems: [["", "default export is not topology({...})"]] };
  let e = unwrap(d);
  if (e.type === "CallExpression") {
    const arg = e.arguments[0];
    if (arg === undefined || arg.type === "SpreadElement")
      return { topology: out, problems: [["", "topology() needs an object"]] };
    e = unwrap(arg);
  }
  if (e.type !== "ObjectExpression")
    return { topology: out, problems: [["", "default export is not topology({...})"]] };
  const declared = declaredOrigins(source).origins;
  const names = new Set<string>();
  for (const p of e.properties) {
    const name = p.type === "Property" && !p.computed ? keyName(p.key) : undefined;
    if (p.type !== "Property" || name === undefined) {
      problems.push(["", "deployable name is not a literal"]);
      continue;
    }
    if (names.has(name)) {
      problems.push([name, `${name}: the deployable is written twice`]);
      continue;
    }
    names.add(name);
    const bad = deployableNameProblem(name);
    if (bad !== undefined) {
      problems.push([name, bad]);
      continue;
    }
    const v = unwrap(p.value);
    if (v.type !== "ObjectExpression") {
      problems.push([name, `${name}: not an object`]);
      continue;
    }
    let modules: string[] | undefined;
    let adapter: Deployable["adapter"] | undefined;
    let servedBy: string | undefined;
    let storage: Storage | undefined;
    let shells: { capacitor?: Shell; tauri?: Shell } | undefined;
    let styles: string[] | undefined;
    const fields = new Set<string>();
    let unlisted = false;
    for (const f of v.properties) {
      if (f.type !== "Property" || f.computed) {
        problems.push([name, `${name}: a spread or a computed key; write each field out`]);
        continue;
      }
      const k = keyName(f.key);
      if (k === undefined) continue;
      if (fields.has(k)) {
        problems.push([name, `${name}: ${k} is written twice`]);
        continue;
      }
      if (!KEYS.has(k)) {
        problems.push([name, `${name}: ${k} is not a deployable key`]);
        unlisted = true;
        continue;
      }
      fields.add(k);
      const fv = unwrap(f.value);
      if (k === "modules" && fv.type === "ArrayExpression") {
        modules = [];
        for (const m of fv.elements)
          if (m !== null && m.type === "Literal" && typeof m.value === "string") modules.push(m.value);
          else problems.push([name, `${name}: module id is not a string literal`]);
      } else if (k === "adapter" && fv.type === "Literal" && adapterOf(fv.value) !== undefined)
        adapter = adapterOf(fv.value);
      else if (k === "servedBy") {
        if (fv.type === "Literal" && typeof fv.value === "string") servedBy = fv.value;
        else problems.push([name, `${name}: ${SERVED_BY_NOT_LITERAL}`]);
      } else if (k === "storage") {
        const st = fv.type === "Literal" ? storageOf(fv.value) : undefined;
        if (st !== undefined) storage = st;
        else problems.push([name, `${name}: storage is not 'file', 'sqlite' or 'postgres'`]);
      } else if (k === "shells") {
        shells = {};
        for (const sf of fv.type === "ObjectExpression" ? fv.properties : []) {
          const sk = sf.type === "Property" && !sf.computed ? keyName(sf.key) : undefined;
          const shell = sf.type === "Property" ? shellOf(unwrap(sf.value)) : undefined;
          if ((sk === "capacitor" || sk === "tauri") && shell !== undefined) shells[sk] = shell;
          else problems.push([name, `${name}: shells takes capacitor or tauri { id, name } as string literals`]);
        }
        if (fv.type !== "ObjectExpression") problems.push([name, `${name}: shells is not an object literal`]);
      } else if (k === "styles" && fv.type === "ArrayExpression")
        styles = fv.elements.flatMap((x) => (x?.type === "Literal" && typeof x.value === "string" ? [x.value] : []));
    }
    if (unlisted) continue;
    if (modules === undefined || adapter === undefined) {
      problems.push([name, `${name}: needs modules: [...] and adapter: 'node' | 'static' | 'client'`]);
      continue;
    }
    out[name] = {
      modules,
      adapter,
      ...(servedBy === undefined ? {} : { servedBy }),
      ...(storage === undefined ? {} : { storage }),
      ...(shells === undefined ? {} : { shells }),
      ...(declared[name] === undefined ? {} : { origins: declared[name] }),
      ...(styles === undefined ? {} : { styles }),
    };
  }
  return { topology: out, problems };
}
