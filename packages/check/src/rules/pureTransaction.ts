import { references } from "@keel/compiler/internal";
import { type Program, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Ambient, effectful names a transaction function may not read (plus `ctx`). */
const IMPURE: ReadonlySet<string> = new Set([
  "ctx",
  "window",
  "document",
  "globalThis",
  "self",
  "localStorage",
  "sessionStorage",
  "navigator",
  "location",
  "fetch",
  "Date",
  "performance",
  "crypto",
  "console",
  "process",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
  "requestAnimationFrame",
]);

function localName(ast: Program, exported: string, module: string): string | null {
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== module) continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (imported === exported) return sp.local.name;
    }
  }
  return null;
}

/** E1302 (k.store): `ctx` or ambient global access inside a transaction function (they must be pure). */
export const pureTransaction: RuleDef = {
  code: "E1302",
  message: (f) => `transaction ${str(f.data, "tx")} reads ${str(f.data, "name")}; transaction functions are pure`,
  see: "k.store",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const tx = localName(ast, "transaction", "@keel/store");
    if (tx === null) return [];
    const fns: { start: number; end: number; name: string }[] = [];
    const randoms: number[] = [];
    new Visitor({
      CallExpression: (n) => {
        if (n.callee.type !== "Identifier" || n.callee.name !== tx) return;
        const fn = n.arguments[n.arguments.length - 1];
        const label = n.arguments[1];
        const name = label?.type === "Literal" && typeof label.value === "string" ? label.value : "?";
        if (fn?.type === "ArrowFunctionExpression" || fn?.type === "FunctionExpression")
          fns.push({ start: fn.start, end: fn.end, name });
      },
      MemberExpression: (n) => {
        if (!n.computed && n.object.type === "Identifier" && n.object.name === "Math" && n.property.name === "random")
          randoms.push(n.start);
      },
    }).visit(ast);
    if (fns.length === 0) return [];
    const { refs, declared } = references(ast);
    const out: Finding[] = [];
    const owner = (at: number): string | null => fns.find((f) => at >= f.start && at < f.end)?.name ?? null;
    for (const r of refs) {
      const name = owner(r.start);
      if (name !== null && IMPURE.has(r.name) && !declared.has(r.name))
        out.push(findingAt(file, r.start, { tx: name, name: r.name }));
    }
    for (const at of randoms) {
      const name = owner(at);
      if (name !== null) out.push(findingAt(file, at, { tx: name, name: "Math.random" }));
    }
    return out;
  },
};
