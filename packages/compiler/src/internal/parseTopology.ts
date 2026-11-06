import { type Expression, parseSync } from "oxc-parser";
import type { Topology } from "../types/Topology.ts";

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

const isAdapter = (v: string): v is Deployable["adapter"] => ADAPTERS.some((x) => x === v);

/**
 * Read `topology.ts` statically (k.server Topology): `export default topology({ name: { modules: [...],
 * adapter } })` (or a bare object). Only literal deployable names, module ids, and adapters count; anything
 * else is a problem (one short line each) and the deployable is skipped. Nothing is executed.
 */
export function parseTopology(source: string): { topology: Topology; problems: string[] } {
  const problems: string[] = [];
  const out: Record<string, Deployable> = Object.create(null);
  const { program, errors } = parseSync("topology.ts", source, { sourceType: "module", lang: "ts" });
  if (errors.length > 0) return { topology: out, problems: [`syntax error: ${errors[0]?.message ?? ""}`] };
  const def = program.body.find((s) => s.type === "ExportDefaultDeclaration");
  if (def === undefined) return { topology: out, problems: ["no default export"] };
  const d = def.declaration;
  if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration" || d.type === "TSInterfaceDeclaration")
    return { topology: out, problems: ["default export is not topology({...})"] };
  let e = unwrap(d);
  if (e.type === "CallExpression") {
    const arg = e.arguments[0];
    if (arg === undefined || arg.type === "SpreadElement")
      return { topology: out, problems: ["topology() needs an object"] };
    e = unwrap(arg);
  }
  if (e.type !== "ObjectExpression") return { topology: out, problems: ["default export is not topology({...})"] };
  for (const p of e.properties) {
    const name = p.type === "Property" && !p.computed ? keyName(p.key) : undefined;
    if (p.type !== "Property" || name === undefined) {
      problems.push("deployable name is not a literal");
      continue;
    }
    const v = unwrap(p.value);
    if (v.type !== "ObjectExpression") {
      problems.push(`${name}: not an object`);
      continue;
    }
    let modules: string[] | undefined;
    let adapter: Deployable["adapter"] | undefined;
    for (const f of v.properties) {
      const k = f.type === "Property" && !f.computed ? keyName(f.key) : undefined;
      if (f.type !== "Property" || k === undefined) continue;
      const fv = unwrap(f.value);
      if (k === "modules" && fv.type === "ArrayExpression") {
        modules = [];
        for (const m of fv.elements)
          if (m !== null && m.type === "Literal" && typeof m.value === "string") modules.push(m.value);
          else problems.push(`${name}: module id is not a string literal`);
      } else if (k === "adapter" && fv.type === "Literal" && typeof fv.value === "string" && isAdapter(fv.value))
        adapter = fv.value;
    }
    if (modules === undefined || adapter === undefined) {
      problems.push(`${name}: needs modules: [...] and adapter: 'node' | 'static' | 'client'`);
      continue;
    }
    out[name] = { modules, adapter };
  }
  return { topology: out, problems };
}
