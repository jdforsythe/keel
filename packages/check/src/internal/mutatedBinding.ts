import { type Argument, type Expression, type Program, Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { parseFile } from "./parseFile.ts";

/** `Object` and `Reflect` members that change their first argument. */
const MUTATORS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["Object", new Set(["assign", "defineProperty", "defineProperties", "setPrototypeOf"])],
  ["Reflect", new Set(["set", "defineProperty", "deleteProperty", "setPrototypeOf"])],
]);

const cache = new WeakMap<Program, ReadonlySet<string>>();

/** The identifier `node` starts at through parentheses, `as` and member chains (`a.b[c].d`), else null. */
function rootName(node: Expression | Argument | null | undefined, member: boolean): string | null {
  let n = node;
  let seen = !member;
  while (
    n?.type === "MemberExpression" ||
    n?.type === "ParenthesizedExpression" ||
    n?.type === "TSAsExpression" ||
    n?.type === "TSNonNullExpression"
  ) {
    if (n.type === "MemberExpression") {
      seen = true;
      n = n.object;
    } else n = n.expression;
  }
  return seen && n?.type === "Identifier" ? n.name : null;
}

/** The names a program changes after their declaration: a member assigned, updated or deleted, or the first argument of an `Object.assign`-like call. */
function mutatedNames(program: Program): ReadonlySet<string> {
  const hit = cache.get(program);
  if (hit !== undefined) return hit;
  const out = new Set<string>();
  const add = (name: string | null): void => {
    if (name !== null) out.add(name);
  };
  new Visitor({
    AssignmentExpression: (n) => add(rootName(n.left.type === "MemberExpression" ? n.left : null, true)),
    UpdateExpression: (n) => add(rootName(n.argument, true)),
    UnaryExpression: (n) => {
      if (n.operator === "delete") add(rootName(n.argument, true));
    },
    CallExpression: (n) => {
      const c = n.callee;
      if (c.type !== "MemberExpression" || c.computed || c.object.type !== "Identifier") return;
      if (MUTATORS.get(c.object.name)?.has(c.property.name) === true) add(rootName(n.arguments[0], false));
    },
  }).visit(program);
  cache.set(program, out);
  return out;
}

/**
 * Whether `expr`, in the initializer of a top-level `const` of `file`, belongs to a name the file changes after its
 * literal: `p.x = ...`, `p[k] = ...`, `delete p.x`, `Object.assign(p, ...)`, `Object.defineProperty(p, ...)` and the
 * like. What a rule read from the literal is then not what the program holds. Names are read by spelling, not scope.
 */
export function mutatedBinding(expr: Expression, file: SourceFile): boolean {
  const program = parseFile(file).program;
  const names = mutatedNames(program);
  if (names.size === 0) return false;
  for (const st of program.body) {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d?.type !== "VariableDeclaration") continue;
    for (const v of d.declarations)
      if (
        v.id.type === "Identifier" &&
        names.has(v.id.name) &&
        v.init !== null &&
        v.init !== undefined &&
        v.init.start <= expr.start &&
        expr.end <= v.init.end
      )
        return true;
  }
  return false;
}
