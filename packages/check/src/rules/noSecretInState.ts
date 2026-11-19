import { globalRefs, references } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import { clip } from "../internal/clip.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { schemaSourceOf } from "../internal/schemaSourceOf.ts";
import { secretPath } from "../internal/secretPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1303 (k.store): a secret reaching store state. (a) The first argument of `store(...)` holds `s.secret` at any
 * depth, read through the file's consts and relative imports into `project` files; reported at that argument with
 * the field path. (b) `reveal` from `@keel/schema` (any alias, or `<namespace>.reveal`) referenced inside a
 * `transaction(...)` function, also one that only compares; reported at the reference. `store`, `transaction` and
 * `reveal` count only where they bind the import (a local of the same name shadows it). No fix: removing the field or the call leaves the code
 * ill-typed, and the field may live in another file.
 */
export const noSecretInState: RuleDef = {
  code: "E1303",
  message: (f) =>
    f.data?.tx === undefined
      ? clip(`store state schema holds s.secret at ${str(f.data, "path")}; state never holds a secret`, 89)
      : clip(`transaction ${str(f.data, "tx")} uses reveal; state never holds a secret`, 89),
  explain:
    "State reaches snapshots, #k-state and storage, so it never holds a secret. Keep the value s.secret end to end; reveal it only where it is used, never into a payload or state field.",
  see: "k.store",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path)) return [];
    const stores = localNames(ast, "store", "@keel/store");
    const txs = localNames(ast, "transaction", "@keel/store");
    if (stores.size === 0 && txs.size === 0) return [];
    const reveals = localNames(ast, "reveal", "@keel/schema");
    const namespaces = new Set<string>();
    for (const st of ast.body) {
      if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/schema") continue;
      for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
    }
    const src = schemaSourceOf(file.path, ast);
    const g = globalRefs(ast);
    // A read is the import when it binds at module scope; a local of the same name shadows it.
    const imported = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
    const out: Finding[] = [];
    const fns: { start: number; end: number; name: string }[] = [];
    const members: number[] = [];
    new Visitor({
      CallExpression: (n) => {
        if (n.callee.type !== "Identifier" || !imported(n.callee.name, n.callee.start)) return;
        const first = n.arguments[0];
        if (stores.has(n.callee.name) && first !== undefined && first.type !== "SpreadElement") {
          const path = secretPath(first, src, project);
          if (path !== null) out.push(findingAt(file, first.start, { path: path === "" ? "(root)" : path }));
        }
        if (!txs.has(n.callee.name)) return;
        const fn = n.arguments[n.arguments.length - 1];
        const label = n.arguments[1];
        const name = label?.type === "Literal" && typeof label.value === "string" ? label.value : "?";
        if (fn?.type === "ArrowFunctionExpression" || fn?.type === "FunctionExpression")
          fns.push({ start: fn.start, end: fn.end, name });
      },
      MemberExpression: (n) => {
        if (n.computed || n.object.type !== "Identifier" || !namespaces.has(n.object.name)) return;
        if (!imported(n.object.name, n.object.start)) return;
        if (n.property.type === "Identifier" && n.property.name === "reveal") members.push(n.start);
      },
    }).visit(ast);
    if (fns.length === 0) return out;
    const owner = (at: number): string | null => fns.find((f) => at >= f.start && at < f.end)?.name ?? null;
    const uses = [
      ...references(ast)
        .refs.filter((r) => reveals.has(r.name) && imported(r.name, r.start))
        .map((r) => r.start),
      ...members,
    ];
    for (const at of uses) {
      const name = owner(at);
      if (name !== null) out.push(findingAt(file, at, { tx: name }));
    }
    return out;
  },
};
