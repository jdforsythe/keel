import type { ArrowFunctionExpression, Function as FunctionNode, ParamPattern, Program } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Fn = FunctionNode | ArrowFunctionExpression;

/** A component file: a PascalCase `.tsx`, or a PascalCase `.ts` whose default export's first parameter names `Props`. */
function pascalFile(path: string): { tsx: boolean } | null {
  const m = /(?:^|\/)([A-Z][A-Za-z0-9]*)\.(tsx?)$/.exec(path);
  return m === null ? null : { tsx: m[2] === "tsx" };
}

/** The function a file exports as default: a declaration, a function or arrow expression, or a same-file binding of one. */
function defaultFunction(ast: Program): Fn | null {
  const byName = new Map<string, Fn>();
  const note = (name: string | undefined, e: unknown): void => {
    if (name === undefined) return;
    if (isFn(e)) byName.set(name, e);
  };
  for (const st of ast.body) {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d === null || d === undefined) continue;
    if (d.type === "FunctionDeclaration") note(d.id?.name, d);
    if (d.type === "VariableDeclaration")
      for (const v of d.declarations) if (v.id.type === "Identifier") note(v.id.name, v.init);
  }
  for (const st of ast.body) {
    if (st.type !== "ExportDefaultDeclaration") continue;
    const d = st.declaration;
    if (isFn(d)) return d;
    if (d.type === "Identifier") return byName.get(d.name) ?? null;
  }
  return null;
}

function isFn(e: unknown): e is Fn {
  if (typeof e !== "object" || e === null || !("type" in e)) return false;
  return e.type === "FunctionDeclaration" || e.type === "FunctionExpression" || e.type === "ArrowFunctionExpression";
}

/** Whether a parameter is exactly `name: Ctx` (not optional, no default, not destructured). */
function isCtxParam(p: ParamPattern): boolean {
  if (p.type !== "Identifier" || p.optional) return false;
  const t = p.typeAnnotation?.typeAnnotation;
  if (t === undefined || t.type !== "TSTypeReference") return false;
  const n = t.typeName;
  return (n.type === "Identifier" && n.name === "Ctx") || (n.type === "TSQualifiedName" && n.right.name === "Ctx");
}

/** The local name of a parameter pattern that has one. */
function nameOf(p: ParamPattern): string | null {
  const id = p.type === "AssignmentPattern" ? p.left : p;
  return id.type === "Identifier" ? id.name : null;
}

/**
 * E1407 (k.component, rfc:0162): a component's second parameter is optional, has a default, is destructured or is not
 * typed `Ctx`, or a third parameter exists. The checker reads a component file's default export. Fix: the parameters
 * after the first become `<name>: Ctx`, the name of the `ctx` parameter (the third when the second is a leftover
 * `slots` one); a destructured parameter has no mechanical fix.
 */
export const componentCtxSignature: RuleDef = {
  code: "E1407",
  message: () => "a component is (props, ctx: Ctx): ctx required, typed Ctx, last",
  see: "k.component",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const kind = pascalFile(file.path);
    if (kind === null) return [];
    const fn = defaultFunction(ast);
    if (fn === null) return [];
    const ps = fn.params;
    if (!kind.tsx) {
      const first = ps[0];
      if (first === undefined || !file.source.slice(first.start, first.end).includes("Props")) return [];
    }
    const second = ps[1];
    if (second === undefined) return [];
    if (ps.length === 2 && isCtxParam(second)) return [];
    const last = ps[ps.length - 1];
    if (last === undefined) return [];
    const leftover = ps.length > 2 && second.type === "Identifier" && /slots/i.test(second.name);
    const named = nameOf(leftover ? (ps[2] ?? second) : second);
    const finding: Finding = findingAt(file, second.start, {
      start: second.start,
      end: last.end,
      name: named ?? "",
    });
    return [finding];
  },
  fix: (f) => {
    const name = str(f.data, "name");
    return name === "" ? null : [{ start: num(f.data, "start", 0), end: num(f.data, "end", 0), text: `${name}: Ctx` }];
  },
};
