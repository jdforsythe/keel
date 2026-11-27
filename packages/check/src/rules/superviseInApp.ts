import { Visitor } from "oxc-parser";
import { SUPERVISE_MESSAGE } from "../internal/SUPERVISE_MESSAGE.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { packageCallee } from "../internal/packageCallee.ts";
import { projectLibraries } from "../internal/projectLibraries.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** A package's own folder in a workspace: kernel and stdlib code, where `supervise` is a library's call. */
const PACKAGE = /(?:^|\/)packages\/[^/]+\//;

/**
 * E1461 (k.supervise Rules): `supervise` of `@keel/ctx` called in app code, at the callee; in a library's file (and a
 * workspace package's), an `id` argument that is no string literal or template without substitution, at the argument.
 * Without the type pass the callee is an import alias, a namespace member or a `const` bound to either
 * (`packageCallee`); with it, `calleeUses` finds it by symbol (k.unsafe One path). No fix.
 */
export const superviseInApp: RuleDef = {
  code: "E1461",
  message: (f) => (str(f.data, "kind") === "id" ? "supervise id is not a literal" : SUPERVISE_MESSAGE),
  see: "k.supervise",
  check: ({ file, ast, types, project }) => {
    if (types === true || !isAppPath(file.path)) return [];
    const isSupervise = packageCallee(ast, "@keel/ctx", "supervise");
    const library = projectLibraries.get(project)?.files.has(file.path) === true || PACKAGE.test(file.path);
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        if (!isSupervise(n.callee)) return;
        if (!library) {
          out.push(findingAt(file, n.callee.start, { kind: "app" }));
          return;
        }
        const id = n.arguments[1];
        if (id === undefined || id.type === "SpreadElement") return;
        const literal =
          (id.type === "Literal" && typeof id.value === "string") ||
          (id.type === "TemplateLiteral" && id.expressions.length === 0);
        if (!literal) out.push(findingAt(file, id.start, { kind: "id" }));
      },
    }).visit(ast);
    return out;
  },
};
