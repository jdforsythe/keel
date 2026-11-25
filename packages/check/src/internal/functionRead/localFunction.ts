import { Visitor } from "oxc-parser";
import type { Expression, Program } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { parseFile } from "../parseFile.ts";
import type { FileOf } from "./FileOf.ts";
import type { Located } from "./Located.ts";
import { READ_DEPTH } from "./READ_DEPTH.ts";
import type { ReadFn } from "./ReadFn.ts";
import { exportedFunction } from "./exportedFunction.ts";

const isFn = (e: Expression | null | undefined): e is ReadFn =>
  e !== null && e !== undefined && (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression");

/** `x as T`, `x satisfies T` and `(x)` read through. */
function unwrap(e: Expression): Expression {
  let x = e;
  while (x.type === "TSAsExpression" || x.type === "TSSatisfiesExpression" || x.type === "ParenthesizedExpression")
    x = x.expression;
  return x;
}

const declared = new WeakMap<Program, Map<string, ReadFn | null>>();

/**
 * The functions of `program` by name, anywhere in it: a declaration with a body, or a `const` bound to a function
 * expression (`as`, `satisfies` and parentheses read through); a name held twice, or by a `const` bound to anything
 * else, is none.
 */
function functionsOf(program: Program): Map<string, ReadFn | null> {
  const held = declared.get(program);
  if (held !== undefined) return held;
  const out = new Map<string, ReadFn | null>();
  const put = (n: string, x: ReadFn | null): void => void out.set(n, out.has(n) ? null : x);
  new Visitor({
    VariableDeclaration: (d) => {
      if (d.kind !== "const") return;
      for (const v of d.declarations) {
        if (v.id.type !== "Identifier") continue;
        const init = v.init === null || v.init === undefined ? undefined : unwrap(v.init);
        put(v.id.name, isFn(init) ? init : null);
      }
    },
    FunctionDeclaration: (f) => {
      if (f.id !== null && f.id !== undefined) put(f.id.name, f.body === null ? null : f);
    },
  }).visit(program);
  declared.set(program, out);
  return out;
}

/** The function `name` is in `file`: imported by name or as the default (`fileOf` finds the file), else declared there. */
export function localFunction(name: string, file: SourceFile, fileOf: FileOf, hops = 0): Located | undefined {
  if (hops > READ_DEPTH) return undefined;
  const program = parseFile(file).program;
  for (const st of program.body)
    if (st.type === "ImportDeclaration" && st.importKind !== "type")
      for (const sp of st.specifiers)
        if (sp.local.name === name) {
          const imported =
            sp.type === "ImportDefaultSpecifier"
              ? "default"
              : sp.type === "ImportSpecifier"
                ? sp.imported.type === "Identifier"
                  ? sp.imported.name
                  : sp.imported.value
                : undefined;
          const target = fileOf(file, st.source.value);
          return target === undefined || imported === undefined
            ? undefined
            : exportedFunction(imported, target, fileOf, hops + 1);
        }
  const fn = functionsOf(program).get(name);
  return fn === null || fn === undefined ? undefined : { fn, file };
}
