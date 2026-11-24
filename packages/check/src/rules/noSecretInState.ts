import { globalRefs, unwrapExpression } from "@keel/compiler/internal";
import { clip } from "@keel/compiler/internal";
import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { importedFunction } from "../internal/importedFunction.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { reachedFunctions } from "../internal/reachedFunctions.ts";
import { revealImports } from "../internal/revealImports.ts";
import { revealReads } from "../internal/revealReads.ts";
import { schemaSourceOf } from "../internal/schemaSourceOf.ts";
import { secretPath } from "../internal/secretPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const FUNCTIONS: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/**
 * E1303 (k.store): a secret reaching store state. (a) The first argument of `store(...)` holds `s.secret` at any
 * depth, read through the file's consts and relative imports into `project` files; reported at that argument with
 * the field path. (b) `reveal` from `@keel/schema` (`revealReads`: an alias, a const alias or destructured name, or
 * `<namespace>.reveal`/`['reveal']`) read inside a `transaction(...)` function, also one that only compares: an inline
 * function, a function declaration or const function named as the argument (reported at the read), or a function
 * imported from a relative file, also one it re-exports (reported at the argument); the functions of the same file
 * those call by name count too. A `reveal` that a relative file re-exports (`export { reveal as open }`) is read. `store` and `transaction` count as named imports from
 * `@keel/store` or members of its namespace import, only where they bind the import (a local of the same name shadows
 * it). No fix: removing the field or the call leaves the code ill-typed, and the field may live in another file.
 */
export const noSecretInState: RuleDef = {
  code: "E1303",
  message: (f) =>
    f.data?.tx === undefined
      ? clip(`store state schema holds s.secret at ${str(f.data, "path")}; state never holds a secret`, 89)
      : clip(`transaction ${str(f.data, "tx")} uses reveal; state never holds a secret`, 89),
  see: "k.store",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path)) return [];
    const stores = localNames(ast, "store", "@keel/store");
    const txs = localNames(ast, "transaction", "@keel/store");
    const namespaces = new Set<string>();
    for (const st of ast.body) {
      if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/store") continue;
      for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
    }
    if (stores.size === 0 && txs.size === 0 && namespaces.size === 0) return [];
    const src = schemaSourceOf(file.path, ast);
    const g = globalRefs(ast);
    // A read is the import when it binds at module scope; a local of the same name shadows it.
    const imported = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
    /** `store`, `transaction` or null: what the callee `c` names. */
    const factory = (c: Expression): string | null => {
      if (c.type === "Identifier") {
        if (!imported(c.name, c.start)) return null;
        return stores.has(c.name) ? "store" : txs.has(c.name) ? "transaction" : null;
      }
      if (c.type !== "MemberExpression" || c.computed || c.object.type !== "Identifier") return null;
      if (!namespaces.has(c.object.name) || !imported(c.object.name, c.object.start)) return null;
      return c.property.name === "store" || c.property.name === "transaction" ? c.property.name : null;
    };
    const out: Finding[] = [];
    const fns: { start: number; end: number; name: string }[] = [];
    new Visitor({
      CallExpression: (n) => {
        const kind = factory(n.callee);
        const first = n.arguments[0];
        if (kind === "store" && first !== undefined && first.type !== "SpreadElement") {
          const path = secretPath(first, src, project);
          if (path !== null) out.push(findingAt(file, first.start, { path: path === "" ? "(root)" : path }));
        }
        const last = n.arguments[n.arguments.length - 1];
        if (kind !== "transaction" || last === undefined || last.type === "SpreadElement") return;
        const label = n.arguments[1];
        const name = label?.type === "Literal" && typeof label.value === "string" ? label.value : "?";
        const arg = unwrapExpression(last);
        const fn = arg.type === "Identifier" ? (g.functionOf(arg.name, arg.start) ?? g.initOf(arg)) : arg;
        if (FUNCTIONS.has(fn.type))
          for (const s of reachedFunctions(ast, fn)) fns.push({ start: s.start, end: s.end, name });
        else if (arg.type === "Identifier" && imported(arg.name, arg.start)) {
          const far = importedFunction(ast, file.path, arg.name, project);
          if (far === null) return;
          const spans = reachedFunctions(far.program, far);
          const reads = revealReads(far.program, revealImports(far.program, far.file.path, project));
          if (reads.some((at) => spans.some((s) => at >= s.start && at < s.end)))
            out.push(findingAt(file, arg.start, { tx: name }));
        }
      },
    }).visit(ast);
    if (fns.length === 0) return out;
    for (const at of revealReads(ast, revealImports(ast, file.path, project))) {
      const owner = fns.find((f) => at >= f.start && at < f.end);
      if (owner !== undefined) out.push(findingAt(file, at, { tx: owner.name }));
    }
    return out;
  },
};
