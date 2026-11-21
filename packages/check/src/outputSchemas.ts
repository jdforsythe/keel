import { readContract } from "@keel/compiler/internal";
import { type Expression, type ObjectExpression, Visitor } from "oxc-parser";
import { contractCalls } from "./internal/contractCalls.ts";
import { lineCol } from "./internal/lineCol.ts";
import { localNames } from "./internal/modules/localNames.ts";
import { namespaceNames } from "./internal/modules/namespaceNames.ts";
import { propertyOf } from "./internal/propertyOf.ts";
import type { OutputSchema } from "./types/OutputSchema.ts";
import type { RuleInput } from "./types/RuleInput.ts";

/**
 * The `output` schema expressions `input.ast` declares (k.privacy-reads Readers), in source order, each with its
 * 1-based line and column: of every entry of a `contract` call (`@keel/router/contract`), entries read as k.contract
 * Static reading reads them (E1111's reading), and of the declaration of every `loader` call (`@keel/router`), an
 * object literal or a top-level `const` of the file bound to one. An `output` given another way is not listed.
 */
export function outputSchemas(input: RuleInput): OutputSchema[] {
  const { file, ast } = input;
  const found: Expression[] = [];
  for (const { call } of contractCalls(file, ast)) {
    const entries = call.arguments[1];
    if (entries === undefined) continue;
    for (const item of readContract(entries)) {
      const output = item.kind === "entry" ? item.members.get("output") : undefined;
      if (output !== undefined) found.push(output.value);
    }
  }
  const loaders = localNames(ast, "loader", "@keel/router");
  const spaces = namespaceNames(ast, "@keel/router");
  if (loaders.size > 0 || spaces.size > 0) {
    const consts = new Map<string, ObjectExpression>();
    for (const st of ast.body) {
      const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
      if (d?.type !== "VariableDeclaration" || d.kind !== "const") continue;
      for (const v of d.declarations)
        if (v.id.type === "Identifier" && v.init?.type === "ObjectExpression") consts.set(v.id.name, v.init);
    }
    new Visitor({
      CallExpression: (call) => {
        const c = call.callee;
        const isLoader =
          c.type === "Identifier"
            ? loaders.has(c.name)
            : c.type === "MemberExpression" &&
              !c.computed &&
              c.object.type === "Identifier" &&
              spaces.has(c.object.name) &&
              c.property.name === "loader";
        if (!isLoader) return;
        const decl = call.arguments[2];
        const obj =
          decl?.type === "ObjectExpression" ? decl : decl?.type === "Identifier" ? consts.get(decl.name) : undefined;
        const output = obj === undefined ? null : propertyOf(obj, "output");
        if (output !== null) found.push(output.value);
      },
    }).visit(ast);
  }
  return found.sort((a, b) => a.start - b.start).map((expr) => ({ expr, ...lineCol(file.source, expr.start) }));
}
