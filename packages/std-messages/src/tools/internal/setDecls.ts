import type { Expression, Program } from "oxc-parser";
import { PKG } from "./PKG.ts";
import type { SetDecl } from "./SetDecl.ts";
import type { ToolKind } from "./ToolKind.ts";
import { keyOf } from "./keyOf.ts";
import { kindAt } from "./kindAt.ts";
import { stringOf } from "./stringOf.ts";
import { unwrap } from "./unwrap.ts";

const memo = new WeakMap<Program, readonly SetDecl[]>();

/** Whether `e` is ``(p) => import(`./<set>/${p}.ts`)``. */
function exactLoad(e: Expression, set: string): boolean {
  const x = unwrap(e);
  if (x.type !== "ArrowFunctionExpression" || x.async || x.params.length !== 1) return false;
  const p = x.params[0];
  const body = x.body;
  if (p?.type !== "Identifier" || body.type === "BlockStatement") return false;
  const imp = unwrap(body);
  if (imp.type !== "ImportExpression" || imp.options !== null || imp.source.type !== "TemplateLiteral") return false;
  const [head, tail] = imp.source.quasis.map((q) => q.value.cooked);
  const [arg, ...rest] = imp.source.expressions;
  return (
    head === `./${set}/` && tail === ".ts" && arg?.type === "Identifier" && arg.name === p.name && rest.length === 0
  );
}

function paramsOf(e: Expression): ReadonlyMap<string, ToolKind> | undefined {
  const x = unwrap(e);
  if (x.type !== "ObjectExpression") return undefined;
  const out = new Map<string, ToolKind>();
  for (const p of x.properties) {
    const name = keyOf(p);
    if (name !== undefined && p.type === "Property") out.set(name, kindAt(p.value));
  }
  return out;
}

function declOf(name: string, call: Expression, local: string): SetDecl | undefined {
  const x = unwrap(call);
  if (x.type !== "CallExpression" || x.callee.type !== "Identifier" || x.callee.name !== local) return undefined;
  const [locales, keysArg, load] = x.arguments;
  if (keysArg === undefined || keysArg.type === "SpreadElement") return undefined;
  const keysObj = unwrap(keysArg);
  if (keysObj.type !== "ObjectExpression") return undefined;
  const keys = keysObj.properties.flatMap((p, index) => {
    const key = keyOf(p);
    const params = p.type === "Property" ? paramsOf(p.value) : undefined;
    return key === undefined || params === undefined || p.type !== "Property"
      ? []
      : [{ name: key, index, params, start: p.start, end: p.end }];
  });
  const loc = locales === undefined || locales.type === "SpreadElement" ? undefined : unwrap(locales);
  return {
    name,
    at: x.start,
    locales: loc?.type === "Identifier" ? loc.name : undefined,
    items: keysObj.properties.map((p) => ({ start: p.start, end: p.end })),
    keys,
    load:
      load === undefined || load.type === "SpreadElement"
        ? undefined
        : { start: load.start, end: load.end, exact: exactLoad(load, name) },
    after: keysArg.end,
  };
}

/** The message sets a program declares: `const X = messages(...)`, `messages` imported from `@keel/std-messages`. */
export function setDecls(program: Program): readonly SetDecl[] {
  const hit = memo.get(program);
  if (hit !== undefined) return hit;
  let local: string | undefined;
  for (const st of program.body)
    if (st.type === "ImportDeclaration" && st.source.value === PKG)
      for (const sp of st.specifiers)
        if (
          sp.type === "ImportSpecifier" &&
          (sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value) === "messages"
        )
          local = sp.local.name;
  const out: SetDecl[] = [];
  for (const st of program.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (local === undefined || decl?.type !== "VariableDeclaration") continue;
    for (const d of decl.declarations) {
      const found = d.id.type === "Identifier" && d.init !== null ? declOf(d.id.name, d.init, local) : undefined;
      if (found !== undefined) out.push(found);
    }
  }
  memo.set(program, out);
  return out;
}
